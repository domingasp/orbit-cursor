use std::path::PathBuf;
#[cfg(target_os = "macos")]
use std::process::Command;

use serde::Deserialize;
use tauri::AppHandle;

use crate::export::service::encode_recording;

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
  );

  if options.open_folder_after_export {
    // Open the folder containing exported file
    #[cfg(target_os = "macos")]
    let _ = Command::new("open")
      .arg(options.destination_file_path.parent().unwrap())
      .status();

    #[cfg(target_os = "windows")]
    unimplemented!("Windows does not support opening folders after export")
  }
}
