use crate::APP_HANDLE;

/// Generate and return screenshot for the given display
///
/// `display_id` is the tauri monitor name - it does not provide an id.
pub fn capture_display_screenshot(display_id: String) -> Vec<u8> {
  let app_handle = APP_HANDLE.get().unwrap();

  let display_index = app_handle
    .available_monitors()
    .unwrap()
    .iter()
    .position(|monitor| monitor.name() == Some(&display_id))
    .unwrap_or(0);

  // We assume monitors are deterministically ordered
  let available_monitors = xcap::Monitor::all().unwrap();
  let monitor_to_capture = available_monitors[display_index].clone();

  monitor_to_capture
    .capture_image()
    .unwrap()
    .as_raw()
    .to_vec()
}
