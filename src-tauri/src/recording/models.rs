use std::{
  path::{Path, PathBuf},
  sync::{atomic::AtomicBool, Arc},
};

use serde::{Deserialize, Serialize};
use strum_macros::{AsRefStr, Display, EnumString};
use tauri::{LogicalPosition, LogicalSize};
use uuid::Uuid;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Region {
  pub position: LogicalPosition<f64>,
  pub size: LogicalSize<f64>,
}

#[derive(Debug, Clone)]
pub struct StreamSynchronization {
  pub start_writing: Arc<AtomicBool>,
  pub stop_tx: tokio::sync::broadcast::Sender<()>,
  pub stop_barrier: Arc<std::sync::Barrier>,
}

#[derive(EnumString, AsRefStr, Display, Deserialize, Debug, Clone, Copy, PartialEq, Eq, Hash)]
#[serde(rename_all = "lowercase")]
pub enum RecordingType {
  Region,
  Window,
  Screen,
}

#[derive(Debug, Serialize)]
pub struct RecordingMetadata {
  pub recording_origin: LogicalPosition<f64>,
  pub scale_factor: f64,
}

#[derive(EnumString, AsRefStr, Display, Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize)]
pub enum RecordingFile {
  #[strum(serialize = "screen.mp4")]
  #[serde(rename = "screen.mp4")]
  Screen,

  #[strum(serialize = "system_audio.wav")]
  #[serde(rename = "system_audio.wav")]
  SystemAudio,

  #[strum(serialize = "microphone.wav")]
  #[serde(rename = "microphone.wav")]
  InputAudio,

  #[strum(serialize = "camera.mp4")]
  #[serde(rename = "camera.mp4")]
  Camera,

  #[strum(serialize = "mouse_events.msgpack")]
  #[serde(rename = "mouse_events.msgpack")]
  MouseEvents,

  #[strum(serialize = "metadata.json")]
  #[serde(rename = "metadata.json")]
  Metadata,
}

impl RecordingFile {
  fn base_name(&self) -> &'static str {
    match self {
      RecordingFile::Screen => "screen",
      _ => todo!(),
    }
  }

  fn extension(&self) -> &'static str {
    match self {
      RecordingFile::Screen => "mp4",
      _ => todo!(),
    }
  }

  /// Append uuid to name and create full path
  pub fn segment_path(&self, dir: &Path) -> PathBuf {
    let uuid = Uuid::new_v4();
    dir.join(format!(
      "{}-{}.{}",
      self.base_name(),
      uuid,
      self.extension()
    ))
  }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecordingManifest {
  pub directory: PathBuf,
  pub files: RecordingFileSet,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecordingFileSet {
  pub screen: RecordingFile,
  pub metadata: RecordingFile,
  pub mouse_events: RecordingFile,
  pub system_audio: Option<RecordingFile>,
  pub camera: Option<RecordingFile>,
  pub microphone: Option<RecordingFile>,
}

impl Default for RecordingFileSet {
  fn default() -> Self {
    Self {
      screen: RecordingFile::Screen,
      metadata: RecordingFile::Metadata,
      mouse_events: RecordingFile::MouseEvents,
      system_audio: None,
      camera: None,
      microphone: None,
    }
  }
}
