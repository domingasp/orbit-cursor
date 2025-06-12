use std::sync::{atomic::AtomicBool, Arc};

use serde::Deserialize;
use strum_macros::{AsRefStr, Display, EnumString};
use tokio::sync::{broadcast::Receiver, Barrier};

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartRecordingOptions {
  pub system_audio: bool,
  pub recording_type: RecordingType,
  pub monitor_name: String,
  pub input_audio_name: Option<String>,
  pub camera_name: Option<String>,
}

#[derive(Debug)]
pub struct StreamSynchronization {
  pub start_writing: Arc<AtomicBool>,
  pub barrier: Arc<Barrier>,
  pub stop_rx: Receiver<()>,
}

#[derive(EnumString, AsRefStr, Display, Deserialize, Debug, Clone, Copy, PartialEq, Eq, Hash)]
#[serde(rename_all = "lowercase")]
pub enum RecordingType {
  Region,
  Window,
  Screen,
}
