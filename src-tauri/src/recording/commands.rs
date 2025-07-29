use std::sync::Mutex;

use serde::Deserialize;
use tauri::{AppHandle, Emitter, Manager, State};

use crate::{
  constants::{Events, WindowLabel},
  recording::{
    file::create_recording_directory,
    models::{RecordingFile, RecordingFileSet, RecordingManifest, RecordingType, Region},
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

    // Optional
    if options.system_audio {
      log::info!("Starting system audio recorder");
      recording_file_set.system_audio = Some(RecordingFile::SystemAudio);
      // TODO setup recorder
      log::info!("System audio recorder ready");
    }

    if let Some(device_name) = options.input_audio_name {
      log::info!("Starting input audio recorder");
      recording_file_set.microphone = Some(RecordingFile::InputAudio);
      // TODO setup recorder
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

    let _ = app_handle.emit(Events::RecordingStarted.as_ref(), ());

    state.is_recording = true;
    state.recording_manifest = Some(RecordingManifest {
      directory: recording_dir,
      files: recording_file_set,
    });
    log::info!("Recording started");
  });

  Ok(())
}

#[tauri::command]
pub async fn stop_recording(app_handle: AppHandle) {
  let state: State<'_, Mutex<AppState>> = app_handle.state();

  let mut recording_manifest = {
    let mut state = state.lock().unwrap();

    let recording_manifest = state.recording_manifest.take();

    state.is_recording = false;
    state.is_editing = true;

    recording_manifest
  };

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
pub fn resume_recording() {
  log::info!("Resuming recording");
}

#[tauri::command]
pub fn pause_recording() {
  log::info!("Pausing recording");
}
