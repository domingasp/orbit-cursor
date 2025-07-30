use scap::{
  capturer::{Capturer, Options},
  get_all_targets, Target,
};

use crate::screen_capture::service::get_app_targets;

/// Create and return a capturer with specified target (display, or window)
pub fn create_screen_recording_capturer(target: Option<Target>) -> Capturer {
  log::info!("Fetching screen capturer data");
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

  log::info!("Building screen capturer");
  Capturer::build(options).unwrap()
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
