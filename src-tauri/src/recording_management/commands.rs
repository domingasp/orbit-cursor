use sqlx::{Pool, Sqlite};
use tauri::{AppHandle, Manager, State};

use crate::db::recordings::RecordingDetails;

#[tauri::command]
pub async fn get_recording_details(
  app_handle: AppHandle,
  recording_id: i64,
) -> Result<RecordingDetails, String> {
  let pool: State<'_, Pool<Sqlite>> = app_handle.state();
  crate::db::recordings::get_recording_details(&pool, recording_id)
    .await
    .map_err(|e| e.to_string())
}
