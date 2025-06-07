use std::sync::{Arc, Mutex};

use chrono::Local;
use cpal::traits::StreamTrait;
use tauri::{AppHandle, State};
use tauri_nspanel::ManagerExt;

use crate::{
  audio::service::{build_audio_into_file_stream, get_system_audio_device},
  constants::WindowLabel,
  recording::service::create_recording_directory,
  AppState, AudioRecordingDetails, RecordingStreams,
};

#[tauri::command]
pub fn start_recording(
  app_handle: AppHandle,
  state: State<'_, Mutex<AppState>>,
  system_audio: bool,
) {
  if let Ok(mut state) = state.lock() {
    let mut recording_streams = RecordingStreams { system_audio: None };

    // Setup and start recording
    let recording_dir = create_recording_directory(&app_handle);

    if system_audio {
      let (device, config) = get_system_audio_device();
      let (stream, wav_writer) = build_audio_into_file_stream(&device, &config, recording_dir);
      stream.play().expect("Failed to play audio stream");
      recording_streams.system_audio = Some(AudioRecordingDetails { stream, wav_writer })
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

    if let Some(system_audio) = state.recording_streams.system_audio.as_ref() {
      let wav_writer = Arc::clone(&system_audio.wav_writer);

      {
        let mut writer_lock = wav_writer.lock().unwrap();
        if let Some(writer) = writer_lock.take() {
          writer.finalize().unwrap();
        }
      }

      // cpal and hound automatically clean up on Drop
      state.recording_streams = RecordingStreams { system_audio: None };
    }

    println!("Stopped at: {}", Local::now().format("%Y-%m-%d %H:%M:%S"));

    let recording_dock = app_handle
      .get_webview_panel(WindowLabel::RecordingDock.as_ref())
      .unwrap();
    recording_dock.order_out(None);
  }
}
