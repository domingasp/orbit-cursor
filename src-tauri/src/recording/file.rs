use std::{
  fs::{create_dir_all, File},
  io::Write,
  path::PathBuf,
};

use chrono::Local;

use crate::recording::models::RecordingMetadata;

/// Create and return current recording path
pub fn create_recording_directory(app_data_dir: PathBuf) -> PathBuf {
  let recordings_dir = app_data_dir.join("Recordings");
  let timestamp = Local::now().format("%Y-%m-%d_%H-%M-%S").to_string();
  let session_dir = recordings_dir.join(&timestamp);
  let _ = create_dir_all(&session_dir);

  session_dir
}

// TODO use

pub fn write_metadata_to_file(
  file_path: PathBuf,
  metadata: RecordingMetadata,
) -> tauri::Result<()> {
  let json = serde_json::to_string(&metadata)?;

  let mut file = File::create(file_path)?;
  file.write_all(json.as_bytes())?;

  Ok(())
}
