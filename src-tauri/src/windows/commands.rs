use std::sync::{Mutex, Once};

use tauri::{AppHandle, Emitter, Manager, State};
use tauri_nspanel::ManagerExt;

use crate::{
  constants::{Events, WindowLabel},
  AppState,
};

use super::service::{
  add_close_panel_listener, position_and_size_window, position_window_above_dock,
  swizzle_to_recording_input_options_panel, swizzle_to_standalone_listbox_panel,
};

static INIT_STANDALONE_LISTBOX: Once = Once::new();
static INIT_RECORDING_OPTIONS_PANEL: Once = Once::new();

#[tauri::command]
pub fn init_standalone_listbox(app_handle: AppHandle) {
  INIT_STANDALONE_LISTBOX.call_once(|| {
    swizzle_to_standalone_listbox_panel(&app_handle);
    add_close_panel_listener(
      app_handle,
      WindowLabel::StandaloneListbox,
      Events::RecordingInputOptionsDidResignKey,
      move |_| {},
    );
  });
}

#[tauri::command]
pub fn init_recording_input_options(app_handle: AppHandle) {
  INIT_RECORDING_OPTIONS_PANEL.call_once(|| {
    swizzle_to_recording_input_options_panel(&app_handle);
    add_close_panel_listener(
      app_handle,
      WindowLabel::RecordingInputOptions,
      Events::RecordingInputOptionsDidResignKey,
      move |app_handle| {
        let state: State<'_, Mutex<AppState>> = app_handle.state();
        state.lock().unwrap().recording_input_options_opened = false;
      },
    );
  });
}

#[tauri::command]
pub fn quit_app(app_handle: AppHandle) {
  app_handle.exit(0);
}

#[tauri::command]
pub fn show_standalone_listbox(app_handle: AppHandle, x: f64, y: f64, width: f64, height: f64) {
  let window = app_handle
    .get_webview_window(WindowLabel::StandaloneListbox.as_ref())
    .unwrap();
  position_and_size_window(window, x, y, width, height);

  let panel = app_handle
    .get_webview_panel(WindowLabel::StandaloneListbox.as_ref())
    .unwrap();
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
  position_window_above_dock(&app_handle, WindowLabel::RecordingInputOptions, x);
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
