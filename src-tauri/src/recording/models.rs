use std::sync::{atomic::AtomicBool, Arc};

use serde::{Deserialize, Serialize};
use strum_macros::{AsRefStr, Display, EnumString};
use tauri::{LogicalPosition, LogicalSize};

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Region {
  pub position: LogicalPosition<f64>,
  pub size: LogicalSize<f64>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartRecordingOptions {
  pub system_audio: bool,
  pub recording_type: RecordingType,
  pub monitor_name: String,
  pub window_id: Option<u32>,
  pub region: Region,
  pub input_audio_name: Option<String>,
  pub camera_name: Option<String>,
}

#[derive(Debug, Clone)]
pub struct StreamSynchronization {
  pub start_writing: Arc<AtomicBool>,
  pub stop_tx: tokio::sync::broadcast::Sender<()>,
}

#[derive(EnumString, AsRefStr, Display, Deserialize, Debug, Clone, Copy, PartialEq, Eq, Hash)]
#[serde(rename_all = "lowercase")]
pub enum RecordingType {
  Region,
  Window,
  Screen,
}

#[derive(EnumString, AsRefStr, Display, Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum RecordingFile {
  #[strum(serialize = "screen.mp4")]
  Screen,

  #[strum(serialize = "system_audio.wav")]
  SystemAudio,

  #[strum(serialize = "microphone.wav")]
  InputAudio,

  #[strum(serialize = "camera.mp4")]
  Camera,

  #[strum(serialize = "mouse_events.msgpack")]
  MouseEvents,

  #[strum(serialize = "metadata.json")]
  Metadata,
}

#[derive(Debug, Serialize)]
pub enum MouseEventRecord {
  Move {
    elapsed_ms: u128,
    x: f64,
    y: f64,
  },
  Down {
    elapsed_ms: u128,
    button: rdev::Button,
  },
  Up {
    elapsed_ms: u128,
    button: rdev::Button,
  },
}

#[derive(Debug, Serialize)]
pub struct RecordingMetadata {
  pub recording_origin: LogicalPosition<f64>,
  pub scale_factor: f64,
}
