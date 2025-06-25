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

#[derive(Debug, Serialize)]
pub struct RecordingMetadata {
  pub recording_origin: LogicalPosition<f64>,
  pub scale_factor: f64,
}
