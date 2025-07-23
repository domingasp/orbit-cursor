use std::path::PathBuf;

use serde::Deserialize;
use tauri::AppHandle;

use crate::export::service::{self, encode_recording};

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
  let output_path = encode_recording(
    app_handle,
    options.source_folder_path,
    options.destination_file_path.clone(),
    options.separate_audio_tracks,
    options.separate_camera_file,
  );

  if options.open_folder_after_export {
    service::open_path_in_file_browser(output_path);
  }
}
