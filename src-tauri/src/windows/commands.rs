use std::sync::Once;

use tauri::{ AppHandle, Emitter };
use tauri_nspanel::ManagerExt;

use super::service::{
  position_and_size_standalone_listbox_panel,
  setup_standalone_listbox_listeners,
  swizzle_to_standalone_listbox_panel,
};

static INIT: Once = Once::new();

#[tauri::command]
pub fn init_standalone_listbox(app_handle: AppHandle) {
  INIT.call_once(|| {
    swizzle_to_standalone_listbox_panel(&app_handle);
    setup_standalone_listbox_listeners(&app_handle);
  });
}

#[tauri::command]
pub fn quit_app(app_handle: AppHandle) {
  app_handle.exit(0);
}

#[tauri::command]
pub fn show_standalone_listbox(app_handle: AppHandle, x: f64, y: f64, width: f64, height: f64) {
  let panel = app_handle.get_webview_panel("standalone_listbox").unwrap();
  position_and_size_standalone_listbox_panel(&app_handle, x, y, width, height);
  panel.show();
}

#[tauri::command]
pub fn show_start_recording_dock(app_handle: &AppHandle) {
  let panel = app_handle.get_webview_panel("start_recording_dock").unwrap();
  panel.order_front_regardless();

  // Showing/hiding doesn't remount component, instead we emit event to UI
  let _ = app_handle
    .emit("start-recording-dock-opened", ())
    .map_err(|e| format!("Failed to emit show-start-recording-dock event: {}", e));
}

#[tauri::command]
pub fn hide_start_recording_dock(app_handle: AppHandle) {
  let panel = app_handle.get_webview_panel("start_recording_dock").unwrap();
  panel.order_out(None);
}
