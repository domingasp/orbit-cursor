use std::sync::Mutex;

use cpal::traits::StreamTrait;
use serde::Serialize;
use tauri::{ ipc::Channel, State };
use crate::AppState;
use super::{ models::AudioStream, service::create_system_audio_stream };

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase", rename_all_fields = "camelCase", tag = "event", content = "data")]
pub enum AudioStreamChannel {
  Signal {
    decibels: f32,
  },
}

#[tauri::command]
pub fn start_audio_listener(
  state: State<'_, Mutex<AppState>>,
  stream_name: AudioStream,
  on_event: Channel<AudioStreamChannel>
) {
  let mut state = state.lock().unwrap();

  if let Some(stream) = state.audio_streams.get(&stream_name) {
    stream.play().expect("Failed to play audio stream");
  } else {
    let stream = match stream_name {
      AudioStream::System => create_system_audio_stream(on_event),
    };

    stream.play().expect("Failed to play audio stream");
    state.audio_streams.insert(stream_name, stream);
  }
}

#[tauri::command]
pub fn stop_audio_listener(state: State<'_, Mutex<AppState>>, stream_name: AudioStream) {
  let mut state = state.lock().unwrap();

  if let Some(stream) = state.audio_streams.get(&stream_name) {
    match stream.pause() {
      Ok(()) => {}
      Err(_err) => {
        state.audio_streams.remove(&stream_name);
      }
    }
  }
}

#[tauri::command]
pub fn stop_all_audio_listeners(state: State<'_, Mutex<AppState>>) {
  let state = state.lock().unwrap();

  for stream in state.audio_streams.values() {
    if let Err(err) = stream.pause() {
      eprintln!("Failed to pause stream: {:?}", err);
    }
  }
}
