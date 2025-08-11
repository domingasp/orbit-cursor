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

use nokhwa::{
  utils::{mjpeg_to_rgb, CameraInfo, FrameFormat},
  CallbackCamera,
};
use once_cell::sync::OnceCell;
use parking_lot::Mutex;

use crate::{
  camera::service::{create_camera, get_camera_details},
  recording::{
    ffmpeg::FfmpegInputDetails,
    models::{StreamSync, VideoCaptureDetails},
    video::{create_ffmpeg_writer, spawn_video_cleanup_thread},
  },
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
) -> Option<(JoinHandle<()>, VideoCaptureDetails)> {
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
) -> (JoinHandle<()>, VideoCaptureDetails) {
  let camera_name = camera_info.human_name();
  let log_prefix = format!("[camera:{camera_name}]");

  let (resolution, frame_format) = get_camera_details(camera_info.index().clone());

  let ffmpeg_input_details = FfmpegInputDetails {
    width: resolution.width(),
    height: resolution.height(),
    pixel_format: camera_frame_format_to_ffmpeg(if frame_format == FrameFormat::MJPEG {
      FrameFormat::RAWRGB // MJPEG gets converted to RGB
    } else {
      FrameFormat::YUYV
    })
    .to_string(),
    output_frame_rate: None,
    crop: None,
  };

  let (writer, ffmpeg) =
    create_ffmpeg_writer(&file_path, ffmpeg_input_details.clone(), log_prefix.clone());

  let mut camera = build_camera_stream(
    camera_info,
    writer.clone(),
    synchronization.should_write.clone(),
    synchronization.ready_barrier,
  );

  log::info!("{log_prefix} Starting camera stream");

  // Thread required to keep camera from dropping
  let mut stop_rx_for_camera = synchronization.stop_tx.subscribe();
  std::thread::spawn(move || {
    let _ = camera.open_stream();
    let _ = stop_rx_for_camera.blocking_recv();
  });

  let handle = spawn_video_cleanup_thread(
    synchronization.stop_video_tx.subscribe(),
    writer.clone(),
    ffmpeg,
    log_prefix.clone(),
  );

  (
    handle,
    VideoCaptureDetails {
      writer: writer.clone(),
      ffmpeg_input_details,
      log_prefix,
    },
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
    // Skip a few frames to flush startup frames (black/color flashes)
    if skipped_count.load(std::sync::atomic::Ordering::SeqCst) < 4 {
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
      if frame.source_frame_format() == FrameFormat::MJPEG {
        let rgb = mjpeg_to_rgb(frame.buffer(), false).unwrap();
        let _ = writer.write_all(&rgb);
      } else {
        let _ = writer.write_all(frame.buffer());
      }
    }
  })
  .unwrap()
}
