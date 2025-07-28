use std::sync::{
  atomic::{AtomicBool, Ordering},
  Arc, Mutex,
};

use serde::Deserialize;
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::sync::broadcast::{self};

use crate::{
  constants::{Events, WindowLabel},
  recording::{
    models::{
      RecordingFile, RecordingFileSet, RecordingManifest, RecordingMetadata, RecordingType, Region,
      StreamSynchronization,
    },
    service::{
      concat_screen_segments, create_recording_directory, resume_screen_recording,
      spawn_mouse_event_recorder, start_camera_recording, start_input_audio_recording,
      start_screen_recording, start_system_audio_recording, write_metadata,
    },
  },
  windows::commands::{hide_region_selector, passthrough_region_selector},
  AppState,
};

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartRecordingOptions {
  pub system_audio: bool,
  pub recording_type: RecordingType,
  pub monitor_name: String,
  pub window_id: Option<u32>,
  pub region: Region,
  pub input_audio_name: Option<String>,
  pub camera_name: Option<String>,
}

#[tauri::command]
pub fn start_recording(app_handle: AppHandle, options: StartRecordingOptions) -> Result<(), ()> {
  let recording_dock = app_handle
    .get_webview_window(WindowLabel::RecordingDock.as_ref())
    .unwrap();
  let _ = recording_dock.show();

  // Setup in a separate thread, this way we don't block UI and the
  // recording dock will show
  std::thread::spawn(move || {
    log::info!("Starting recording");

    let state: State<'_, Mutex<AppState>> = app_handle.state();
    let mut state = state.lock().unwrap();
    let recording_dir = create_recording_directory(&app_handle);
    let mut recording_file_set = RecordingFileSet::default();

    let start_writing = Arc::new(AtomicBool::new(false));
    let (stop_tx, _) = broadcast::channel::<()>(1);

    // Barrier used for a synchronized finish
    let mut barrier_count = 1; // Stop command
    if options.system_audio {
      barrier_count += 1;
    }
    if options.input_audio_name.is_some() {
      barrier_count += 1;
    }

    if options.camera_name.is_some() {
      barrier_count += 1;
    }

    let stop_barrier = Arc::new(std::sync::Barrier::new(barrier_count));

    let synchronization = StreamSynchronization {
      start_writing: start_writing.clone(),
      stop_tx: stop_tx.clone(),
      stop_barrier: stop_barrier.clone(),
    };

    // Optional
    if options.system_audio {
      log::info!("Starting system audio recorder");
      recording_file_set.system_audio = Some(RecordingFile::SystemAudio);
      start_system_audio_recording(
        synchronization.clone(),
        recording_dir.join(RecordingFile::SystemAudio.as_ref()),
      );
      log::info!("System audio recorder ready");
    }

    if let Some(device_name) = options.input_audio_name {
      log::info!("Starting input audio recorder");
      recording_file_set.microphone = Some(RecordingFile::InputAudio);
      start_input_audio_recording(
        synchronization.clone(),
        recording_dir.join(RecordingFile::InputAudio.as_ref()),
        device_name,
      );
      log::info!("Input audio recorder ready");
    }

    if let Some(camera_name) = options.camera_name {
      log::info!("Starting camera recorder");
      recording_file_set.camera = Some(RecordingFile::Camera);
      start_camera_recording(
        synchronization.clone(),
        recording_dir.join(RecordingFile::Camera.as_ref()),
        camera_name,
      );
      log::info!("Camera recorder ready");
    }

    // Always
    // MUST be after the optionals
    // Window capture causes empty frames if this comes first - not sure why, only happens
    // when multiple streams
    log::info!("Starting screen recorder");
    let screen_path = RecordingFile::Screen.segment_path(&recording_dir);
    let (recording_origin, scale_factor, pause_tx, screen_recording_metadata, screen_frame_tx) =
      start_screen_recording(
        synchronization.clone(),
        screen_path.clone(),
        options.recording_type,
        app_handle.clone(),
        options.monitor_name,
        options.window_id,
        options.region,
      );
    log::info!("Screen recorder ready");

    log::info!("Starting extra writers: mouse_events, metadata");
    spawn_mouse_event_recorder(
      synchronization.clone(),
      recording_dir.join(RecordingFile::MouseEvents.as_ref()),
      state.input_event_tx.subscribe(),
    );

    let _ = write_metadata(
      recording_dir.join(RecordingFile::Metadata.as_ref()),
      RecordingMetadata {
        recording_origin,
        scale_factor,
      },
    );
    log::info!("Extra writers ready");

    start_writing.store(true, Ordering::SeqCst);
    let _ = app_handle.emit(Events::RecordingStarted.as_ref(), ());

    state.is_recording = true;
    state.pause_recording_tx = Some(pause_tx);
    state.stop_recording_tx = Some(stop_tx);
    state.stop_barrier = Some(stop_barrier);
    state.recording_manifest = Some(RecordingManifest {
      directory: recording_dir,
      files: recording_file_set,
    });
    state.start_writing = start_writing.clone();
    state.screen_recording_metadata = Some(screen_recording_metadata);
    state.screen_frame_tx = Some(screen_frame_tx);
    state.screen_segments = vec![screen_path];
    log::info!("Recording started");
  });

  Ok(())
}

#[tauri::command]
pub async fn stop_recording(app_handle: AppHandle) {
  let state: State<'_, Mutex<AppState>> = app_handle.state();

  let (mut stop_barrier, screen_segments, recording_dir, mut recording_manifest) = {
    let mut state = state.lock().unwrap();
    state.is_recording = false;

    if let Some(stop_tx) = state.stop_recording_tx.take() {
      let _ = stop_tx.send(());
    }

    let stop_barrier = state.stop_barrier.take();
    let screen_segments = state.screen_segments.clone();
    let recording_dir = state
      .recording_manifest
      .as_ref()
      .map(|m| m.directory.clone())
      .unwrap_or_default();

    let recording_manifest = state.recording_manifest.take();

    state.is_editing = true;

    (
      stop_barrier,
      screen_segments,
      recording_dir,
      recording_manifest,
    )
  };

  if let Some(stop_barrier) = stop_barrier.take() {
    concat_screen_segments(screen_segments, recording_dir);

    tauri::async_runtime::spawn_blocking(move || {
      stop_barrier.wait();
    });
  }

  // Re-enable and hide region selector (not always applicable)
  hide_region_selector(app_handle.clone());
  passthrough_region_selector(app_handle.clone(), false);

  let recording_dock = app_handle
    .get_webview_window(WindowLabel::RecordingDock.as_ref())
    .unwrap();
  let _ = recording_dock.hide();

  let editor = app_handle
    .get_webview_window(WindowLabel::Editor.as_ref())
    .unwrap();
  let _ = editor.show();
  let _ = editor.set_focus();

  if let Some(recording_manifest) = recording_manifest.take() {
    let _ = app_handle.emit(Events::RecordingComplete.as_ref(), recording_manifest);
  }

  #[cfg(target_os = "macos")] // Shows dock icon, allows editor to go fullscreen
  let _ = app_handle.set_activation_policy(tauri::ActivationPolicy::Regular);
}

#[tauri::command]
pub fn resume_recording(state: State<'_, Mutex<AppState>>) {
  log::info!("Resuming recording");
  if let Ok(mut state_guard) = state.lock() {
    log::info!("Spawning new Ffmpeg for screen recording");
    let recording_dir = state_guard
      .recording_manifest
      .as_ref()
      .unwrap()
      .directory
      .clone();
    let screen_path = RecordingFile::Screen.segment_path(&recording_dir);

    resume_screen_recording(
      screen_path.clone(),
      state_guard.screen_recording_metadata.as_ref().unwrap(),
      state_guard.screen_frame_tx.as_ref().unwrap().subscribe(),
      state_guard.pause_recording_tx.as_ref().unwrap().subscribe(),
      state_guard.stop_recording_tx.as_ref().unwrap().subscribe(),
      state_guard.start_writing.clone(),
    );

    state_guard.screen_segments.push(screen_path);
    state_guard
      .start_writing
      .store(true, std::sync::atomic::Ordering::SeqCst);
  }
}

#[tauri::command]
pub fn pause_recording(state: State<'_, Mutex<AppState>>) {
  log::info!("Pausing recording");
  if let Ok(state_guard) = state.lock() {
    if let Some(ref pause_recording_tx) = state_guard.pause_recording_tx {
      let _ = pause_recording_tx.send(());
    }

    state_guard
      .start_writing
      .store(false, std::sync::atomic::Ordering::SeqCst);
  }
}
