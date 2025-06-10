use std::sync::atomic::AtomicBool;
use std::time::{Duration, Instant};
use std::{fs::create_dir_all, path::PathBuf, sync::Arc};

use chrono::Local;
use cpal::traits::StreamTrait;
use cpal::{Device, StreamConfig};
use ffmpeg_sidecar::{child::FfmpegChild, command::FfmpegCommand};
use tauri::{AppHandle, Manager};
use tokio::sync::broadcast::Receiver;
use tokio::sync::Barrier;

use crate::audio::service::{
  build_audio_into_file_stream, get_input_audio_device, get_system_audio_device,
};

// region: Recording stream setup

// pub fn start_screen_recording(
//   recording_type: RecordingType,
//   monitor_name: String,
//   app_handle: AppHandle,
//   file_path: PathBuf,
//   stop_recording_flag: Arc<AtomicBool>,
// ) -> Option<ScreenCaptureRecordingDetails> {
//   let (mut capturer, width, height) = match recording_type {
//     RecordingType::Screen => {
//       let monitors = list_monitors(app_handle.clone());
//       let monitor = monitors
//         .iter()
//         .find(|m| m.name == monitor_name)
//         .or_else(|| monitors.first())
//         .unwrap();

//       let monitor_size = monitor.physical_size;

//       Some((
//         create_screen_recording_capturer(app_handle.clone(), monitor.name.clone()),
//         monitor_size.width as u32,
//         monitor_size.height as u32,
//       ))
//     }
//     RecordingType::Region => None,
//     RecordingType::Window => None,
//   }?;

//   let mut ffmpeg_child = create_ffmpeg_writer(file_path, width, height, "bgra".to_string());
//   let ffmpeg_stdin = Arc::new(Mutex::new(ffmpeg_child.take_stdin()));
//   let ffmpeg_stdin_for_callback = ffmpeg_stdin.clone();

//   thread::spawn(move || {
//     capturer.start_capture();
//     while !stop_recording_flag.load(std::sync::atomic::Ordering::SeqCst) {
//       if let Ok(scap::frame::Frame::BGRA(frame)) = capturer.get_next_frame() {
//         if let Some(stdin) = ffmpeg_stdin_for_callback.lock().unwrap().as_mut() {
//           let _ = stdin.write_all(&frame.data);
//         }
//       }
//     }
//     capturer.stop_capture();
//   });

//   Some(ScreenCaptureRecordingDetails {
//     ffmpeg: ffmpeg_child,
//     stdin: ffmpeg_stdin,
//   })
// }

/// Create and start system audio recording thread
///
/// Message received in `stop_rx` will finalize the recording.
pub fn start_system_audio_recording(
  start_writing: Arc<AtomicBool>,
  barrier: Arc<Barrier>,
  stop_rx: Receiver<()>,
  file_path: PathBuf,
) {
  let (device, config) = get_system_audio_device();
  start_audio_recording(start_writing, barrier, stop_rx, file_path, device, config);
}

/// Create and start audio input recording
///
/// /// Message received in `stop_rx` will finalize the recording.
pub fn start_input_audio_recording(
  start_writing: Arc<AtomicBool>,
  barrier: Arc<Barrier>,
  stop_rx: Receiver<()>,
  file_path: PathBuf,
  device_name: String,
) {
  let (device, config) = get_input_audio_device(device_name);
  start_audio_recording(start_writing, barrier, stop_rx, file_path, device, config);
}

fn start_audio_recording(
  start_writing: Arc<AtomicBool>,
  barrier: Arc<Barrier>,
  mut stop_rx: Receiver<()>,
  file_path: PathBuf,
  device: Device,
  config: StreamConfig,
) {
  tauri::async_runtime::spawn(async move {
    let now = Instant::now();

    let (stream, wav_writer, first_sample_time) =
      build_audio_into_file_stream(&device, &config, &file_path, start_writing);
    stream.play().expect("Failed to start system audio stream");

    barrier.wait().await;

    tauri::async_runtime::spawn(async move {
      loop {
        if let Some(start_time) = *first_sample_time.lock().unwrap() {
          println!(
            "Stream {:?} actual delay: {:?}",
            file_path,
            start_time.duration_since(now)
          );
          break;
        }
        tokio::time::sleep(Duration::from_millis(1)).await;
      }
    });

    let _ = stop_rx.recv().await;
    drop(stream); // cpal has not stop capability, stream cleaned on drop

    let mut writer_lock = wav_writer.lock().unwrap();
    if let Some(writer) = writer_lock.take() {
      writer.finalize().unwrap();
    }
  });
}

/// Create and start camera recording
// pub fn start_camera_recording(
//   camera_name: Option<String>,
//   file_path: PathBuf,
//   stop_recording_flag: Arc<AtomicBool>,
// ) -> Option<CameraRecordingDetails> {
//   let camera_name = camera_name?;
//   let available_cameras = nokhwa::query(nokhwa::utils::ApiBackend::Auto).unwrap();

//   let camera = available_cameras
//     .iter()
//     .find(|c| c.human_name() == camera_name)?;
//   let camera_index = camera.index();
//   let (width, height) = get_camera_dimensions(camera_index)?;

//   let mut ffmpeg_child = create_ffmpeg_writer(file_path, width, height, "rgba".to_string());
//   let ffmpeg_stdin = Arc::new(Mutex::new(ffmpeg_child.take_stdin()));
//   let ffmpeg_stdin_for_callback = ffmpeg_stdin.clone();

//   let stream = create_and_start_camera(camera_index.clone(), move |frame| {
//     if stop_recording_flag.load(std::sync::atomic::Ordering::SeqCst) {
//       // Flag required to correctly drop stdin when recording stopped to avoid
//       // ffmpeg hanging
//       *ffmpeg_stdin_for_callback.lock().unwrap() = None;
//       return;
//     }

//     if let Some(stdin) = ffmpeg_stdin_for_callback.lock().unwrap().as_mut() {
//       capture_to_file_callback(frame, stdin);
//     }
//   })?;

//   Some(CameraRecordingDetails {
//     stream,
//     ffmpeg: ffmpeg_child,
//     stdin: ffmpeg_stdin,
//   })
// }

// endregion

pub fn create_recording_directory(app_handle: &AppHandle) -> PathBuf {
  let recordings_dir = app_handle.path().app_data_dir().unwrap().join("Recordings");
  let timestamp = Local::now().format("%Y-%m-%d_%H-%M-%S").to_string();
  let session_dir = recordings_dir.join(&timestamp);
  let _ = create_dir_all(&session_dir);

  session_dir
}

pub fn create_ffmpeg_writer(
  file_path: PathBuf,
  width: u32,
  height: u32,
  pixel_format: String,
) -> FfmpegChild {
  let child = FfmpegCommand::new()
    .args(["-use_wallclock_as_timestamps", "1"])
    .realtime()
    .format("rawvideo")
    .pix_fmt(pixel_format)
    .size(width, height)
    .input("-")
    .args(["-vsync", "vfr"])
    .codec_video("libx264")
    .preset("faster")
    .crf(18)
    .output(file_path.to_string_lossy())
    .spawn()
    .unwrap();

  child
}

// pub fn stop_audio_writer(recording_details: Option<&AudioRecordingDetails>) {
//   if let Some(stream) = recording_details {
//     let wav_writer = Arc::clone(&stream.wav_writer);

//     {
//       let mut writer_lock = wav_writer.lock().unwrap();
//       if let Some(writer) = writer_lock.take() {
//         writer.finalize().unwrap();
//       }
//     }
//   }
// }

// pub fn stop_camera_writer(camera_details: Option<CameraRecordingDetails>) {
//   if let Some(mut details) = camera_details {
//     std::thread::spawn(move || {
//       // Ensure ffmpeg knows its EOF
//       *details.stdin.lock().unwrap() = None;

//       // Need a thread to stop stream otherwise freezes main thread
//       let _ = details.stream.stop_stream();
//       let _ = details.ffmpeg.wait();
//     });
//   }
// }
