use std::sync::Mutex;

use scap::{
  capturer::{Capturer, Options},
  frame::BGRAFrame,
  get_all_targets, Target,
};
use tauri::{AppHandle, Manager, State};
use yuv::bgra_to_rgba;

use crate::AppState;

pub fn init_magnifier_capturer(
  app_handle: AppHandle,
  state: State<'_, Mutex<AppState>>,
  display_name: String,
) {
  let targets_to_exclude = get_app_targets(app_handle);
  let display = get_display(display_name);

  let options = Options {
    // Update the frame twice a second in the magnifier
    fps: 2,
    target: display,
    show_cursor: false,
    show_highlight: false,
    excluded_targets: Some(targets_to_exclude),
    output_type: scap::frame::FrameType::BGRAFrame,
    ..Default::default()
  };

  if let Ok(capturer) = Capturer::build(options) {
    if let Ok(mut state) = state.lock() {
      state.magnifier_capturer = Some(capturer);
    }
  }
}

/// Create and return a capturer with specified target (display, or window)
pub fn create_screen_recording_capturer(app_handle: AppHandle, target: Option<Target>) -> Capturer {
  let targets_to_exclude = get_app_targets(app_handle);

  let options = Options {
    fps: 60,
    target,
    show_cursor: false,
    show_highlight: false,
    excluded_targets: Some(targets_to_exclude),
    output_type: scap::frame::FrameType::BGRAFrame,
    ..Default::default()
  };

  Capturer::build(options).unwrap()
}

/// Return targets which are part of the app
fn get_app_targets(app_handle: AppHandle) -> Vec<Target> {
  let targets = get_all_targets();

  let app_window_titles_to_exclude: Vec<String> = app_handle
    .webview_windows()
    .iter()
    .map(|w| w.1.title().unwrap())
    .collect();

  targets
    .into_iter()
    .filter(|t| match t {
      Target::Window(window) => app_window_titles_to_exclude
        .iter()
        .any(|title| window.title == *title),
      _ => false,
    })
    .collect()
}

/// Return display from name
pub fn get_display(display_name: String) -> Option<Target> {
  let targets = get_all_targets();

  targets.into_iter().find(|t| {
    if let Target::Display(target) = t {
      target.title == display_name
    } else {
      false
    }
  })
}

/// Return window from id (scap::Target id)
pub fn get_window(window_id: u32) -> Option<Target> {
  let targets = get_all_targets();

  targets.into_iter().find(|t| {
    if let Target::Window(target) = t {
      target.id == window_id
    } else {
      false
    }
  })
}

pub fn bgra_frame_to_rgba_buffer(bgra_frame: BGRAFrame) -> Vec<u8> {
  let width = bgra_frame.width as u32;
  let height = bgra_frame.height as u32;
  let mut rgba_buffer = vec![0u8; (width * height * 4) as usize];
  if let Err(_e) = bgra_to_rgba(
    &bgra_frame.data,
    width * 4,
    &mut rgba_buffer,
    width * 4,
    width,
    height,
  ) {}

  rgba_buffer
}
