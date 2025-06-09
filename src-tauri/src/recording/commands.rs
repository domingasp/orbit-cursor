use std::sync::{
  atomic::{AtomicBool, Ordering},
  Arc, Mutex,
};

use tauri::{AppHandle, State};
use tauri_nspanel::ManagerExt;

use crate::{
  constants::WindowLabel,
  recording::{
    models::StartRecordingOptions,
    service::{
      create_recording_directory, start_camera_recording, start_input_audio_recording,
      start_screen_recording, start_system_audio_recording, stop_audio_writer, stop_camera_writer,
    },
  },
  AppState, RecordingStreams,
};

#[tauri::command]
pub fn start_recording(
  app_handle: AppHandle,
  state: State<'_, Mutex<AppState>>,
  options: StartRecordingOptions,
) {
  let stop_recording_flag = Arc::new(AtomicBool::new(false));
  let stop_recording_flag_for_screen = stop_recording_flag.clone();
  let stop_recording_flag_for_camera = stop_recording_flag.clone();

  if let Ok(mut state) = state.lock() {
    let recording_dir = create_recording_directory(&app_handle);

    state.is_recording = true;
    state.recording_streams = RecordingStreams {
      stop_recording_flag,
      screen_capture: start_screen_recording(
        options.recording_type,
        options.monitor_name,
        app_handle.clone(),
        recording_dir.join("screen.mkv"),
        stop_recording_flag_for_screen,
      ),
      system_audio: if options.system_audio {
        start_system_audio_recording(recording_dir.join("system_audio.wav"))
      } else {
        None
      },
      input_audio: start_input_audio_recording(
        options.input_audio_name,
        recording_dir.join("microphone.wav"),
      ),
      camera: start_camera_recording(
        options.camera_name,
        recording_dir.join("camera.mkv"),
        stop_recording_flag_for_camera,
      ),
    };

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
      stop_recording_flag: Arc::new(AtomicBool::new(false)),
      screen_capture: None, // drops ffmpeg
      system_audio: None,
      input_audio: None,
      camera: None,
    };

    state
      .recording_streams
      .stop_recording_flag
      .store(true, Ordering::SeqCst);

    stop_audio_writer(state.recording_streams.system_audio.as_ref());
    stop_audio_writer(state.recording_streams.input_audio.as_ref());
    stop_camera_writer(state.recording_streams.camera.take());

    state.recording_streams = recording_streams;

    let recording_dock = app_handle
      .get_webview_panel(WindowLabel::RecordingDock.as_ref())
      .unwrap();
    recording_dock.order_out(None);
  }
}
