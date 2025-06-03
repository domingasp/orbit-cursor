use std::sync::Mutex;

use scap::{
  capturer::{Capturer, Options},
  get_all_targets, Target,
};
use tauri::State;

use crate::AppState;

pub fn init_magnifier_capturer(state: State<'_, Mutex<AppState>>) {
  let targets_to_exclude = get_app_targets();

  let options = Options {
    // Update the frame twice a second in the magnifier
    fps: 2,
    target: None, // TODO specify selected display
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

/// Return targets which are part of the app
fn get_app_targets() -> Vec<Target> {
  let targets = get_all_targets();

  let app_window_titles_to_exclude = vec![
    "Start Recording Dock",
    "Recording Source Selector",
    "Region Selector",
    "Standalone ListBox",
    "Recording Input Options",
  ];

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
