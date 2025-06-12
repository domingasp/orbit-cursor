use std::io::Write;
use std::process::ChildStdin;
use std::sync::atomic::AtomicBool;
use std::sync::Mutex;
use std::{fs::create_dir_all, path::PathBuf, sync::Arc};

use chrono::Local;
use cpal::traits::StreamTrait;
use cpal::{Device, StreamConfig};
use ffmpeg_sidecar::{child::FfmpegChild, command::FfmpegCommand};
use nokhwa::utils::CameraIndex;
use nokhwa::CallbackCamera;
use tauri::async_runtime::JoinHandle;
use tauri::{AppHandle, Manager};
use tokio::sync::broadcast::Receiver;
use tokio::sync::{mpsc, Barrier};

use crate::audio::service::{
  build_audio_into_file_stream, get_input_audio_device, get_system_audio_device,
};
use crate::camera::service::{create_camera, frame_to_rgba};
use crate::recording::models::{RecordingType, StreamSynchronization};

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

pub fn start_screen_recording(
  mut synchronization: StreamSynchronization,
  file_path: PathBuf,
  recording_type: RecordingType,
  monitor_name: String,
) {
  tauri::async_runtime::spawn(async move {
    // Spin up

    synchronization.barrier.wait().await;

    let _ = synchronization.stop_rx.recv().await;

    // Teardown
  });
}

/// Create and start system audio recording thread
///
/// Message received in `stop_rx` will finalize the recording.
pub fn start_system_audio_recording(synchronization: StreamSynchronization, file_path: PathBuf) {
  let (device, config) = get_system_audio_device();
  start_audio_recording(synchronization, file_path, device, config);
}

/// Create and start audio input recording
///
/// Message received in `stop_rx` will finalize the recording.
pub fn start_input_audio_recording(
  mut synchronization: StreamSynchronization,
  file_path: PathBuf,
  device_name: String,
) {
  if let Some((device, config)) = get_input_audio_device(device_name.clone()) {
    start_audio_recording(synchronization, file_path, device, config);
  } else {
    eprintln!("Failed to get input audio device: {}", device_name);
  }
}

fn start_audio_recording(
  mut synchronization: StreamSynchronization,
  file_path: PathBuf,
  device: Device,
  config: StreamConfig,
) {
  tauri::async_runtime::spawn(async move {
    let (stream, wav_writer) =
      build_audio_into_file_stream(&device, &config, &file_path, synchronization.start_writing);
    stream.play().expect("Failed to start system audio stream");

    synchronization.barrier.wait().await;

    let _ = synchronization.stop_rx.recv().await;
    drop(stream); // cpal has no stop capability, stream cleaned on drop

    let mut writer_lock = wav_writer.lock().unwrap();
    if let Some(writer) = writer_lock.take() {
      writer.finalize().unwrap();
    }
  });
}

/// Create and start camera recording
pub fn start_camera_recording(
  mut synchronization: StreamSynchronization,
  file_path: PathBuf,
  camera_name: String,
) {
  let available_cameras = nokhwa::query(nokhwa::utils::ApiBackend::Auto).unwrap();
  let camera_info = available_cameras
    .iter()
    .find(|c| c.human_name() == camera_name)
    .unwrap();
  let camera_index = camera_info.index().clone();

  let start_writing_for_callback = synchronization.start_writing.clone();
  tauri::async_runtime::spawn(async move {
    // Some cameras (like Macbook webcam) have a warmup period.
    // Once camera starts sending first frame one shot is sent and
    // barrier awaited
    let (camera_ready_tx, camera_ready_rx) = tokio::sync::oneshot::channel();
    let camera_ready_tx = Arc::new(Mutex::new(Some(camera_ready_tx)));

    let (frame_tx, frame_rx) = mpsc::channel::<Vec<u8>>(10);
    let frame_tx_arc = Arc::new(Mutex::new(Some(frame_tx.clone())));

    let mut camera =
      setup_camera_with_send(camera_index, camera_ready_tx.clone(), frame_tx_arc.clone());

    let resolution = camera.resolution().unwrap();
    let frame_rate = camera.frame_rate().unwrap();

    let mut ffmpeg_child = create_ffmpeg_writer(
      file_path,
      resolution.width(),
      resolution.height(),
      "rgba".to_string(),
      frame_rate.to_string(),
    );
    let ffmpeg_stdin = ffmpeg_child.take_stdin().unwrap();

    let writer = spawn_ffmpeg_frame_writer(frame_rx, ffmpeg_stdin, synchronization.start_writing);

    let _ = camera.open_stream();
    let _ = camera_ready_rx.await;

    synchronization.barrier.wait().await; // Signal this thread is ready

    let _ = synchronization.stop_rx.recv().await;
    start_writing_for_callback.store(false, std::sync::atomic::Ordering::SeqCst);

    {
      // Dropping sender to ensure writer drops ffmpeg_stdin, signalling end of recording
      let mut locked_tx = frame_tx_arc.lock().unwrap();
      *locked_tx = None;
    }
    drop(frame_tx);

    let _ = writer.await;
    let _ = ffmpeg_child.wait();
    let _ = camera.stop_stream();
  });
}

/// Create and return camera which sends RGBA frames to `frame_tx`
fn setup_camera_with_send(
  camera_index: CameraIndex,
  camera_ready_tx: Arc<Mutex<Option<tokio::sync::oneshot::Sender<()>>>>,
  frame_tx: Arc<Mutex<Option<mpsc::Sender<Vec<u8>>>>>,
) -> CallbackCamera {
  create_camera(camera_index, move |frame| {
    if let Some(tx) = camera_ready_tx.lock().unwrap().take() {
      let _ = tx.send(());
    }

    if let Some(ref tx) = *frame_tx.lock().unwrap() {
      let _ = tx.try_send(frame_to_rgba(frame));
    }
  })
  .unwrap()
}

/// Spawn new thread for ffmpeg write to stdin
fn spawn_ffmpeg_frame_writer(
  mut frame_rx: mpsc::Receiver<Vec<u8>>,
  mut ffmpeg_stdin: ChildStdin,
  start_writing: Arc<AtomicBool>,
) -> JoinHandle<()> {
  tauri::async_runtime::spawn(async move {
    while let Some(frame) = frame_rx.recv().await {
      if start_writing.load(std::sync::atomic::Ordering::SeqCst) {
        let _ = ffmpeg_stdin.write_all(&frame);
      }
    }

    drop(ffmpeg_stdin);
  })
}

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
  frame_rate: String,
) -> FfmpegChild {
  let child = FfmpegCommand::new()
    .args(["-framerate", &frame_rate])
    .format("rawvideo")
    .pix_fmt(pixel_format)
    .size(width, height)
    .input("-")
    .codec_video("libx264")
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
