use std::path::PathBuf;

use parking_lot::Mutex;
use serde::Deserialize;
use tauri::{AppHandle, Manager, State};

use crate::{
  export::service::{self, encode_recording},
  models::EditingState,
};

#[tauri::command]
pub fn open_path_in_file_browser(path: PathBuf) {
  service::open_path_in_file_browser(path);
}

#[tauri::command]
pub fn path_exists(path: String) -> bool {
  std::path::Path::new(&path).exists()
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportOptions {
  pub source_folder_path: PathBuf,
  pub destination_file_path: PathBuf,
  pub open_folder_after_export: bool,
  pub separate_audio_tracks: bool,
  pub separate_camera_file: bool,
}
#[tauri::command]
pub async fn export_recording(app_handle: AppHandle, options: ExportOptions) {
  encode_recording(
    app_handle,
    options.source_folder_path,
    options.destination_file_path.clone(),
    options.separate_audio_tracks,
    options.separate_camera_file,
    options.open_folder_after_export,
  );
}

#[tauri::command]
pub async fn cancel_export(app_handle: AppHandle) {
  let editing_state: State<'_, Mutex<EditingState>> = app_handle.state();

  if let Some(export_process) = editing_state.lock().take_export_process() {
    tauri::async_runtime::spawn_blocking(move || {
      let mut export_process_guard = export_process.lock();
      let _ = export_process_guard.kill();
      let _ = export_process_guard.wait(); // Clean up resources
    });
  };
}
