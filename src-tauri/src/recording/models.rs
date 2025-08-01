use std::{
  path::PathBuf,
  process::ChildStdin,
  sync::{atomic::AtomicBool, Arc, Barrier},
};

use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use strum_macros::{AsRefStr, Display, EnumString};
use tauri::{LogicalPosition, LogicalSize};
use tokio::sync::broadcast;
use uuid::Uuid;

use crate::recording::ffmpeg::FfmpegInputDetails;

#[derive(Debug, Clone)]
pub struct StreamSync {
  pub should_write: Arc<AtomicBool>,
  // Separate as we stop screen recording anytime we pause/resume
  pub stop_screen_tx: broadcast::Sender<()>,
  pub stop_tx: broadcast::Sender<()>,
  pub ready_barrier: Arc<Barrier>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Region {
  pub position: LogicalPosition<f64>,
  pub size: LogicalSize<f64>,
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
  Microphone,

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
  /// Generate unique file name in format of `[original]-[uuid].[ext]`
  pub fn unique(&self) -> String {
    let filename = self.as_ref();

    let parts: Vec<&str> = filename.rsplitn(2, '.').collect();
    let (ext, prefix) = match &parts[..] {
      [ext, prefix] => (*ext, *prefix),
      _ => ("", filename),
    };

    let uuid = Uuid::new_v4();

    format!("{prefix}-{uuid}.{ext}")
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

#[derive(Debug, Clone)]
pub struct ScreenCaptureDetails {
  pub writer: Arc<Mutex<ChildStdin>>,
  pub ffmpeg_input_details: FfmpegInputDetails,
  pub log_prefix: String,
}
