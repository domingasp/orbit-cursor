use std::fs::{File, OpenOptions};
use std::io::Write;

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Barrier, Mutex};
use std::time::{Duration, Instant, SystemTime};
use std::{fs::create_dir_all, path::PathBuf, sync::Arc};

use chrono::Local;
use cpal::traits::StreamTrait;
use cpal::{Device, StreamConfig};
use ffmpeg_sidecar::{child::FfmpegChild, command::FfmpegCommand};
use nokhwa::utils::CameraIndex;
use rdev::EventType;
use rmp_serde::encode::write;
use scap::capturer::Capturer;
use scap::frame::{Frame, YUVFrame};
use serde::Serialize;
use tauri::{AppHandle, LogicalPosition, Manager, PhysicalPosition, PhysicalSize};
use tokio::sync::broadcast;

use crate::audio::service::{
  build_audio_into_file_stream, get_input_audio_device, get_system_audio_device,
};
use crate::camera::service::{create_camera, frame_format_to_ffmpeg};
use crate::recording::models::{RecordingMetadata, RecordingType, Region, StreamSynchronization};
use crate::recording_sources::commands::list_monitors;
use crate::recording_sources::service::get_visible_windows;
use crate::screen_capture::service::{create_screen_recording_capturer, get_display, get_window};

type ArcOneShotSender = Arc<Mutex<Option<tokio::sync::oneshot::Sender<()>>>>;
type CapturerInfo = (
  Capturer,
  u32,
  u32,
  Option<PhysicalSize<f64>>,
  Option<PhysicalPosition<f64>>,
  LogicalPosition<f64>,
  f64,
);

#[derive(Debug, Serialize)]
pub enum MouseEventRecord {
  Move {
    elapsed_ms: u128,
    x: f64,
    y: f64,
  },
  Down {
    elapsed_ms: u128,
    button: rdev::Button,
  },
  Up {
    elapsed_ms: u128,
    button: rdev::Button,
  },
}

/// Create and start mouse event recording thread
///
/// A single file, `mouse_events.msgpack`, is generated containing mouse events
/// (move, button down, button up).
///
/// * `origin` - Recording origin, screens and windows have different origins.
pub fn spawn_mouse_event_recorder(
  synchronization: StreamSynchronization,
  file_path: PathBuf,
  mut input_event_rx: broadcast::Receiver<rdev::Event>,
) {
  let mut mouse_events_file = OpenOptions::new()
    .create(true)
    .append(true)
    .open(file_path)
    .expect("Failed to open mouse position message pack file");

  std::thread::spawn(move || {
    let movement_throttle_ms = Duration::from_millis(16); // ~60 FPS
    let start_time = SystemTime::now();
    let mut last_recorded_move = Instant::now() - movement_throttle_ms;

    let mut stop_rx = synchronization.stop_tx.subscribe();
    loop {
      if stop_rx.try_recv().is_ok() {
        break;
      }

      match input_event_rx.blocking_recv() {
        Ok(event) => {
          if !synchronization
            .start_writing
            .load(std::sync::atomic::Ordering::SeqCst)
          {
            continue;
          }

          let elapsed_ms = SystemTime::now()
            .duration_since(start_time)
            .unwrap_or_default()
            .as_millis();

          let mouse_event_option = match event.event_type {
            EventType::MouseMove { x, y } => {
              if last_recorded_move.elapsed() >= movement_throttle_ms {
                last_recorded_move = Instant::now();
                Some(MouseEventRecord::Move { elapsed_ms, x, y })
              } else {
                None
              }
            }
            EventType::ButtonPress(button) => Some(MouseEventRecord::Down { elapsed_ms, button }),
            EventType::ButtonRelease(button) => Some(MouseEventRecord::Up { elapsed_ms, button }),
            _ => None,
          };

          if let Some(mouse_event) = mouse_event_option {
            if let Err(e) = write(&mut mouse_events_file, &mouse_event) {
              eprintln!("Failed to write mouse event: {e}");
            }
          }
        }
        Err(e) => {
          eprintln!("Failed to receive input event: {e}");
        }
      }
    }
  });
}

/// Create and start screen recording thread
///
/// Returns recording origin (logical coords) and scale factor of monitor
pub fn start_screen_recording(
  synchronization: StreamSynchronization,
  file_path: PathBuf,
  recording_type: RecordingType,
  app_handle: AppHandle,
  monitor_name: String,
  window_id: Option<u32>,
  region: Region,
) -> (LogicalPosition<f64>, f64) {
  let (capturer, width, height, crop_size, crop_origin, recording_origin, scale_factor) =
    create_screen_capturer(app_handle, recording_type, monitor_name, window_id, region);

  let (frame_tx, frame_rx) = std::sync::mpsc::channel::<Vec<u8>>();

  spawn_capturer_with_send(
    capturer,
    frame_tx,
    synchronization.start_writing.clone(),
    synchronization.stop_tx.subscribe(),
  );

  let ffmpeg_child = create_ffmpeg_writer(
    file_path,
    width,
    height,
    "nv12".to_string(),
    None,
    crop_size,
    crop_origin,
  );

  spawn_ffmpeg_frame_writer(
    ffmpeg_child,
    frame_rx,
    synchronization.start_writing.clone(),
    synchronization.stop_tx.subscribe(),
    synchronization.stop_barrier.clone(),
  );

  (recording_origin, scale_factor)
}

/// Create screen capturer based on recording type
fn create_screen_capturer(
  app_handle: AppHandle,
  recording_type: RecordingType,
  monitor_name: String,
  window_id: Option<u32>,
  region: Region,
) -> CapturerInfo {
  log::info!("Fetching display data");
  let monitors = list_monitors(app_handle.clone());
  let monitor = monitors
    .iter()
    .find(|m| m.name == monitor_name)
    .or_else(|| monitors.first())
    .unwrap();
  let size = monitor.physical_size;
  let scale_factor = monitor.scale_factor;

  let mut target = get_display(monitor_name);
  let mut width = size.width;
  let mut height = size.height;

  let mut crop_size: Option<PhysicalSize<f64>> = None;
  let mut crop_origin: Option<PhysicalPosition<f64>> = None;

  let mut recording_origin = monitor.position;
  log::info!("Monitor details ready");

  if let (RecordingType::Window, Some(window_id)) = (recording_type, window_id) {
    log::info!("Fetching window details");
    let windows = get_visible_windows(app_handle.clone().available_monitors().unwrap(), None);
    let window_details = windows.into_iter().find(|w| w.id == window_id);

    // Details are not the same as scap::Target
    if let Some(window_details) = window_details {
      log::info!("Window details found, fetching window target");
      let window_size = window_details.size.to_physical(window_details.scale_factor);
      let window_target = get_window(window_id);

      // Only if we can find the target will we use it, otherwise use default (screen)
      if let Some(window_target) = window_target {
        log::info!("Window target found, configuring window details");
        target = Some(window_target);
        width = window_size.width;
        height = window_size.height;
        recording_origin = window_details.position
      }
    }
  } else if recording_type == RecordingType::Region {
    log::info!("Configuring region details");
    crop_size = Some(region.size.to_physical(scale_factor));
    crop_origin = Some(region.position.to_physical(scale_factor));
    recording_origin = region.position;
  }

  // We don't use scap crop area due to strange behaviour with ffmpeg, instead we crop directly
  // in ffmpeg
  let capturer = create_screen_recording_capturer(target);
  log::info!("Screen capturer created");

  (
    capturer,
    width as u32,
    height as u32,
    crop_size,
    crop_origin,
    recording_origin,
    scale_factor,
  )
}

/// Create and start camera recording
pub fn start_camera_recording(
  synchronization: StreamSynchronization,
  file_path: PathBuf,
  camera_name: String,
) {
  log::info!("Search for camera: {camera_name}");
  let available_cameras = nokhwa::query(nokhwa::utils::ApiBackend::Auto).unwrap();
  let camera_info = available_cameras
    .iter()
    .find(|c| c.human_name() == camera_name)
    .unwrap();
  let camera_index = camera_info.index().clone();
  log::info!("Camera found");

  let start_writing_for_writer = synchronization.start_writing.clone();

  let (camera_ready_tx, camera_ready_rx) = tokio::sync::oneshot::channel();
  let camera_ready_tx = Arc::new(Mutex::new(Some(camera_ready_tx)));

  let (frame_tx, frame_rx) = std::sync::mpsc::channel::<Vec<u8>>();

  let (resolution, frame_rate, pixel_format) = spawn_camera_with_send(
    camera_index,
    camera_ready_tx.clone(),
    frame_tx,
    start_writing_for_writer,
    synchronization.stop_tx.subscribe(),
  );

  let ffmpeg_child = create_ffmpeg_writer(
    file_path,
    resolution.width(),
    resolution.height(),
    pixel_format,
    Some(frame_rate.to_string()),
    None,
    None,
  );

  spawn_ffmpeg_frame_writer(
    ffmpeg_child,
    frame_rx,
    synchronization.start_writing.clone(),
    synchronization.stop_tx.subscribe(),
    synchronization.stop_barrier.clone(),
  );

  let _ = camera_ready_rx.blocking_recv();
}

/// Create and return camera which sends RGBA frames to `frame_tx`
fn spawn_camera_with_send(
  camera_index: CameraIndex,
  camera_ready_tx: ArcOneShotSender,
  frame_tx: std::sync::mpsc::Sender<Vec<u8>>,
  start_writing: Arc<AtomicBool>,
  mut stop_rx: broadcast::Receiver<()>,
) -> (nokhwa::utils::Resolution, u32, String) {
  log::info!("Creating camera");
  let mut camera = create_camera(camera_index, move |frame| {
    if let Some(tx) = camera_ready_tx.lock().unwrap().take() {
      log::info!("Camera started reading frames");
      let _ = tx.send(());
    }

    if start_writing.load(std::sync::atomic::Ordering::SeqCst) {
      let _ = frame_tx.send(frame.buffer().to_vec());
    }
  })
  .unwrap();

  let resolution = camera.resolution().unwrap();
  let frame_rate = camera.frame_rate().unwrap();
  let frame_format = frame_format_to_ffmpeg(
    camera
      .frame_format()
      .unwrap_or(nokhwa::utils::FrameFormat::RAWRGB),
  );

  std::thread::spawn(move || {
    log::info!("Opening camera stream");
    if let Err(e) = camera.open_stream() {
      eprintln!("Failed to start camera: {e}");
    }

    let _ = stop_rx.blocking_recv(); // Keeps camera alive
    log::info!("Camera received stop signal")
  });

  (resolution, frame_rate, frame_format.to_string())
}

/// Spawn new thread for ffmpeg write to stdin
fn spawn_ffmpeg_frame_writer(
  mut ffmpeg_child: FfmpegChild,
  frame_rx: std::sync::mpsc::Receiver<Vec<u8>>,
  start_writing: Arc<AtomicBool>,
  mut stop_rx: broadcast::Receiver<()>,
  stop_barrier: Arc<Barrier>,
) {
  std::thread::spawn(move || {
    log::info!("Starting ffmpeg writer thread");
    let mut stdin = std::io::BufWriter::new(ffmpeg_child.take_stdin().unwrap());
    loop {
      if stop_rx.try_recv().is_ok() {
        log::info!("Ffmpeg received stop signal");
        break;
      }

      match frame_rx.recv_timeout(Duration::from_millis(100)) {
        Ok(frame) => {
          if start_writing.load(Ordering::SeqCst) {
            let _ = stdin.write_all(&frame);
          }
        }
        Err(std::sync::mpsc::RecvTimeoutError::Timeout) => {
          continue;
        }
        Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => {
          break;
        }
      }
    }

    log::info!("Flushing ffmpeg");
    if let Err(e) = stdin.flush() {
      eprintln!("Failed to flush ffmpeg stdin: {e}");
    }

    log::info!("Dropping stdin");
    drop(stdin); // signals EOF to ffmpeg

    log::info!("Clearing ffmpeg child process resources");
    let _ = ffmpeg_child.wait();

    log::info!("Ffmpeg writer finished");
    stop_barrier.wait();
  });
}

/// Spawn new thread for scap::Capturer to grab and push frames to tx
///
/// Starts capturer
fn spawn_capturer_with_send(
  mut capturer: Capturer,
  frame_tx: std::sync::mpsc::Sender<Vec<u8>>,
  start_writing: Arc<AtomicBool>,
  mut stop_rx: broadcast::Receiver<()>,
) {
  log::info!("Starting screen capturer");
  capturer.start_capture();

  std::thread::spawn(move || {
    // Required as MacOS ScreenCaptureKit only sends frames when data
    // actually changes, at least on application recording
    let mut cached_frame: Option<YUVFrame> = None;

    loop {
      if stop_rx.try_recv().is_ok() {
        log::info!("Screen capturer received stop signal");
        break;
      }

      if start_writing.load(std::sync::atomic::Ordering::SeqCst) {
        let frame: Option<&YUVFrame> =
          match capturer.get_next_frame_or_timeout(Duration::from_millis(10)) {
            Ok(Frame::YUVFrame(frame)) => {
              cached_frame = Some(frame);
              cached_frame.as_ref()
            }
            _ => cached_frame.as_ref(),
          };

        if let Some(frame) = frame {
          let width = frame.width as usize;
          let height = frame.height as usize;

          let mut buffer = Vec::with_capacity(width * height + (width * height / 2));

          // Y plane with stride removal
          for row in 0..height {
            let y_start = row * frame.luminance_stride as usize;
            let y_end = y_start + width;
            buffer.extend_from_slice(&frame.luminance_bytes[y_start..y_end]);
          }

          // Copy UV plane with stride removal (NV12)
          let chroma_height = height / 2;
          for row in 0..chroma_height {
            let uv_start = row * frame.chrominance_stride as usize;
            let uv_end = uv_start + width;
            buffer.extend_from_slice(&frame.chrominance_bytes[uv_start..uv_end]);
          }

          let _ = frame_tx.send(buffer);
        }
      }
    }
  });
}

/// Create and return current recording path
pub fn create_recording_directory(app_handle: &AppHandle) -> PathBuf {
  let recordings_dir = app_handle.path().app_data_dir().unwrap().join("Recordings");
  let timestamp = Local::now().format("%Y-%m-%d_%H-%M-%S").to_string();
  let session_dir = recordings_dir.join(&timestamp);
  let _ = create_dir_all(&session_dir);

  session_dir
}

/// Create and spawn an ffmpeg writer
///
/// When no `frame_rate` provided defaults to `-use_wallclock_as_timestamps`
fn create_ffmpeg_writer(
  file_path: PathBuf,
  width: u32,
  height: u32,
  pixel_format: String,
  frame_rate: Option<String>,
  crop_size: Option<PhysicalSize<f64>>,
  crop_origin: Option<PhysicalPosition<f64>>,
) -> FfmpegChild {
  log::info!(
    "Initializing ffmpeg writer for {}",
    file_path.file_stem().unwrap().to_string_lossy()
  );
  let mut child = FfmpegCommand::new();

  if let Some(ref frame_rate) = frame_rate {
    child.args(["-framerate", frame_rate]);
  } else {
    child.args(["-use_wallclock_as_timestamps", "1"]);
  }

  child
    .realtime()
    .format("rawvideo")
    .pix_fmt(pixel_format)
    .size(width, height)
    .input("-");

  if let (Some(crop_size), Some(crop_origin)) = (crop_size, crop_origin) {
    // Crop
    child.args([
      "-vf",
      &format!(
        "crop={}:{}:{}:{}",
        crop_size.width, crop_size.height, crop_origin.x, crop_origin.y
      ),
    ]);
  }

  #[cfg(target_os = "macos")]
  {
    child.codec_video("h264_videotoolbox");
    child.args(["-b:v", "12000k", "-profile:v", "high"]);
  }

  #[cfg(not(target_os = "macos"))]
  child.codec_video("libx264").crf(20); // Software backed

  #[cfg(target_os = "macos")] // Compatibility with QuickTime
  child.pix_fmt("yuv420p");

  child.output(file_path.to_string_lossy());

  child.spawn().unwrap()
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
  synchronization: StreamSynchronization,
  file_path: PathBuf,
  device_name: String,
) {
  if let Some((device, config)) = get_input_audio_device(device_name.clone()) {
    start_audio_recording(synchronization, file_path, device, config);
  } else {
    eprintln!("Failed to get input audio device: {device_name}");
  }
}

/// Spawn new thread for audio recording
fn start_audio_recording(
  synchronization: StreamSynchronization,
  file_path: PathBuf,
  device: Device,
  config: StreamConfig,
) {
  let file_stem = file_path.file_stem().unwrap().to_string_lossy().to_string();

  log::info!("Building audio stream {file_stem}");
  let (stream, wav_writer) =
    build_audio_into_file_stream(&device, &config, &file_path, synchronization.start_writing);
  stream.play().expect("Failed to start system audio stream");
  log::info!("Audio stream {file_stem} started");

  let mut stop_rx = synchronization.stop_tx.subscribe();
  tauri::async_runtime::spawn(async move {
    let _ = stop_rx.recv().await;
    log::info!("Audio stream {file_stem} received stop signal");

    drop(stream); // cpal has no stop capability, stream cleaned on drop

    let mut writer_lock = wav_writer.lock().unwrap();
    if let Some(writer) = writer_lock.take() {
      writer.finalize().unwrap();
    }

    log::info!("Audio stream {file_stem} has shut down");
    synchronization.stop_barrier.wait();
  });
}

pub fn write_metadata(file_path: PathBuf, metadata: RecordingMetadata) -> tauri::Result<()> {
  let json = serde_json::to_string(&metadata)?;

  let mut file = File::create(file_path)?;
  file.write_all(json.as_bytes())?;

  Ok(())
}
