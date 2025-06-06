mod audio;
mod camera;
mod constants;
mod global_inputs;
#[cfg(target_os = "macos")]
mod permissions;
mod recording_sources;
mod recording_state;
mod screen_capture;
mod system_tray;
mod windows;

use std::{
  collections::HashMap,
  sync::{atomic::AtomicBool, Arc, Mutex, OnceLock},
};

use audio::{
  commands::{list_audio_inputs, start_audio_listener, stop_audio_listener},
  models::AudioStream,
};
use camera::commands::{list_cameras, start_camera_stream, stop_camera_stream};
use constants::{
  store::{FIRST_RUN, NATIVE_REQUESTABLE_PERMISSIONS, STORE_NAME},
  WindowLabel,
};
use cpal::Stream;
use nokhwa::CallbackCamera;
use permissions::{
  commands::{check_permissions, open_system_settings, request_permission},
  service::{ensure_permissions, monitor_permissions},
};
use rdev::listen;
use recording_sources::commands::{list_monitors, list_windows};
use recording_state::commands::{start_recording, stop_recording};
use scap::capturer::Capturer;
use screen_capture::commands::init_magnifier_capturer;
use serde_json::{json, Value};
use system_tray::service::init_system_tray;
use tauri::{App, AppHandle, Manager, Wry};
use tauri_plugin_store::{Store, StoreExt};
use windows::{
  commands::{
    collapse_recording_source_selector, expand_recording_source_selector, get_dock_bounds,
    hide_region_selector, hide_start_recording_dock, init_recording_dock,
    init_recording_input_options, init_recording_source_selector, init_region_selector,
    init_standalone_listbox, is_recording_input_options_open, is_start_recording_dock_open,
    quit_app, reset_panels, show_recording_input_options, show_region_selector,
    show_standalone_listbox, show_start_recording_dock, update_dock_opacity,
  },
  service::{
    add_animation, add_border, convert_to_stationary_panel, handle_dock_positioning,
    open_permissions,
  },
};

use crate::screen_capture::commands::{start_magnifier_capture, stop_magnifier_capture};

static APP_HANDLE: OnceLock<AppHandle> = OnceLock::new();

struct AppState {
  is_recording: bool,
  open_windows: HashMap<WindowLabel, bool>,
  audio_streams: HashMap<AudioStream, Stream>,
  camera_stream: Option<CallbackCamera>,
  magnifier_capturer: Option<Capturer>,
  magnifier_running: Arc<AtomicBool>,
}

async fn setup_store(app: &App) -> Arc<Store<Wry>> {
  let store = app.store(STORE_NAME).unwrap();

  if store.get(FIRST_RUN).is_none() {
    store.set(FIRST_RUN, json!(true));
  }

  if store.get(NATIVE_REQUESTABLE_PERMISSIONS).is_none() {
    // Actual access is checked at runtime
    store.set(
      NATIVE_REQUESTABLE_PERMISSIONS,
      json!({
        "accessibility": true,
        "screen": true,
        "microphone": true,
        "camera": true
      }),
    );
  }

  store
}

fn init_start_recording_dock(app_handle: &AppHandle) {
  let window = app_handle
    .get_webview_window(WindowLabel::StartRecordingDock.as_ref())
    .unwrap();

  add_border(&window);
  add_animation(&window, 3);
  handle_dock_positioning(&window);

  let _ = convert_to_stationary_panel(&window, constants::PanelLevel::StartRecordingDock);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let context = tauri::generate_context!();

  let app = tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![
      check_permissions,
      request_permission,
      open_system_settings,
      quit_app,
      init_standalone_listbox,
      show_standalone_listbox,
      init_recording_input_options,
      show_recording_input_options,
      init_region_selector,
      show_region_selector,
      hide_region_selector,
      hide_start_recording_dock,
      init_recording_source_selector,
      expand_recording_source_selector,
      collapse_recording_source_selector,
      start_audio_listener,
      stop_audio_listener,
      list_audio_inputs,
      is_start_recording_dock_open,
      is_recording_input_options_open,
      list_cameras,
      start_camera_stream,
      stop_camera_stream,
      list_monitors,
      reset_panels,
      get_dock_bounds,
      update_dock_opacity,
      init_magnifier_capturer,
      start_magnifier_capture,
      stop_magnifier_capture,
      list_windows,
      init_recording_dock,
      start_recording,
      stop_recording,
    ])
    .manage(Mutex::new(AppState {
      is_recording: false,
      open_windows: HashMap::from([
        (WindowLabel::StartRecordingDock, false),
        (WindowLabel::RecordingInputOptions, false),
        (WindowLabel::RecordingSourceSelector, false),
      ]),
      audio_streams: HashMap::new(),
      camera_stream: None,
      magnifier_capturer: None,
      magnifier_running: Arc::new(AtomicBool::new(false)),
    }))
    .plugin(tauri_plugin_opener::init())
    .plugin(tauri_plugin_macos_permissions::init())
    .plugin(tauri_nspanel::init())
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_store::Builder::new().build())
    .setup(|app: &mut App| {
      let store = tauri::async_runtime::block_on(setup_store(app));

      let app_handle = app.handle();
      let app_handle_clone = Arc::new(app_handle.clone());

      init_system_tray(app_handle.clone())?;
      init_start_recording_dock(app_handle);

      #[cfg(target_os = "macos")]
      {
        app.set_activation_policy(tauri::ActivationPolicy::Accessory); // Removes dock icon
        tauri::async_runtime::block_on(async {
          let has_required = ensure_permissions().await;
          if !has_required {
            open_permissions(app.handle()).await;
            show_start_recording_dock(app.handle(), app.state());
          } else if matches!(store.get(FIRST_RUN), Some(Value::Bool(true))) {
            store.set(FIRST_RUN, json!(false));
            show_start_recording_dock(app.handle(), app.state());
          }
        });

        tauri::async_runtime::spawn(async move {
          if let Err(e) = monitor_permissions(app_handle_clone).await {
            eprintln!("Permission monitoring error: {}", e);
          }
        });
      }

      tauri::async_runtime::spawn(async move {
        if let Err(error) = listen(global_inputs::service::global_input_event_handler) {
          eprintln!("Failed to listen: {:?}", error)
        }
      });

      Ok(())
    })
    .build(context)
    .unwrap();

  APP_HANDLE.set(app.app_handle().to_owned()).unwrap();

  app.run(|_, _| {})
}
