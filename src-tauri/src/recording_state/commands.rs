use std::sync::Mutex;

use chrono::Local;
use tauri::{AppHandle, State};
use tauri_nspanel::ManagerExt;

use crate::{constants::WindowLabel, AppState};

#[tauri::command]
pub fn start_recording(app_handle: AppHandle, state: State<'_, Mutex<AppState>>) {
  if let Ok(mut state) = state.lock() {
    state.is_recording = true;
  }

  let recording_dock = app_handle
    .get_webview_panel(WindowLabel::RecordingDock.as_ref())
    .unwrap();
  recording_dock.order_front_regardless();
}

#[tauri::command]
pub fn stop_recording(app_handle: AppHandle, state: State<'_, Mutex<AppState>>) {
  if let Ok(mut state) = state.lock() {
    state.is_recording = false;
  }

  println!("Stopped at: {}", Local::now().format("%Y-%m-%d %H:%M:%S"));

  let recording_dock = app_handle
    .get_webview_panel(WindowLabel::RecordingDock.as_ref())
    .unwrap();
  recording_dock.order_out(None);
}
