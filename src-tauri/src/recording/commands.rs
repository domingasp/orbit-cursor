use std::sync::{
  atomic::{AtomicBool, Ordering},
  Arc, Mutex,
};

use tauri::{AppHandle, State};
use tauri_nspanel::ManagerExt;
use tokio::sync::{broadcast, Barrier};

use crate::{
  constants::WindowLabel,
  recording::{
    models::StartRecordingOptions,
    service::{
      create_recording_directory, start_input_audio_recording, start_system_audio_recording,
    },
  },
  AppState,
};

#[tauri::command]
pub fn start_recording(
  app_handle: AppHandle,
  state: State<'_, Mutex<AppState>>,
  options: StartRecordingOptions,
) {
  let mut state = state.lock().unwrap();
  let recording_dir = create_recording_directory(&app_handle);

  let (stop_tx, _) = broadcast::channel::<()>(1);

  let mut barrier_count = 0;
  if options.system_audio {
    barrier_count += 1;
  }
  if options.input_audio_name.is_some() {
    barrier_count += 1;
  }

  let start_writing = Arc::new(AtomicBool::new(false));
  let barrier = Arc::new(Barrier::new(barrier_count + 1));

  if options.system_audio {
    start_system_audio_recording(
      start_writing.clone(),
      barrier.clone(),
      stop_tx.subscribe(),
      recording_dir.join("system_audio.wav"),
    );
  }

  if let Some(device_name) = options.input_audio_name {
    start_input_audio_recording(
      start_writing.clone(),
      barrier.clone(),
      stop_tx.subscribe(),
      recording_dir.join("microphone.wav"),
      device_name,
    );
  }

  tauri::async_runtime::spawn(async move {
    // Ensures file writing starts at almost the same time
    barrier.wait().await;
    start_writing.store(true, Ordering::SeqCst);
  });

  // state.recording_streams = RecordingStreams {
  //   stop_recording_flag,
  //   screen_capture: start_screen_recording(
  //     options.recording_type,
  //     options.monitor_name,
  //     app_handle.clone(),
  //     recording_dir.join("screen.mkv"),
  //     stop_recording_flag_for_screen,
  //   ),
  //   system_audio: if options.system_audio {
  //     start_system_audio_recording(recording_dir.join("system_audio.wav"))
  //   } else {
  //     None
  //   },
  //   input_audio: start_input_audio_recording(
  //     options.input_audio_name,
  //     recording_dir.join("microphone.wav"),
  //   ),
  //   camera: start_camera_recording(
  //     options.camera_name,
  //     recording_dir.join("camera.mkv"),
  //     stop_recording_flag_for_camera,
  //   ),
  // };

  state.is_recording = true;
  state.stop_recording_tx = Some(stop_tx);

  let recording_dock = app_handle
    .get_webview_panel(WindowLabel::RecordingDock.as_ref())
    .unwrap();
  recording_dock.order_front_regardless();
}

#[tauri::command]
pub fn stop_recording(app_handle: AppHandle, state: State<'_, Mutex<AppState>>) {
  let mut state = state.lock().unwrap();
  state.is_recording = false;

  let recording_dock = app_handle
    .get_webview_panel(WindowLabel::RecordingDock.as_ref())
    .unwrap();
  recording_dock.order_out(None);

  if let Some(stop_tx) = state.stop_recording_tx.take() {
    let _ = stop_tx.send(());
  }

  // // cpal and hound automatically clean up on Drop
  // let recording_streams = RecordingStreams {
  //   stop_recording_flag: Arc::new(AtomicBool::new(false)),
  //   screen_capture: None, // drops ffmpeg
  //   system_audio: None,
  //   input_audio: None,
  //   camera: None,
  // };

  // state
  //   .recording_streams
  //   .stop_recording_flag
  //   .store(true, Ordering::SeqCst);

  // stop_audio_writer(state.recording_streams.system_audio.as_ref());
  // stop_audio_writer(state.recording_streams.input_audio.as_ref());
  // stop_camera_writer(state.recording_streams.camera.take());

  // state.recording_streams = recording_streams;
}
