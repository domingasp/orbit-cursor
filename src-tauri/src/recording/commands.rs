use std::sync::{
  atomic::{AtomicBool, Ordering},
  Arc, Mutex,
};

use tauri::{AppHandle, State};
use tauri_nspanel::ManagerExt;
use tokio::sync::{
  broadcast::{self, Sender},
  Barrier,
};

use crate::{
  constants::WindowLabel,
  recording::{
    models::{StartRecordingOptions, StreamSynchronization},
    service::{
      create_recording_directory, start_camera_recording, start_input_audio_recording,
      start_screen_recording, start_system_audio_recording,
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

  let mut barrier_count = 1; // Screen recording always happens
  let conditions = [
    options.system_audio,
    options.input_audio_name.is_some(),
    options.camera_name.is_some(),
  ];

  barrier_count += conditions.iter().filter(|&&condition| condition).count();

  let start_writing = Arc::new(AtomicBool::new(false));
  // +1 is for this thread, making sure writing switch flipped when all
  // streams are ready
  let barrier = Arc::new(Barrier::new(barrier_count + 1));

  start_screen_recording(
    create_stream_sync(&start_writing, &barrier, &stop_tx),
    recording_dir.join("screen.mkv"),
    options.recording_type,
    app_handle.clone(),
    options.monitor_name,
  );

  if options.system_audio {
    start_system_audio_recording(
      create_stream_sync(&start_writing, &barrier, &stop_tx),
      recording_dir.join("system_audio.wav"),
    );
  }

  if let Some(device_name) = options.input_audio_name {
    start_input_audio_recording(
      create_stream_sync(&start_writing, &barrier, &stop_tx),
      recording_dir.join("microphone.wav"),
      device_name,
    );
  }

  if let Some(camera_name) = options.camera_name {
    start_camera_recording(
      create_stream_sync(&start_writing, &barrier, &stop_tx),
      recording_dir.join("camera.mkv"),
      camera_name,
    );
  }

  tauri::async_runtime::spawn(async move {
    // Ensures file writing starts at almost the same time
    barrier.wait().await;
    start_writing.store(true, Ordering::SeqCst);
  });

  state.is_recording = true;
  state.stop_recording_tx = Some(stop_tx);

  let recording_dock = app_handle
    .get_webview_panel(WindowLabel::RecordingDock.as_ref())
    .unwrap();
  recording_dock.order_front_regardless();

  // TODO return empty response to UI - this way the elapsed time
  // is accurate
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

  // TODO
  // Once all files ready - via maybe a barrier
  // trim them all to match the shortest length so they are all the same length
}

fn create_stream_sync(
  start_writing: &Arc<AtomicBool>,
  barrier: &Arc<Barrier>,
  stop_tx: &Sender<()>,
) -> StreamSynchronization {
  StreamSynchronization {
    start_writing: start_writing.clone(),
    barrier: barrier.clone(),
    stop_rx: stop_tx.subscribe(),
  }
}
