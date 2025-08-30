use sqlx::{Pool, Sqlite};
use tauri::State;

use crate::db::recordings::{RecordingDetails, RecordingMetadata};

#[tauri::command]
pub async fn list_recordings(
  pool: State<'_, Pool<Sqlite>>,
) -> Result<Vec<RecordingMetadata>, String> {
  crate::db::recordings::list_recordings(&pool)
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_recording_details(
  pool: State<'_, Pool<Sqlite>>,
  recording_id: i64,
) -> Result<RecordingDetails, String> {
  crate::db::recordings::get_recording_details(&pool, recording_id)
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_recording_name(
  pool: State<'_, Pool<Sqlite>>,
  recording_id: i64,
  new_name: String,
) -> Result<(), String> {
  crate::db::recordings::update_recording_name(&pool, recording_id, &new_name)
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn soft_delete_recordings(
  pool: State<'_, Pool<Sqlite>>,
  recording_ids: Vec<i64>,
) -> Result<crate::db::recordings::DeletedAtResponse, String> {
  crate::db::recordings::soft_delete_recordings(&pool, recording_ids)
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn hard_delete_recordings(
  pool: State<'_, Pool<Sqlite>>,
  recording_ids: Vec<i64>,
) -> Result<(), String> {
  let dirs = crate::db::recordings::hard_delete_recordings(&pool, recording_ids)
    .await
    .map_err(|e| e.to_string())?;

  for dir in dirs {
    if let Err(e) = tokio::fs::remove_dir_all(&dir).await {
      eprintln!("Failed to delete recording directory {dir:?}: {e}");
    }
  }

  Ok(())
}

#[tauri::command]
pub async fn restore_recordings(
  pool: State<'_, Pool<Sqlite>>,
  recording_ids: Vec<i64>,
) -> Result<(), String> {
  crate::db::recordings::restore_recordings(&pool, recording_ids)
    .await
    .map_err(|e| e.to_string())
}
