use std::path::PathBuf;

use serde::Serialize;
use sqlx::SqlitePool;

use crate::recording::models::RecordingFile;

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

#[derive(Debug, Serialize)]
pub struct RecordingDetails {
  pub id: i64,
  pub screen: PathBuf,
  pub camera: Option<PathBuf>,
  pub system_audio: Option<PathBuf>,
  pub microphone: Option<PathBuf>,
}

pub async fn get_recording_details(
  pool: &SqlitePool,
  recording_id: i64,
) -> sqlx::Result<RecordingDetails> {
  let record = sqlx::query!(
    r#"
    SELECT id, recording_directory, has_camera, has_system_audio, has_microphone
    FROM recordings
    WHERE id = ?
    "#,
    recording_id
  )
  .fetch_one(pool)
  .await?;

  Ok(RecordingDetails {
    id: record.id,
    screen: RecordingFile::Screen.complete_path(&record.recording_directory),
    camera: if record.has_camera != 0 {
      Some(RecordingFile::Camera.complete_path(&record.recording_directory))
    } else {
      None
    },
    system_audio: if record.has_system_audio != 0 {
      Some(RecordingFile::SystemAudio.complete_path(&record.recording_directory))
    } else {
      None
    },
    microphone: if record.has_microphone != 0 {
      Some(RecordingFile::Microphone.complete_path(&record.recording_directory))
    } else {
      None
    },
  })
}
