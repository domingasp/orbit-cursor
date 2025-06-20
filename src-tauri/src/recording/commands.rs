use std::sync::{
  atomic::{AtomicBool, Ordering},
  Arc, Mutex,
};

use tauri::{AppHandle, Emitter, Manager, State};
use tokio::sync::broadcast::{self};

use crate::{
  constants::{Events, WindowLabel},
  recording::{
    models::{RecordingFile, StartRecordingOptions, StreamSynchronization},
    service::{
      create_recording_directory, spawn_mouse_event_recorder, start_camera_recording,
      start_input_audio_recording, start_screen_recording, start_system_audio_recording,
    },
  },
  AppState,
};

#[tauri::command]
pub fn start_recording(app_handle: AppHandle, options: StartRecordingOptions) -> Result<(), ()> {
  let recording_dock = app_handle
    .get_webview_window(WindowLabel::RecordingDock.as_ref())
    .unwrap();
  let _ = recording_dock.show();

  // Setup in a separate thread, this way we don't block UI and the
  // recording dock will show
  std::thread::spawn(move || {
    let state: State<'_, Mutex<AppState>> = app_handle.state();
    let mut state = state.lock().unwrap();
    let recording_dir = create_recording_directory(&app_handle);

    let start_writing = Arc::new(AtomicBool::new(false));
    let (stop_tx, _) = broadcast::channel::<()>(1);

    let synchronization = StreamSynchronization {
      start_writing: start_writing.clone(),
      stop_tx: stop_tx.clone(),
    };

    // Optional
    if options.system_audio {
      start_system_audio_recording(
        synchronization.clone(),
        recording_dir.join(RecordingFile::SystemAudio.as_ref()),
      );
    }

    if let Some(device_name) = options.input_audio_name {
      start_input_audio_recording(
        synchronization.clone(),
        recording_dir.join(RecordingFile::InputAudio.as_ref()),
        device_name,
      );
    }

    if let Some(camera_name) = options.camera_name {
      start_camera_recording(
        synchronization.clone(),
        recording_dir.join(RecordingFile::Camera.as_ref()),
        camera_name,
      );
    }

    // Always
    // MUST be after the optionals
    // Window capture causes empty frames if this comes first - not sure why, only happens
    // when multiple streams
    start_screen_recording(
      synchronization.clone(),
      recording_dir.join(RecordingFile::Screen.as_ref()),
      options.recording_type,
      app_handle.clone(),
      options.monitor_name,
      options.window_id,
      options.region,
    );

    spawn_mouse_event_recorder(
      synchronization.clone(),
      recording_dir.clone(),
      state.input_event_tx.subscribe(),
    );

    start_writing.store(true, Ordering::SeqCst);
    let _ = app_handle.emit(Events::RecordingStarted.as_ref(), ());

    state.is_recording = true;
    state.stop_recording_tx = Some(stop_tx);
    state.current_recording_dir = Some(recording_dir);
  });

  Ok(())
}

#[tauri::command]
pub fn stop_recording(app_handle: AppHandle, state: State<'_, Mutex<AppState>>) {
  let recording_dock = app_handle
    .get_webview_window(WindowLabel::RecordingDock.as_ref())
    .unwrap();
  let _ = recording_dock.hide();

  let mut state = state.lock().unwrap();
  state.is_recording = false;

  if let Some(stop_tx) = state.stop_recording_tx.take() {
    let _ = stop_tx.send(());
  }
}
