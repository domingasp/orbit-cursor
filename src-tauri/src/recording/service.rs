use std::io::Write;
use std::process::ChildStdin;
use std::sync::atomic::AtomicBool;
use std::sync::Mutex;
use std::thread;
use std::{fs::create_dir_all, path::PathBuf, sync::Arc};

use chrono::Local;
use cpal::traits::StreamTrait;
use cpal::{Device, StreamConfig};
use ffmpeg_sidecar::{child::FfmpegChild, command::FfmpegCommand};
use nokhwa::utils::CameraIndex;
use nokhwa::CallbackCamera;
use scap::capturer::Capturer;
use scap::frame::{BGRAFrame, Frame};
use tauri::async_runtime::JoinHandle;
use tauri::{AppHandle, Manager, PhysicalPosition, PhysicalSize};
use tokio::sync::mpsc::{self};

use crate::audio::service::{
  build_audio_into_file_stream, get_input_audio_device, get_system_audio_device,
};
use crate::camera::service::{create_camera, frame_to_rgba};
use crate::recording::models::{RecordingType, Region, StreamSynchronization};
use crate::recording_sources::commands::list_monitors;
use crate::recording_sources::service::get_visible_windows;
use crate::screen_capture::service::{create_screen_recording_capturer, get_display, get_window};

type ArcOneShotSender = Arc<Mutex<Option<tokio::sync::oneshot::Sender<()>>>>;
type ArcSender = Arc<Mutex<Option<mpsc::Sender<Vec<u8>>>>>;
type CapturerInfo = (
  Arc<Mutex<Capturer>>,
  u32,
  u32,
  Option<PhysicalSize<f64>>,
  Option<PhysicalPosition<f64>>,
);

/// Create and start screen recording thread
pub fn start_screen_recording(
  mut synchronization: StreamSynchronization,
  file_path: PathBuf,
  recording_type: RecordingType,
  app_handle: AppHandle,
  monitor_name: String,
  window_id: Option<u32>,
  region: Region,
) {
  tauri::async_runtime::spawn(async move {
    let (capturer, width, height, crop_size, crop_origin) =
      create_screen_capturer(app_handle, recording_type, monitor_name, window_id, region).await;

    let (frame_tx, frame_tx_arc, frame_rx) = create_frame_channel();

    spawn_capturer_with_send(
      capturer.clone(),
      frame_tx_arc.clone(),
      synchronization.start_writing.clone(),
    );

    let mut ffmpeg_child = create_ffmpeg_writer(
      file_path,
      width,
      height,
      "bgra".to_string(),
      None,
      crop_size,
      crop_origin,
    );
    let ffmpeg_stdin = ffmpeg_child.take_stdin().unwrap();

    let writer = spawn_ffmpeg_frame_writer(
      frame_rx,
      ffmpeg_stdin,
      synchronization.start_writing.clone(),
    );

    synchronization.barrier.wait().await;
    let _ = synchronization.stop_rx.recv().await;

    tear_down_ffmpeg_writer(
      synchronization.start_writing,
      frame_tx,
      frame_tx_arc,
      writer,
      ffmpeg_child,
    )
    .await;

    capturer.lock().unwrap().stop_capture();
  });
}

/// Create screen capturer based on recording type
async fn create_screen_capturer(
  app_handle: AppHandle,
  recording_type: RecordingType,
  monitor_name: String,
  window_id: Option<u32>,
  region: Region,
) -> CapturerInfo {
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

  if let (RecordingType::Window, Some(window_id)) = (recording_type, window_id) {
    let windows = get_visible_windows(None).await;
    let window_details = windows.into_iter().find(|w| w.id == window_id);

    // Details are not the same as scap::Target
    if let Some(window_details) = window_details {
      let window_size = window_details.size.to_physical(scale_factor);
      let window_target = get_window(window_id);

      // Only if we can find the target will we use it, otherwise use default (screen)
      if let Some(window_target) = window_target {
        target = Some(window_target);
        width = window_size.width;
        height = window_size.height;
      }
    }
  } else if recording_type == RecordingType::Region {
    crop_size = Some(region.size.to_physical(scale_factor));
    crop_origin = Some(region.position.to_physical(scale_factor));
  }

  // We don't use scap crop area due to strange behaviour with ffmpeg, instead we crop directly
  // in ffmpeg
  let capturer = create_screen_recording_capturer(app_handle, target);
  let capturer = Arc::new(Mutex::new(capturer));

  (
    capturer,
    width as u32,
    height as u32,
    crop_size,
    crop_origin,
  )
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
    eprintln!("Failed to get input audio device: {}", device_name);
  }
}

/// Spawn new thread for audio recording
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

  let start_writing_for_writer = synchronization.start_writing.clone();
  tauri::async_runtime::spawn(async move {
    // Some cameras (like Macbook webcam) have a startup period.
    // Once camera starts sending first frame one shot is sent and
    // barrier awaited
    let (camera_ready_tx, camera_ready_rx) = tokio::sync::oneshot::channel();
    let camera_ready_tx = Arc::new(Mutex::new(Some(camera_ready_tx)));

    let (frame_tx, frame_tx_arc, frame_rx) = create_frame_channel();

    let mut camera = setup_camera_with_send(
      camera_index,
      camera_ready_tx.clone(),
      frame_tx_arc.clone(),
      start_writing_for_writer,
    );

    let resolution = camera.resolution().unwrap();
    let frame_rate = camera.frame_rate().unwrap();

    let mut ffmpeg_child = create_ffmpeg_writer(
      file_path,
      resolution.width(),
      resolution.height(),
      "rgba".to_string(),
      Some(frame_rate.to_string()),
      None,
      None,
    );
    let ffmpeg_stdin = ffmpeg_child.take_stdin().unwrap();

    let writer = spawn_ffmpeg_frame_writer(
      frame_rx,
      ffmpeg_stdin,
      synchronization.start_writing.clone(),
    );

    let _ = camera.open_stream();
    let _ = camera_ready_rx.await;

    synchronization.barrier.wait().await;
    let _ = synchronization.stop_rx.recv().await;

    tear_down_ffmpeg_writer(
      synchronization.start_writing,
      frame_tx,
      frame_tx_arc,
      writer,
      ffmpeg_child,
    )
    .await;

    let _ = camera.stop_stream();
  });
}

/// Create and return camera which sends RGBA frames to `frame_tx`
fn setup_camera_with_send(
  camera_index: CameraIndex,
  camera_ready_tx: ArcOneShotSender,
  frame_tx: ArcSender,
  start_writing: Arc<AtomicBool>,
) -> CallbackCamera {
  create_camera(camera_index, move |frame| {
    if let Some(tx) = camera_ready_tx.lock().unwrap().take() {
      let _ = tx.send(());
    }

    if let Some(ref tx) = *frame_tx.lock().unwrap() {
      if start_writing.load(std::sync::atomic::Ordering::SeqCst) {
        let _ = tx.try_send(frame_to_rgba(frame));
      }
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

/// Spawn new thread for scap::Capturer to grab and push frames to tx
///
/// Starts capturer
fn spawn_capturer_with_send(
  capturer: Arc<Mutex<Capturer>>,
  tx: ArcSender,
  start_writing: Arc<AtomicBool>,
) {
  thread::spawn(move || {
    capturer.lock().unwrap().start_capture();

    // We cache the last frame with data - ScreenCaptureKit sends empty frames when static
    // this seems to only happen when recording windows rather than the screen
    let mut cached_frame: Option<BGRAFrame> = None;
    loop {
      if let Ok(capturer) = capturer.lock() {
        if let Ok(Frame::BGRA(frame)) = capturer.get_next_frame() {
          if let Some(ref tx) = *tx.lock().unwrap() {
            if start_writing.load(std::sync::atomic::Ordering::SeqCst) {
              if let Err(e) = tx.try_send(if frame.data.is_empty() {
                cached_frame.clone().unwrap().data
              } else {
                cached_frame = Some(frame.clone());
                frame.data
              }) {
                eprintln!("Failed to send frame to writer {}", e);
              }
            }
          }
        }
      }
    }
  });
}

/// Create and return Recordings path
pub fn create_recording_directory(app_handle: &AppHandle) -> PathBuf {
  let recordings_dir = app_handle.path().app_data_dir().unwrap().join("Recordings");
  let timestamp = Local::now().format("%Y-%m-%d_%H-%M-%S").to_string();
  let session_dir = recordings_dir.join(&timestamp);
  let _ = create_dir_all(&session_dir);

  session_dir
}

/// Create and return a channel for frames
fn create_frame_channel() -> (mpsc::Sender<Vec<u8>>, ArcSender, mpsc::Receiver<Vec<u8>>) {
  let (tx, rx) = mpsc::channel::<Vec<u8>>(50);
  let tx_arc = Arc::new(Mutex::new(Some(tx.clone())));
  (tx, tx_arc, rx)
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
  let mut child = FfmpegCommand::new();

  if let Some(ref frame_rate) = frame_rate {
    child.args(["-framerate", frame_rate]);
  } else {
    child.args(["-use_wallclock_as_timestamps", "1"]);
  }

  child
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

  child
    .codec_video("libx264")
    .crf(20)
    .output(file_path.to_string_lossy());

  child.spawn().unwrap()
}

/// Tear down ffmpeg writer ensuring a stable file is created
async fn tear_down_ffmpeg_writer(
  start_writing: Arc<AtomicBool>,
  tx: mpsc::Sender<Vec<u8>>,
  tx_arc: ArcSender,
  writer_thread: JoinHandle<()>,
  mut ffmpeg_child: FfmpegChild,
) {
  start_writing.store(false, std::sync::atomic::Ordering::SeqCst);

  {
    // Dropping sender to ensure writer drops ffmpeg_stdin, signalling end of recording
    let mut locked_tx = tx_arc.lock().unwrap();
    *locked_tx = None;
  }
  drop(tx);

  let _ = writer_thread.await;
  let _ = ffmpeg_child.wait();
}
