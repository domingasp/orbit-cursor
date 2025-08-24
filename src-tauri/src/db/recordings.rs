use std::path::PathBuf;

use sqlx::SqlitePool;

pub struct NewRecording<'a> {
  pub recording_directory: &'a str,
  pub origin_x: f64,
  pub origin_y: f64,
  pub scale_factor: f64,
  pub has_camera: bool,
  pub has_system_audio: bool,
  pub has_microphone: bool,
  pub has_system_cursor: bool,
}

pub async fn insert_recording(pool: &SqlitePool, new: &NewRecording<'_>) -> sqlx::Result<i64> {
  let has_camera = new.has_camera as i32;
  let has_system_audio = new.has_system_audio as i32;
  let has_microphone = new.has_microphone as i32;
  let has_system_cursor = new.has_system_cursor as i32;

  let result = sqlx::query!(
    r#"
    INSERT INTO recordings (
      recording_directory,
      origin_x,
      origin_y,
      scale_factor,
      has_camera,
      has_system_audio,
      has_microphone,
      has_system_cursor
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    "#,
    new.recording_directory,
    new.origin_x,
    new.origin_y,
    new.scale_factor,
    has_camera,
    has_system_audio,
    has_microphone,
    has_system_cursor
  )
  .execute(pool)
  .await?;

  Ok(result.last_insert_rowid())
}

pub async fn get_recording_directory(
  pool: &SqlitePool,
  recording_id: i64,
) -> sqlx::Result<PathBuf> {
  let record = sqlx::query!(
    r#"
    SELECT recording_directory
    FROM recordings
    WHERE id = ?
    "#,
    recording_id
  )
  .fetch_one(pool)
  .await?;

  Ok(PathBuf::from(record.recording_directory))
}
