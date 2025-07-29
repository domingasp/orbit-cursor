use super::models::AudioStream;
use crate::{
  audio::{
    models::AudioStreamChannel,
    service::{
      build_audio_live_monitoring_stream, get_input_audio_device, get_system_audio_device,
    },
  },
  constants::Events,
  models::PreviewState,
};
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use parking_lot::Mutex;
use tauri::{ipc::Channel, State};

#[tauri::command]
pub fn start_audio_listener(
  preview_state: State<'_, Mutex<PreviewState>>,
  stream_to_start: AudioStream,
  on_event: Channel<AudioStreamChannel>,
  device_name: Option<String>,
) {
  let audio_stream = match &stream_to_start {
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

  if let Some(stream) = audio_stream {
    stream.play().expect("Failed to play audio stream");

    preview_state
      .lock()
      .set_audio_stream(stream_to_start, stream);
  }
}

#[tauri::command]
pub fn stop_audio_listener(state: State<'_, Mutex<PreviewState>>, stream_name: AudioStream) {
  state.lock().remove_audio_stream(stream_name);
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
