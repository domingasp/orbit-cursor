use std::sync::{Mutex, Once};

use tauri::{AppHandle, Emitter, State};
use tauri_nspanel::ManagerExt;

use crate::{
  constants::{Events, WindowLabel},
  AppState,
};

use super::service::{
  position_and_size_standalone_listbox_panel, position_recording_input_options_panel,
  setup_recording_input_options_listener, setup_standalone_listbox_listeners,
  swizzle_to_recording_input_options_panel, swizzle_to_standalone_listbox_panel,
};

static INIT_STANDALONE_LISTBOX: Once = Once::new();
static INIT_RECORDING_OPTIONS_PANEL: Once = Once::new();

#[tauri::command]
pub fn init_standalone_listbox(app_handle: AppHandle) {
  INIT_STANDALONE_LISTBOX.call_once(|| {
    swizzle_to_standalone_listbox_panel(&app_handle);
    setup_standalone_listbox_listeners(&app_handle);
  });
}

#[tauri::command]
pub fn init_recording_input_options(app_handle: AppHandle) {
  INIT_RECORDING_OPTIONS_PANEL.call_once(|| {
    swizzle_to_recording_input_options_panel(&app_handle);
    setup_recording_input_options_listener(&app_handle);
  });
}

#[tauri::command]
pub fn quit_app(app_handle: AppHandle) {
  app_handle.exit(0);
}

#[tauri::command]
pub fn show_standalone_listbox(app_handle: AppHandle, x: f64, y: f64, width: f64, height: f64) {
  let panel = app_handle
    .get_webview_panel(WindowLabel::StandaloneListbox.as_ref())
    .unwrap();
  position_and_size_standalone_listbox_panel(&app_handle, x, y, width, height);
  panel.show();
}

#[tauri::command]
pub fn show_recording_input_options(
  app_handle: AppHandle,
  state: State<'_, Mutex<AppState>>,
  x: f64,
) {
  let mut state = state.lock().unwrap();
  state.recording_input_options_opened = true;

  let panel = app_handle
    .get_webview_panel(WindowLabel::RecordingInputOptions.as_ref())
    .unwrap();
  position_recording_input_options_panel(&app_handle, x);
  panel.order_front_regardless();

  let _ = app_handle
    .emit(Events::RecordingInputOptionsOpened.as_ref(), ())
    .map_err(|e| {
      format!(
        "Failed to emit {} event: {}",
        Events::RecordingInputOptionsOpened.as_ref(),
        e
      )
    });
}

#[tauri::command]
pub fn show_start_recording_dock(app_handle: &AppHandle, state: State<'_, Mutex<AppState>>) {
  let mut state = state.lock().unwrap();
  state.start_recording_dock_opened = true;

  let panel = app_handle
    .get_webview_panel(WindowLabel::StartRecordingDock.as_ref())
    .unwrap();
  panel.order_front_regardless();

  // Showing/hiding doesn't remount component, instead we emit event to UI
  let _ = app_handle
    .emit(Events::StartRecordingDockOpened.as_ref(), ())
    .map_err(|e| {
      format!(
        "Failed to emit {} event: {}",
        Events::StartRecordingDockOpened.as_ref(),
        e
      )
    });
}

#[tauri::command]
pub fn hide_start_recording_dock(app_handle: AppHandle, state: State<'_, Mutex<AppState>>) {
  let mut state = state.lock().unwrap();
  state.start_recording_dock_opened = false;
  state.audio_streams.clear();

  let panel = app_handle
    .get_webview_panel(WindowLabel::StartRecordingDock.as_ref())
    .unwrap();
  panel.order_out(None);
}

#[tauri::command]
pub fn is_start_recording_dock_open(state: State<'_, Mutex<AppState>>) -> bool {
  let state = state.lock().unwrap();
  state.start_recording_dock_opened
}

#[tauri::command]
pub fn is_recording_input_options_open(state: State<'_, Mutex<AppState>>) -> bool {
  let state = state.lock().unwrap();
  state.recording_input_options_opened
}
