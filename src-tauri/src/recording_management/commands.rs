use sqlx::{Pool, Sqlite};
use tauri::State;

use crate::db::recordings::RecordingDetails;

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
