use std::{
  fs::File,
  io::BufWriter,
  sync::{Arc, Mutex},
};

use hound::WavWriter;
use serde::{Deserialize, Serialize};
use strum_macros::Display;

#[derive(Debug, Clone, Serialize, Deserialize, Display, PartialEq, Eq, Hash)]
#[serde(rename_all = "camelCase", rename_all_fields = "camelCase")]
#[strum(serialize_all = "camelCase")]
pub enum AudioStream {
  System,
  Input,
}

type WavFileWriter = WavWriter<BufWriter<File>>;
pub type SharedWavWriter = Arc<Mutex<Option<WavFileWriter>>>;
