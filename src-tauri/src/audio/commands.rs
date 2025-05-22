use std::sync::Mutex;

use super::{
  models::AudioStream,
  service::{create_input_audio_stream, create_system_audio_stream},
};
use crate::AppState;
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use serde::Serialize;
use tauri::{ipc::Channel, State};

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

#[tauri::command]
pub fn start_audio_listener(
  state: State<'_, Mutex<AppState>>,
  stream_to_start: AudioStream,
  on_event: Channel<AudioStreamChannel>,
  device_name: Option<String>,
) {
  let mut state = state.lock().unwrap();

  let maybe_stream = match &stream_to_start {
    AudioStream::System => Some(create_system_audio_stream(on_event)),
    AudioStream::Input => match device_name {
      Some(name) => create_input_audio_stream(name.clone(), on_event),
      _ => None,
    },
  };

  if let Some(stream) = maybe_stream {
    stream.play().expect("Failed to play audio stream");
    state.audio_streams.insert(stream_to_start, stream);
  }
}

#[tauri::command]
pub fn stop_audio_listener(state: State<'_, Mutex<AppState>>, stream_name: AudioStream) {
  let mut state = state.lock().unwrap();
  state.audio_streams.remove(&stream_name);
}

#[tauri::command]
pub fn list_audio_inputs() -> Vec<String> {
  let host = cpal::default_host();
  match host.input_devices() {
    Ok(devices) => devices.filter_map(|device| device.name().ok()).collect(),
    Err(_err) => {
      vec![]
    }
  }
}
