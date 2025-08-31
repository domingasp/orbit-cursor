use std::{
  fs::create_dir_all,
  path::{Path, PathBuf},
};

use chrono::Local;

/// Create and return current recording path
pub fn create_recording_directory(app_data_dir: PathBuf) -> PathBuf {
  let recordings_dir = app_data_dir.join("Recordings");
  let timestamp = Local::now().format("%Y-%m-%d_%H-%M-%S").to_string();
  let session_dir = recordings_dir.join(&timestamp);
  let _ = create_dir_all(&session_dir);

  session_dir
}

/// Returns total size of folder in bytes
pub fn folder_size_bytes(path: &Path) -> u64 {
  let mut size = 0;

  if path.is_dir() {
    for entry in path.read_dir().unwrap() {
      let entry = entry.unwrap();
      let metadata = entry.metadata().unwrap();

      if metadata.is_file() {
        size += metadata.len();
      } else if metadata.is_dir() {
        size += folder_size_bytes(&entry.path());
      }
    }
  }

  size
}
