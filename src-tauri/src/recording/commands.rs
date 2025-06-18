use std::{
  collections::HashMap,
  sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex,
  },
};

use tauri::{AppHandle, Emitter, Manager, State};
use tauri_nspanel::ManagerExt;
use tokio::sync::{
  broadcast::{self, Sender},
  Barrier,
};

use crate::{
  constants::{Events, WindowLabel},
  recording::{
    models::{RecordingFile, RecordingState, StartRecordingOptions, StreamSynchronization},
    service::{
      create_recording_directory, get_file_duration, start_camera_recording,
      start_input_audio_recording, start_mouse_event_recording, start_screen_recording,
      start_system_audio_recording, trim_mp4_to_length,
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

  // +2 is for this thread and mouse event writer, making sure writing switch flipped
  // when all streams are ready
  let barrier = Arc::new(Barrier::new(barrier_count + 2));

  let mut threads = HashMap::new();
  threads.insert(
    RecordingFile::Screen,
    start_screen_recording(
      create_stream_sync(&start_writing, &barrier, &stop_tx),
      recording_dir.join(RecordingFile::Screen.as_ref()),
      options.recording_type,
      app_handle.clone(),
      options.monitor_name,
      options.window_id,
      options.region,
    ),
  );

  start_mouse_event_recording(
    create_stream_sync(&start_writing, &barrier, &stop_tx),
    recording_dir.clone(),
    state.input_event_tx.subscribe(),
  );

  if options.system_audio {
    threads.insert(
      RecordingFile::SystemAudio,
      start_system_audio_recording(
        create_stream_sync(&start_writing, &barrier, &stop_tx),
        recording_dir.join(RecordingFile::SystemAudio.as_ref()),
      ),
    );
  }

  if let Some(device_name) = options.input_audio_name {
    if let Some(input_audio_thread) = start_input_audio_recording(
      create_stream_sync(&start_writing, &barrier, &stop_tx),
      recording_dir.join(RecordingFile::InputAudio.as_ref()),
      device_name,
    ) {
      threads.insert(RecordingFile::InputAudio, input_audio_thread);
    }
  }

  if let Some(camera_name) = options.camera_name {
    threads.insert(
      RecordingFile::Camera,
      start_camera_recording(
        create_stream_sync(&start_writing, &barrier, &stop_tx),
        recording_dir.join(RecordingFile::Camera.as_ref()),
        camera_name,
      ),
    );
  }

  let recording_dock = app_handle
    .get_webview_panel(WindowLabel::RecordingDock.as_ref())
    .unwrap();
  recording_dock.order_front_regardless();

  tauri::async_runtime::spawn(async move {
    // Ensures file writing starts at almost the same time
    barrier.wait().await;
    start_writing.store(true, Ordering::SeqCst);

    let _ = app_handle.emit(Events::RecordingStarted.as_ref(), ());
  });

  state.is_recording = true;
  state.stop_recording_tx = Some(stop_tx);
  state.recording_state = Some(RecordingState {
    current_recording_path: recording_dir,
    threads,
  });
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

    if let Some(recording_state) = state.recording_state.take() {
      tauri::async_runtime::spawn(async move {
        let recording_dir = recording_state.current_recording_path;

        let mut file_lengths: HashMap<RecordingFile, f64> = HashMap::new();
        for (file, thread) in recording_state.threads {
          let _ = thread.await;
          match file {
            RecordingFile::Screen | RecordingFile::Camera => {
              let duration = get_file_duration(recording_dir.as_path(), &file).await;
              file_lengths.insert(file, duration);
            }
            _ => {}
          }
        }

        if let Some(min_key) = file_lengths
          .iter()
          .filter(|(_, v)| !v.is_nan())
          .min_by(|a, b| a.1.partial_cmp(b.1).unwrap())
          .map(|(k, _)| *k)
        {
          if let Some(min_duration) = file_lengths.remove(&min_key) {
            for file in file_lengths.keys() {
              trim_mp4_to_length(recording_dir.as_path(), file, min_duration);
            }
          }
        }
      });
    }
  }
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
