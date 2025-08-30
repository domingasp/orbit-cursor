use std::path::PathBuf;

use fancy_regex::Regex;
use serde::Serialize;
use sqlx::{types::time::OffsetDateTime, Row, SqlitePool};

use crate::recording::models::{RecordingFile, RecordingType};

pub struct NewRecording<'a> {
  pub recording_directory: &'a str,
  pub origin_x: f64,
  pub origin_y: f64,
  pub scale_factor: f64,
  pub name: String,
  pub has_camera: bool,
  pub has_system_audio: bool,
  pub has_microphone: bool,
  pub has_system_cursor: bool,
  pub r#type: &'a RecordingType,
}

pub async fn insert_recording(pool: &SqlitePool, new: &NewRecording<'_>) -> sqlx::Result<i64> {
  let has_camera = new.has_camera as i32;
  let has_system_audio = new.has_system_audio as i32;
  let has_microphone = new.has_microphone as i32;
  let has_system_cursor = new.has_system_cursor as i32;
  let r#type = new.r#type.to_string();

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
      has_system_cursor,
      name,
      type
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    "#,
    new.recording_directory,
    new.origin_x,
    new.origin_y,
    new.scale_factor,
    has_camera,
    has_system_audio,
    has_microphone,
    has_system_cursor,
    new.name,
    r#type
  )
  .execute(pool)
  .await?;

  Ok(result.last_insert_rowid())
}

pub async fn set_recording_metadata(
  pool: &SqlitePool,
  recording_id: i64,
  bytes: u64,
  milliseconds: Option<u64>,
) -> sqlx::Result<()> {
  let size = bytes as i64;
  let length = milliseconds.map(|ms| ms as i64);

  sqlx::query!(
    r#"
    UPDATE recordings
    SET size = ?, length = ?
    WHERE id = ?
    "#,
    size,
    length,
    recording_id
  )
  .execute(pool)
  .await?;

  Ok(())
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
#[serde(rename_all = "camelCase")]
pub struct RecordingMetadata {
  pub id: i64,
  pub name: String,
  #[serde(with = "time::serde::iso8601")]
  pub created_at: OffsetDateTime,
  #[serde(with = "time::serde::iso8601::option")]
  pub deleted_at: Option<OffsetDateTime>,
  pub size_bytes: Option<i64>,
  pub length_ms: Option<i64>,
  pub r#type: Option<RecordingType>,
  pub has_system_audio: bool,
  pub has_microphone: bool,
  pub has_camera: bool,
  pub has_system_cursor: bool,
}

pub async fn list_recordings(pool: &SqlitePool) -> sqlx::Result<Vec<RecordingMetadata>> {
  let records = sqlx::query!(
    r#"
    SELECT id, name, created_at, size, length, type, has_camera, has_microphone, has_system_audio, has_system_cursor, deleted_at
    FROM recordings
    WHERE size IS NOT NULL AND length IS NOT NULL
    ORDER BY created_at DESC
    "#
  )
  .fetch_all(pool)
  .await?;

  Ok(
    records
      .into_iter()
      .map(|record| RecordingMetadata {
        id: record.id,
        name: record.name,
        created_at: record.created_at,
        deleted_at: record.deleted_at,
        size_bytes: record.size,
        length_ms: record.length,
        r#type: record.r#type.and_then(|s| s.parse().ok()),
        has_system_audio: record.has_system_audio != 0,
        has_microphone: record.has_microphone != 0,
        has_camera: record.has_camera != 0,
        has_system_cursor: record.has_system_cursor != 0,
      })
      .collect(),
  )
}

#[derive(Debug, Serialize)]
pub struct RecordingDetails {
  pub id: i64,
  pub name: String,
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
    SELECT id, name, recording_directory, has_camera, has_system_audio, has_microphone
    FROM recordings
    WHERE id = ?
    "#,
    recording_id
  )
  .fetch_one(pool)
  .await?;

  Ok(RecordingDetails {
    id: record.id,
    name: record.name,
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

pub async fn update_recording_name(
  pool: &SqlitePool,
  recording_id: i64,
  new_name: &str,
) -> sqlx::Result<()> {
  let file_name_re = Regex::new(r#"(?i)^(?!\s)(?!^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\..*)?$)[^<>:"/\\|?*\x00-\x1F]{1,255}(?<!\s)$"#)
    .expect("Valid recording name regex");
  if !file_name_re.is_match(new_name).unwrap_or(false) {
    return Ok(());
  }

  sqlx::query!(
    r#"
    UPDATE recordings
    SET name = ?
    WHERE id = ?
    "#,
    new_name,
    recording_id
  )
  .execute(pool)
  .await?;

  Ok(())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeletedAtResponse {
  #[serde(with = "time::serde::iso8601")]
  deleted_at: OffsetDateTime,
}

pub async fn soft_delete_recordings(
  pool: &SqlitePool,
  recording_ids: Vec<i64>,
) -> sqlx::Result<DeletedAtResponse> {
  if recording_ids.is_empty() {
    return Err(sqlx::Error::RowNotFound);
  }

  let placeholders = vec!["?"; recording_ids.len()].join(", ");
  let query_str = format!(
    r#"
    UPDATE recordings
    SET deleted_at = CURRENT_TIMESTAMP
    WHERE id IN ({placeholders})
    RETURNING deleted_at
    "#
  );

  let mut query = sqlx::query(&query_str);
  for id in &recording_ids {
    query = query.bind(id);
  }

  let result = query.fetch_one(pool).await?;
  let deleted_at: OffsetDateTime = result.try_get("deleted_at")?;

  Ok(DeletedAtResponse { deleted_at })
}

pub async fn hard_delete_recordings(
  pool: &SqlitePool,
  recording_ids: Vec<i64>,
) -> sqlx::Result<Vec<PathBuf>> {
  if recording_ids.is_empty() {
    return Ok(vec![]);
  }

  let placeholders = vec!["?"; recording_ids.len()].join(", ");
  let query_str = format!(
    r#"
    DELETE FROM recordings
    WHERE id IN ({placeholders})
    RETURNING recording_directory
    "#
  );

  let mut query = sqlx::query(&query_str);
  for id in &recording_ids {
    query = query.bind(id);
  }

  let rows = query.fetch_all(pool).await?;
  let dirs = rows
    .into_iter()
    .filter_map(|row| row.try_get::<String, _>("recording_directory").ok())
    .map(PathBuf::from)
    .collect();

  Ok(dirs)
}

pub async fn restore_recordings(pool: &SqlitePool, recording_ids: Vec<i64>) -> sqlx::Result<()> {
  if recording_ids.is_empty() {
    return Err(sqlx::Error::RowNotFound);
  }

  let placeholders = vec!["?"; recording_ids.len()].join(", ");
  let query_str = format!(
    r#"
    UPDATE recordings
    SET deleted_at = NULL
    WHERE id IN ({placeholders})
    "#
  );

  let mut query = sqlx::query(&query_str);
  for id in &recording_ids {
    query = query.bind(id);
  }

  query.execute(pool).await?;

  Ok(())
}
