use std::{
  process::ChildStdin,
  sync::{atomic::AtomicBool, Arc, Mutex},
};

use ffmpeg_sidecar::child::FfmpegChild;
use serde::Deserialize;

use crate::audio::models::SharedWavWriter;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartRecordingOptions {
  pub system_audio: bool,
  pub input_audio_name: Option<String>,
  pub camera_name: Option<String>,
}

pub struct AudioRecordingDetails {
  #[allow(dead_code)] // Keeps stream alive, when set to None cpal stream is dropped and cleaned
  pub stream: cpal::Stream,
  pub wav_writer: SharedWavWriter,
}

pub struct CameraRecordingDetails {
  pub stream: nokhwa::CallbackCamera,
  pub ffmpeg: FfmpegChild,
  pub stdin: Arc<Mutex<Option<ChildStdin>>>,
}

pub struct RecordingStreams {
  pub stop_recording_flag: Arc<AtomicBool>,
  pub system_audio: Option<AudioRecordingDetails>,
  pub input_audio: Option<AudioRecordingDetails>,
  pub camera: Option<CameraRecordingDetails>,
}
