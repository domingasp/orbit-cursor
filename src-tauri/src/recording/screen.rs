use std::{
  io::Write,
  path::PathBuf,
  process::ChildStdin,
  sync::{atomic::AtomicBool, Arc, Barrier},
  thread::JoinHandle,
  time::Duration,
};

use ffmpeg_sidecar::child::FfmpegChild;
use once_cell::sync::OnceCell;
use parking_lot::Mutex;
use scap::{
  capturer::{Capturer, Options},
  frame::{Frame, YUVFrame},
  get_all_targets, Target,
};
use tauri::{LogicalPosition, PhysicalPosition, PhysicalSize};
use tokio::sync::broadcast;

use crate::{
  recording::{
    ffmpeg::{spawn_rawvideo_ffmpeg, FfmpegInputDetails},
    models::{RecordingType, Region, StreamSync},
  },
  recording_sources::{commands::list_monitors, service::get_visible_windows},
  screen_capture::service::{get_app_targets, get_display},
  APP_HANDLE,
};

struct CapturerInfo {
  capturer: Capturer,
  width: u32,
  height: u32,
  crop: Option<(PhysicalSize<f64>, PhysicalPosition<f64>)>,
  recording_origin: LogicalPosition<f64>,
  scale_factor: f64,
}

/// Start screen recorder in a dedicated thread
pub fn start_screen_recorder(
  file_path: PathBuf,
  recording_type: RecordingType,
  monitor_name: String,
  window_id: Option<u32>,
  region: Region,
  synchronization: StreamSync,
) -> (JoinHandle<()>, LogicalPosition<f64>, f64) {
  let log_prefix = "[screen]";

  let CapturerInfo {
    mut capturer,
    width,
    height,
    crop,
    recording_origin,
    scale_factor,
  } = create_screen_recorder(recording_type, monitor_name, window_id, region);

  let (ffmpeg, stdin) = spawn_rawvideo_ffmpeg(
    &file_path,
    FfmpegInputDetails {
      width,
      height,
      frame_rate: 60,
      pixel_format: "nv12".to_string(), // Hardware safe
      wallclock_timestamps: true,
    },
    crop,
    log_prefix.to_string(),
  );
  let writer = Arc::new(Mutex::new(stdin));

  log::info!("{log_prefix} Starting screen stream");
  capturer.start_capture();
  build_capturer_stream(
    capturer,
    writer,
    synchronization.should_write.clone(),
    synchronization.stop_tx.subscribe(),
    synchronization.ready_barrier,
  );

  (
    spawn_screen_thread(
      synchronization.stop_tx.subscribe(),
      ffmpeg,
      log_prefix.to_string(),
    ),
    recording_origin,
    scale_factor,
  )
}

fn create_screen_recorder(
  recording_type: RecordingType,
  monitor_name: String,
  window_id: Option<u32>,
  region: Region,
) -> CapturerInfo {
  let (monitor_position, monitor_size, scale_factor) = get_monitor_details(&monitor_name);

  // Default to selected monitor
  let mut target = get_display(monitor_name);
  let mut width = monitor_size.width;
  let mut height = monitor_size.height;

  let mut recording_origin = monitor_position;

  if let (RecordingType::Window, Some(window_id)) = (recording_type, window_id) {
    if let Some((window_target, window_width, window_height, window_position)) =
      get_window_target(window_id)
    {
      target = Some(window_target);
      width = window_width;
      height = window_height;
      recording_origin = window_position;
    }
  }

  let mut crop: Option<(PhysicalSize<f64>, PhysicalPosition<f64>)> = None;
  if recording_type == RecordingType::Region {
    // We don't use scap crop area due to strange behaviour with ffmpeg, instead we crop directly
    // in ffmpeg
    crop = Some((
      region.size.to_physical(scale_factor),
      region.position.to_physical(scale_factor),
    ));
    recording_origin = region.position;
  }

  CapturerInfo {
    capturer: create_scap_capturer(target),
    width: width as u32,
    height: height as u32,
    crop,
    recording_origin,
    scale_factor,
  }
}

/// Get monitor details by name, return position, size, and scale_factor
fn get_monitor_details(monitor_name: &str) -> (LogicalPosition<f64>, PhysicalSize<f64>, f64) {
  let app_handle = APP_HANDLE.get().unwrap();
  let monitors = list_monitors(app_handle.clone());
  let monitor = monitors
    .iter()
    .find(|m| m.name == monitor_name)
    .or_else(|| monitors.first())
    .unwrap();

  let position = monitor.position;
  let size = monitor.physical_size;
  let scale_factor = monitor.scale_factor;

  (position, size, scale_factor)
}

fn get_window_target(window_id: u32) -> Option<(Target, f64, f64, LogicalPosition<f64>)> {
  let app_handle = APP_HANDLE.get().unwrap();
  let windows = get_visible_windows(app_handle.clone().available_monitors().unwrap(), None);
  let window_details = windows.into_iter().find(|w| w.id == window_id)?;

  let size: PhysicalSize<f64> = window_details.size.to_physical(window_details.scale_factor);
  let target = get_window(window_id)?;

  Some((
    target,
    size.width as f64,
    size.height as f64,
    window_details.position,
  ))
}

/// Create and return a capturer with specified target (display, or window)
fn create_scap_capturer(target: Option<Target>) -> Capturer {
  let targets_to_exclude = get_app_targets();

  let options = Options {
    fps: 60,
    target,
    show_cursor: false,
    show_highlight: false,
    excluded_targets: Some(targets_to_exclude),
    output_type: scap::frame::FrameType::YUVFrame,
    ..Default::default()
  };

  Capturer::build(options).unwrap()
}

fn build_capturer_stream(
  capturer: Capturer,
  writer: Arc<Mutex<ChildStdin>>,
  should_write: Arc<AtomicBool>,
  mut stop_rx: broadcast::Receiver<()>,
  ready_barrier: Arc<Barrier>,
) {
  std::thread::spawn(move || {
    let once = Arc::new(OnceCell::new());

    // Required as MacOS ScreenCaptureKit only sends frames when data
    // actually changes, at least on application recording
    let mut cached_frame: Option<YUVFrame> = None;

    loop {
      if stop_rx.try_recv().is_ok() {
        log::info!("Screen recorder received stop signal");
        break;
      }

      let frame: Option<&YUVFrame> =
        match capturer.get_next_frame_or_timeout(Duration::from_millis(1)) {
          Ok(Frame::YUVFrame(frame)) => {
            once.get_or_init(|| ready_barrier.wait());
            cached_frame = Some(frame);
            cached_frame.as_ref()
          }
          _ => cached_frame.as_ref(),
        };

      if should_write.load(std::sync::atomic::Ordering::SeqCst) {
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

          let _ = writer.lock().write_all(&buffer);
        }
      }
    }
  });
}

/// Spawn screen thread for starting/tearing down and finalizing recording
fn spawn_screen_thread(
  mut stop_rx: broadcast::Receiver<()>,
  mut ffmpeg: FfmpegChild,
  log_prefix: String,
) -> JoinHandle<()> {
  std::thread::spawn(move || {
    let _ = stop_rx.blocking_recv();

    log::info!("{log_prefix} Cleaning up screen ffmpeg");
    let _ = ffmpeg.wait();

    log::info!("{log_prefix} Screen ffmpeg finished");
  })
}

/// Return window from id (scap::Target id)
fn get_window(window_id: u32) -> Option<Target> {
  let targets = get_all_targets();

  targets.into_iter().find(|t| {
    if let Target::Window(target) = t {
      target.id == window_id
    } else {
      false
    }
  })
}
