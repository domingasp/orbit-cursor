use std::io::Write;
use std::process::ChildStdin;
use std::sync::atomic::AtomicBool;
use std::sync::{Arc, Barrier};
use std::time::Duration;
use std::{path::PathBuf, thread::JoinHandle};

use once_cell::sync::OnceCell;
use parking_lot::Mutex;
use scap::capturer::Options;
use scap::frame::Frame;
use scap::get_all_targets;
use scap::{capturer::Capturer, Target};
use tauri::{LogicalPosition, PhysicalPosition, PhysicalSize};
use tokio::sync::broadcast;

use crate::recording::ffmpeg::FfmpegInputDetails;
use crate::recording::video::{create_ffmpeg_writer, spawn_video_cleanup_thread};
use crate::screen_capture::service::get_app_targets;
use crate::{
  recording::models::{RecordingType, Region, StreamSync, VideoCaptureDetails},
  recording_sources::{commands::list_monitors, service::get_os_visible_windows},
  screen_capture::service::get_display_scap_target,
  APP_HANDLE,
};

struct CapturerInfo {
  capturer: Capturer,
  width: u32,
  height: u32,
  crop: Option<(PhysicalSize<f64>, PhysicalPosition<f64>)>,
  recording_origin: LogicalPosition<f64>,
  scale_factor: f64,
  // Optional final output size after filters (e.g. crop + scale)
  output_size: Option<(u32, u32)>,
}

pub fn start_screen_recorder(
  file_path: PathBuf,
  recording_type: RecordingType,
  monitor_name: String,
  window_id: Option<u32>,
  region: Region,
  synchronization: StreamSync,
) -> (
  JoinHandle<()>,
  VideoCaptureDetails,
  LogicalPosition<f64>,
  f64,
) {
  let log_prefix = "[screen]";

  let CapturerInfo {
    mut capturer,
    width,
    height,
    crop,
    recording_origin,
    scale_factor,
    output_size,
  } = create_screen_recorder(recording_type, monitor_name, window_id, region);

  let ffmpeg_input_details = FfmpegInputDetails {
    width,
    height,
    pixel_format: if cfg!(target_os = "macos") {
      "nv12".to_string()
    } else {
      "bgra".to_string()
    },
    output_frame_rate: Some(60),
    crop,
    output_size,
  };

  let (writer, ffmpeg) = create_ffmpeg_writer(
    &file_path,
    ffmpeg_input_details.clone(),
    log_prefix.to_string(),
  );

  log::info!("{log_prefix} Starting screen stream");
  capturer.start_capture();
  build_capturer_stream(
    capturer,
    writer.clone(),
    synchronization.should_write.clone(),
    synchronization.stop_tx.subscribe(),
    synchronization.ready_barrier,
  );

  (
    spawn_video_cleanup_thread(
      synchronization.stop_video_tx.subscribe(),
      writer.clone(),
      ffmpeg,
      log_prefix.to_string(),
    ),
    VideoCaptureDetails {
      writer: writer.clone(),
      ffmpeg_input_details,
      log_prefix: log_prefix.to_string(),
    },
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

  let mut target = get_display_scap_target(monitor_name);
  let mut width = monitor_size.width;
  let mut height = monitor_size.height;
  let mut recording_origin = monitor_position;
  let mut crop: Option<(PhysicalSize<f64>, PhysicalPosition<f64>)> = None;

  #[cfg(target_os = "windows")]
  let mut output_size: Option<(u32, u32)> = None;
  #[cfg(not(target_os = "windows"))]
  let output_size: Option<(u32, u32)> = None;

  if let (RecordingType::Window, Some(window_id)) = (recording_type, window_id) {
    if let Some((window_target, window_width, window_height, window_position)) =
      get_window_target(window_id)
    {
      // Crop out only invisible margins (keep title bar), using EFB (Extended Frame Bounds)
      #[cfg(target_os = "windows")]
      if let Some((_ox, _oy, cw, ch)) = get_efb_crop_for_window(&window_target) {
        // Use a zero offset so we crop from the top-left; this avoids shifting and black bars.
        crop = Some((
          PhysicalSize {
            width: cw as f64,
            height: ch as f64,
          },
          PhysicalPosition { x: 0.0, y: 0.0 },
        ));
        // Keep final output at the intended window size; ffmpeg -s will upscale as needed
        output_size = Some((window_width as u32, window_height as u32));
      }

      target = Some(window_target);
      width = window_width;
      height = window_height;
      recording_origin = window_position;
    }
  }

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
    output_size,
  }
}

#[cfg(target_os = "windows")]
/// Compute crop information using EFB (Extended Frame Bounds).
fn get_efb_crop_for_window(target: &Target) -> Option<(i32, i32, i32, i32)> {
  use windows::Win32::Foundation::RECT;
  use windows::Win32::Graphics::Dwm::{DwmGetWindowAttribute, DWMWA_EXTENDED_FRAME_BOUNDS};
  use windows::Win32::UI::WindowsAndMessaging::GetWindowRect;

  if let Target::Window(win) = target {
    let hwnd = win.raw_handle.get_handle();
    unsafe {
      let mut win_rect = RECT::default();
      if GetWindowRect(hwnd, &mut win_rect).is_err() {
        return None;
      }

      let mut efb: RECT = RECT::default();
      if DwmGetWindowAttribute(
        hwnd,
        DWMWA_EXTENDED_FRAME_BOUNDS,
        &mut efb as *mut _ as *mut _,
        std::mem::size_of::<RECT>() as u32,
      )
      .is_err()
      {
        return None;
      }

      let ox = efb.left - win_rect.left;
      let oy = efb.top - win_rect.top;
      let cw = efb.right - efb.left;
      let ch = efb.bottom - efb.top;
      if cw > 0 && ch > 0 {
        Some((ox, oy, cw, ch))
      } else {
        None
      }
    }
  } else {
    None
  }
}

fn get_monitor_details(monitor_name: &str) -> (LogicalPosition<f64>, PhysicalSize<f64>, f64) {
  let app_handle = APP_HANDLE.get().unwrap();
  let monitors = list_monitors(app_handle.clone());
  let monitor = monitors
    .iter()
    .find(|m| m.name == monitor_name)
    .or_else(|| monitors.first())
    .unwrap();

  (
    monitor.position,
    monitor.physical_size,
    monitor.scale_factor,
  )
}

fn get_window_target(window_id: u32) -> Option<(Target, f64, f64, LogicalPosition<f64>)> {
  #[cfg(target_os = "macos")]
  let visible_windows = {
    let app_handle = APP_HANDLE.get().unwrap();
    get_os_visible_windows(&app_handle.clone().available_monitors().unwrap())
  };

  #[cfg(target_os = "windows")]
  let visible_windows = get_os_visible_windows();

  let window_metadata = visible_windows.into_iter().find(|w| w.id == window_id)?;
  let size: PhysicalSize<f64> = window_metadata
    .size
    .to_physical(window_metadata.scale_factor);
  let target = get_window(window_id)?;
  Some((
    target,
    size.width as f64,
    size.height as f64,
    window_metadata.position,
  ))
}

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

fn create_scap_capturer(target: Option<Target>) -> Capturer {
  let targets_to_exclude = get_app_targets();
  let options = Options {
    fps: 60,
    target,
    show_cursor: false,
    show_highlight: false,
    excluded_targets: Some(targets_to_exclude),
    output_type: if cfg!(target_os = "macos") {
      scap::frame::FrameType::YUVFrame
    } else {
      scap::frame::FrameType::BGRAFrame
    },
    ..Default::default()
  };

  Capturer::build(options).unwrap()
}

fn build_capturer_stream(
  mut capturer: Capturer,
  writer: Arc<Mutex<Option<ChildStdin>>>,
  should_write: Arc<AtomicBool>,
  mut stop_rx: broadcast::Receiver<()>,
  ready_barrier: Arc<Barrier>,
) {
  std::thread::spawn(move || {
    let once = Arc::new(OnceCell::new());

    // Required as MacOS ScreenCaptureKit only sends frames when data
    // actually changes, at least on application recording
    let mut cached_frame: Option<Vec<u8>> = None;

    loop {
      if stop_rx.try_recv().is_ok() {
        log::info!("Screen recorder received stop signal");
        capturer.stop_capture();
        break;
      }

      let frame_buffer = match capturer.get_next_frame_or_timeout(Duration::from_micros(16_667)) {
        Ok(Frame::YUVFrame(frame)) => {
          once.get_or_init(|| ready_barrier.wait());
          let width = frame.width as usize;
          let height = frame.height as usize;

          let mut buffer = Vec::with_capacity(width * height + (width * height / 2));
          for row in 0..height {
            let y_start = row * frame.luminance_stride as usize;
            buffer.extend_from_slice(&frame.luminance_bytes[y_start..y_start + width]);
          }

          let chroma_height = height / 2;
          for row in 0..chroma_height {
            let uv_start = row * frame.chrominance_stride as usize;
            buffer.extend_from_slice(&frame.chrominance_bytes[uv_start..uv_start + width]);
          }

          cached_frame = Some(buffer.clone());
          Some(buffer)
        }
        Ok(Frame::BGRA(frame)) => {
          once.get_or_init(|| ready_barrier.wait());
          let buffer = frame.data;
          cached_frame = Some(buffer.clone());
          Some(buffer)
        }
        _ => cached_frame.clone(),
      };

      if should_write.load(std::sync::atomic::Ordering::SeqCst) {
        if let (Some(buffer), Some(writer)) = (frame_buffer, writer.lock().as_mut()) {
          let _ = writer.write_all(&buffer);
        }
      }
    }
  });
}
