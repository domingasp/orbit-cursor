use scap::{get_all_targets, Target};

use crate::windows::commands::APP_WEBVIEW_TITLES;

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
pub fn get_display_scap_target(display_name: String) -> Option<Target> {
  let targets = get_all_targets();

  targets.into_iter().find(|t| {
    if let Target::Display(target) = t {
      target.title == display_name
    } else {
      false
    }
  })
}
