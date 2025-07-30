use std::{
  sync::{atomic::AtomicBool, Arc},
  thread::JoinHandle,
};

use parking_lot::Mutex;
use serde::Deserialize;
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::sync::broadcast;

use crate::{
  constants::{Events, WindowLabel},
  models::{EditingState, RecordingState},
  recording::{
    audio::{start_microphone_recorder, start_system_audio_recorder},
    file::create_recording_directory,
    models::{
      RecordingFile, RecordingFileSet, RecordingManifest, RecordingType, Region, StreamSync,
    },
  },
  windows::commands::{hide_region_selector, passthrough_region_selector},
};

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartRecordingOptions {
  pub system_audio: bool,
  pub recording_type: RecordingType,
  pub monitor_name: String,
  pub window_id: Option<u32>,
  pub region: Region,
  pub microphone_name: Option<String>,
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

    let recording_dir = create_recording_directory(app_handle.path().app_data_dir().unwrap());
    let mut recording_file_set = RecordingFileSet::default();

    let should_write = Arc::new(AtomicBool::new(false));
    let (stop_tx, _) = broadcast::channel::<()>(1);
    let synchronization = StreamSync {
      should_write: should_write.clone(),
      stop_tx: stop_tx.clone(),
    };

    let mut streams: Vec<JoinHandle<()>> = Vec::new();

    // Optional
    if options.system_audio {
      log::info!("Starting system audio recorder");
      recording_file_set.system_audio = Some(RecordingFile::SystemAudio);
      streams.push(start_system_audio_recorder(
        recording_dir.join(RecordingFile::SystemAudio.as_ref()),
        synchronization.clone(),
      ));
      log::info!("System audio recorder ready");
    }

    if let Some(microphone_name) = options.microphone_name {
      log::info!("Starting input audio recorder");
      recording_file_set.microphone = Some(RecordingFile::Microphone);
      if let Some(handle) = start_microphone_recorder(
        recording_dir.join(RecordingFile::Microphone.as_ref()),
        synchronization.clone(),
        microphone_name,
      ) {
        streams.push(handle);
      }
      log::info!("Input audio recorder ready");
    }

    if let Some(camera_name) = options.camera_name {
      log::info!("Starting camera recorder");
      recording_file_set.camera = Some(RecordingFile::Camera);
      // TODO setup recorder
      log::info!("Camera recorder ready");
    }

    // Always
    // MUST be after the optionals
    // Window capture causes empty frames if this comes first - not sure why, only happens
    // when multiple streams
    log::info!("Starting screen recorder");
    let screen_path = recording_dir.join(RecordingFile::Screen.as_ref());
    // TODO setup recorder
    log::info!("Screen recorder ready");

    log::info!("Starting extra writers: mouse_events, metadata");
    // TODO mouse event recorder
    // TODO store RecordingMetadata
    log::info!("Extra writers ready");

    should_write.store(true, std::sync::atomic::Ordering::SeqCst);
    let _ = app_handle.emit(Events::RecordingStarted.as_ref(), ());

    let recording_state: State<'_, Mutex<RecordingState>> = app_handle.state();
    recording_state.lock().recording_started(
      RecordingManifest {
        directory: recording_dir,
        files: recording_file_set,
      },
      synchronization,
      streams,
    );
    log::info!("Recording started");
  });

  Ok(())
}

#[tauri::command]
pub async fn stop_recording(app_handle: AppHandle) {
  // Re-enable and hide region selector (not always applicable)
  hide_region_selector(app_handle.clone());
  passthrough_region_selector(app_handle.clone(), false);

  {
    let recording_state: State<'_, Mutex<RecordingState>> = app_handle.state();
    if let (Some(recording_manifest), Some(stream_handles)) =
      recording_state.lock().recording_stopped()
    {
      for stream_handle in stream_handles {
        if let Err(e) = stream_handle.join() {
          log::warn!("Failed to join stream thread: {e:?}");
        }
      }

      let _ = app_handle.emit(Events::RecordingComplete.as_ref(), recording_manifest);
    };
  }

  let recording_dock = app_handle
    .get_webview_window(WindowLabel::RecordingDock.as_ref())
    .unwrap();
  let _ = recording_dock.hide();

  {
    let editing_state: State<'_, Mutex<EditingState>> = app_handle.state();
    editing_state.lock().editing_started();
  }

  let editor = app_handle
    .get_webview_window(WindowLabel::Editor.as_ref())
    .unwrap();
  let _ = editor.show();
  let _ = editor.set_focus();

  #[cfg(target_os = "macos")] // Shows dock icon, allows editor to go fullscreen
  let _ = app_handle.set_activation_policy(tauri::ActivationPolicy::Regular);
}

#[tauri::command]
pub fn resume_recording(recording_state: State<'_, Mutex<RecordingState>>) {
  log::info!("Resuming recording");
  recording_state.lock().resume_recording();
}

#[tauri::command]
pub fn pause_recording(recording_state: State<'_, Mutex<RecordingState>>) {
  log::info!("Pausing recording");
  recording_state.lock().pause_recording();
}
