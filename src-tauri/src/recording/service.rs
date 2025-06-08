use std::{fs::create_dir_all, path::PathBuf, sync::Arc};

use chrono::Local;
use tauri::{AppHandle, Manager};

use crate::AudioRecordingDetails;

pub fn create_recording_directory(app_handle: &AppHandle) -> PathBuf {
  let recordings_dir = app_handle.path().app_data_dir().unwrap().join("Recordings");
  let timestamp = Local::now().format("%Y-%m-%d_%H-%M-%S").to_string();
  let session_dir = recordings_dir.join(&timestamp);
  let _ = create_dir_all(&session_dir);

  session_dir
}

pub fn stop_audio_writer(recording_details: Option<&AudioRecordingDetails>) {
  if let Some(stream) = recording_details {
    let wav_writer = Arc::clone(&stream.wav_writer);

    {
      let mut writer_lock = wav_writer.lock().unwrap();
      if let Some(writer) = writer_lock.take() {
        writer.finalize().unwrap();
      }
    }
  }
}
