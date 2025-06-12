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
use scap::frame::Frame;
use tauri::async_runtime::JoinHandle;
use tauri::{AppHandle, Manager};
use tokio::sync::mpsc::{self};

use crate::audio::service::{
  build_audio_into_file_stream, get_input_audio_device, get_system_audio_device,
};
use crate::camera::service::{create_camera, frame_to_rgba};
use crate::recording::models::{RecordingType, StreamSynchronization};
use crate::recording_sources::commands::list_monitors;
use crate::screen_capture::service::create_screen_recording_capturer;

type ArcOneShotSender = Arc<Mutex<Option<tokio::sync::oneshot::Sender<()>>>>;
type ArcSender = Arc<Mutex<Option<mpsc::Sender<Vec<u8>>>>>;

/// Create and start screen recording thread
pub fn start_screen_recording(
  mut synchronization: StreamSynchronization,
  file_path: PathBuf,
  recording_type: RecordingType,
  app_handle: AppHandle,
  monitor_name: String,
) {
  let monitors = list_monitors(app_handle.clone());
  let monitor = monitors
    .iter()
    .find(|m| m.name == monitor_name)
    .or_else(|| monitors.first())
    .unwrap();
  let size = monitor.physical_size;

  tauri::async_runtime::spawn(async move {
    let (frame_tx, frame_tx_arc, frame_rx) = create_frame_channel();

    let capturer = create_screen_recording_capturer(app_handle, monitor_name);
    let capturer = Arc::new(Mutex::new(capturer));

    spawn_capturer_with_send(
      capturer.clone(),
      frame_tx_arc.clone(),
      synchronization.start_writing.clone(),
    );

    let mut ffmpeg_child = create_ffmpeg_writer(
      file_path,
      size.width as u32,
      size.height as u32,
      "bgra".to_string(),
      None,
    );
    let ffmpeg_stdin = ffmpeg_child.take_stdin().unwrap();

    let writer = spawn_ffmpeg_frame_writer(
      frame_rx,
      ffmpeg_stdin,
      synchronization.start_writing.clone(),
    );

    synchronization.barrier.wait().await;
    println!("Start {}", Local::now());
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

    loop {
      if let Ok(capturer) = capturer.lock() {
        if let Ok(Frame::BGRA(frame)) = capturer.get_next_frame() {
          if let Some(ref tx) = *tx.lock().unwrap() {
            if start_writing.load(std::sync::atomic::Ordering::SeqCst) {
              if let Err(e) = tx.try_send(frame.data) {
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
) -> FfmpegChild {
  let mut child = FfmpegCommand::new();

  if let Some(frame_rate) = frame_rate {
    child.args(["-framerate", &frame_rate]);
  } else {
    child.args(["-use_wallclock_as_timestamps", "1"]);
  }

  child
    .format("rawvideo")
    .pix_fmt(pixel_format)
    .size(width, height)
    .input("-")
    .codec_video("libx264")
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
