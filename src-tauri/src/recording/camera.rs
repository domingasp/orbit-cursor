use std::{
  io::Write,
  path::PathBuf,
  process::ChildStdin,
  sync::{
    atomic::{AtomicBool, AtomicUsize},
    Arc, Barrier,
  },
  thread::JoinHandle,
};

use ffmpeg_sidecar::child::FfmpegChild;
use nokhwa::{
  utils::{CameraInfo, FrameFormat},
  CallbackCamera,
};
use once_cell::sync::OnceCell;
use parking_lot::Mutex;

use tokio::sync::broadcast;

use crate::{
  camera::service::{create_camera, get_camera_details},
  recording::{ffmpeg::spawn_rawvideo_ffmpeg, models::StreamSync},
};

/// Mapping from nokhwa to Ffmpeg compatible frame formats
pub fn camera_frame_format_to_ffmpeg(frame_format: FrameFormat) -> &'static str {
  match frame_format {
    FrameFormat::MJPEG => "mjpeg",
    FrameFormat::YUYV => "yuyv422",
    FrameFormat::NV12 => "nv12",
    FrameFormat::GRAY => "gray",
    FrameFormat::RAWRGB => "rgb24",
    FrameFormat::RAWBGR => "bgr24",
  }
}

/// Start camera recorder in a dedicated thread
pub fn start_camera_recorder(
  file_path: PathBuf,
  synchronization: StreamSync,
  camera_name: String,
) -> Option<JoinHandle<()>> {
  let available_cameras = nokhwa::query(nokhwa::utils::ApiBackend::Auto).unwrap();
  if let Some(camera_info) = available_cameras
    .iter()
    .find(|c| c.human_name() == camera_name)
  {
    Some(spawn_camera_recorder(
      file_path,
      camera_info.clone(),
      synchronization,
    ))
  } else {
    log::warn!("Failed to find camera: {camera_name}");
    // Need to mark this as ready even though no device was found
    tauri::async_runtime::spawn_blocking(move || {
      synchronization.ready_barrier.wait();
    });
    None
  }
}

/// Coordinate spawning camera recording thread, conversion, and writing to file
fn spawn_camera_recorder(
  file_path: PathBuf,
  camera_info: CameraInfo,
  synchronization: StreamSync,
) -> JoinHandle<()> {
  let camera_name = camera_info.human_name();
  let log_prefix = format!("[camera:{camera_name}]");

  let (resolution, frame_rate, frame_format) = get_camera_details(camera_info.index().clone());
  let (ffmpeg, stdin) = spawn_rawvideo_ffmpeg(
    &file_path,
    resolution.width(),
    resolution.height(),
    frame_rate,
    camera_frame_format_to_ffmpeg(frame_format).to_string(),
    None,
    log_prefix.clone(),
  );
  let writer = Arc::new(Mutex::new(Some(stdin)));

  let camera = build_camera_stream(
    camera_info,
    writer.clone(),
    synchronization.should_write.clone(),
    synchronization.ready_barrier,
  );

  spawn_camera_thread(
    camera,
    writer,
    synchronization.stop_tx.subscribe(),
    ffmpeg,
    log_prefix,
  )
}

fn build_camera_stream(
  camera_info: CameraInfo,
  writer: Arc<Mutex<Option<ChildStdin>>>,
  should_write: Arc<AtomicBool>,
  ready_barrier: Arc<Barrier>,
) -> CallbackCamera {
  let once = Arc::new(OnceCell::new());
  let skipped_count = Arc::new(AtomicUsize::new(0));

  create_camera(camera_info.index().clone(), move |frame| {
    // Skip a few frames to flush startup frames (black screen)
    if skipped_count.load(std::sync::atomic::Ordering::SeqCst) < 2 {
      skipped_count.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
      return;
    }

    once.get_or_init(|| {
      ready_barrier.wait();
    });

    if !should_write.load(std::sync::atomic::Ordering::SeqCst) {
      return;
    }

    if let Some(writer) = writer.lock().as_mut() {
      let _ = writer.write_all(frame.buffer());
    }
  })
  .unwrap()
}

/// Spawn camera thread for tearing down and finalizing recording
fn spawn_camera_thread(
  mut camera: CallbackCamera,
  writer: Arc<Mutex<Option<ChildStdin>>>,
  mut stop_rx: broadcast::Receiver<()>,
  mut ffmpeg: FfmpegChild,
  log_prefix: String,
) -> JoinHandle<()> {
  std::thread::spawn(move || {
    log::info!("{log_prefix} Starting camera stream");
    let _ = camera.open_stream();

    let _ = stop_rx.blocking_recv();

    log::info!("{log_prefix} Audio stream received stop message, finishing writing");
    let _ = writer.lock().take(); // Closes the stdin pipe allowing shutdown

    log::info!("{log_prefix} Cleaning up audio ffmpeg");
    let _ = ffmpeg.wait();

    log::info!("{log_prefix} Audio ffmpeg finished");
  })
}
