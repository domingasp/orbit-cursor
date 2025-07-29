// TODO use

use scap::capturer::Capturer;
use tauri::{AppHandle, LogicalPosition, PhysicalPosition, PhysicalSize};

use crate::{
  recording::models::{RecordingType, Region},
  recording_sources::{commands::list_monitors, service::get_visible_windows},
  screen_capture::service::{create_screen_recording_capturer, get_display, get_window},
};

type CapturerInfo = (
  Capturer,
  u32,
  u32,
  Option<PhysicalSize<f64>>,
  Option<PhysicalPosition<f64>>,
  LogicalPosition<f64>,
  f64,
);

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
