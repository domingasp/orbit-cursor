use parking_lot::Mutex;
use scap::{
  capturer::{Capturer, Options},
  frame::BGRAFrame,
  get_all_targets, Target,
};
use tauri::State;
use yuv::bgra_to_rgba;

use crate::{models::MagnifierState, windows::commands::APP_WEBVIEW_TITLES};

pub fn init_magnifier_capturer(
  magnifier_state: State<'_, Mutex<MagnifierState>>,
  display_name: String,
) {
  let targets_to_exclude = get_app_targets();
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
    magnifier_state.lock().store_magnifier(capturer);
  }
}

/// Return targets which are part of the app
pub fn get_app_targets() -> Vec<Target> {
  log::info!("Fetching all available targets");
  let targets = get_all_targets();

  log::info!("Filtering available targets");
  targets
    .into_iter()
    .filter(|t| match t {
      Target::Window(window) => APP_WEBVIEW_TITLES
        .get()
        .unwrap_or(&Vec::new())
        .contains(&window.title),
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
