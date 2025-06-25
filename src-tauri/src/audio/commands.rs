use std::sync::Mutex;

use super::models::AudioStream;
use crate::{
  audio::{
    models::AudioStreamChannel,
    service::{
      build_audio_live_monitoring_stream, get_input_audio_device, get_system_audio_device,
    },
  },
  constants::Events,
  AppState,
};
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use tauri::{ipc::Channel, State};

#[tauri::command]
pub fn start_audio_listener(
  state: State<'_, Mutex<AppState>>,
  stream_to_start: AudioStream,
  on_event: Channel<AudioStreamChannel>,
  device_name: Option<String>,
) {
  let mut state = state.lock().unwrap();

  let maybe_stream = match &stream_to_start {
    AudioStream::System => {
      let (device, config) = get_system_audio_device();
      Some(build_audio_live_monitoring_stream(
        &device,
        &config,
        on_event,
        Some(Events::SystemAudioStreamError.to_string()),
      ))
    }
    AudioStream::Input => match device_name {
      Some(name) => {
        if let Some((device, config)) = get_input_audio_device(name) {
          Some(build_audio_live_monitoring_stream(
            &device,
            &config,
            on_event,
            Some(Events::InputAudioStreamError.to_string()),
          ))
        } else {
          None
        }
      }
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
