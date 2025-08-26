use std::{fs::create_dir_all, path::PathBuf};

use chrono::Local;

/// Create and return current recording path
pub fn create_recording_directory(app_data_dir: PathBuf) -> PathBuf {
  let recordings_dir = app_data_dir.join("Recordings");
  let timestamp = Local::now().format("%Y-%m-%d_%H-%M-%S").to_string();
  let session_dir = recordings_dir.join(&timestamp);
  let _ = create_dir_all(&session_dir);

  session_dir
}
