use std::sync::Mutex;

use cpal::traits::StreamTrait;
use tauri::{AppHandle, State};
use tauri_nspanel::ManagerExt;

use crate::{
  audio::service::{build_audio_into_file_stream, get_input_audio_device, get_system_audio_device},
  constants::WindowLabel,
  recording::service::{create_recording_directory, stop_audio_writer},
  AppState, AudioRecordingDetails, RecordingStreams,
};

#[tauri::command]
pub fn start_recording(
  app_handle: AppHandle,
  state: State<'_, Mutex<AppState>>,
  system_audio: bool,
  device_name: Option<String>,
) {
  if let Ok(mut state) = state.lock() {
    let mut recording_streams = RecordingStreams {
      system_audio: None,
      input_audio: None,
    };

    // Setup and start recording
    let recording_dir = create_recording_directory(&app_handle);

    if system_audio {
      let (device, config) = get_system_audio_device();
      let (stream, wav_writer) =
        build_audio_into_file_stream(&device, &config, &recording_dir, "system_audio".to_string());
      stream.play().expect("Failed to play system audio stream");
      recording_streams.system_audio = Some(AudioRecordingDetails { stream, wav_writer })
    }

    if let Some(device_name) = device_name {
      let (device, config) = get_input_audio_device(device_name);
      let (stream, wav_writer) =
        build_audio_into_file_stream(&device, &config, &recording_dir, "microphone".to_string());
      stream.play().expect("Failed to play input audio stream");
      recording_streams.input_audio = Some(AudioRecordingDetails { stream, wav_writer })
    }

    state.is_recording = true;
    state.recording_streams = recording_streams;

    let recording_dock = app_handle
      .get_webview_panel(WindowLabel::RecordingDock.as_ref())
      .unwrap();
    recording_dock.order_front_regardless();
  }
}

#[tauri::command]
pub fn stop_recording(app_handle: AppHandle, state: State<'_, Mutex<AppState>>) {
  if let Ok(mut state) = state.lock() {
    state.is_recording = false;
    // cpal and hound automatically clean up on Drop
    let recording_streams = RecordingStreams {
      system_audio: None,
      input_audio: None,
    };

    stop_audio_writer(state.recording_streams.system_audio.as_ref());
    stop_audio_writer(state.recording_streams.input_audio.as_ref());

    state.recording_streams = recording_streams;

    let recording_dock = app_handle
      .get_webview_panel(WindowLabel::RecordingDock.as_ref())
      .unwrap();
    recording_dock.order_out(None);
  }
}
