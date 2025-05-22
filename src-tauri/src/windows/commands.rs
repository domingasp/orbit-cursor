use std::sync::{Mutex, Once};

use tauri::{AppHandle, Emitter, State};
use tauri_nspanel::ManagerExt;

use crate::{constants::events::START_RECORDING_DOCK_OPENED, AppState};

use super::service::{
  position_and_size_standalone_listbox_panel, setup_standalone_listbox_listeners,
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
pub fn show_start_recording_dock(app_handle: &AppHandle, state: State<'_, Mutex<AppState>>) {
  let mut state = state.lock().unwrap();
  state.start_recording_dock_opened = true;

  let panel = app_handle
    .get_webview_panel("start_recording_dock")
    .unwrap();
  panel.order_front_regardless();

  // Showing/hiding doesn't remount component, instead we emit event to UI
  let _ = app_handle
    .emit(START_RECORDING_DOCK_OPENED, ())
    .map_err(|e| {
      format!(
        "Failed to emit {} event: {}",
        START_RECORDING_DOCK_OPENED, e
      )
    });
}

#[tauri::command]
pub fn hide_start_recording_dock(app_handle: AppHandle, state: State<'_, Mutex<AppState>>) {
  let mut state = state.lock().unwrap();
  state.start_recording_dock_opened = false;
  state.audio_streams.clear();

  let panel = app_handle
    .get_webview_panel("start_recording_dock")
    .unwrap();
  panel.order_out(None);
}

#[tauri::command]
pub fn is_start_recording_dock_open(state: State<'_, Mutex<AppState>>) -> bool {
  let state = state.lock().unwrap();
  state.start_recording_dock_opened
}
