use serde::{Deserialize, Serialize};
use strum_macros::Display;

#[derive(Debug, Clone, Serialize, Deserialize, Display, PartialEq, Eq, Hash)]
#[serde(rename_all = "camelCase", rename_all_fields = "camelCase")]
#[strum(serialize_all = "camelCase")]
pub enum AudioStream {
  System,
  Input,
}

#[derive(Clone, Serialize)]
#[serde(
  rename_all = "camelCase",
  rename_all_fields = "camelCase",
  tag = "event",
  content = "data"
)]
pub enum AudioStreamChannel {
  Signal { decibels: f32 },
}
