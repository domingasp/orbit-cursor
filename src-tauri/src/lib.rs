mod audio;
mod camera;
mod constants;
mod export;
mod global_inputs;
mod models;
#[cfg(target_os = "macos")]
mod permissions;
mod recording;
mod recording_sources;
mod screen_capture;
mod system_tray;
mod windows;

use std::sync::{Arc, OnceLock};

use audio::commands::{list_audio_inputs, start_audio_listener, stop_audio_listener};
use camera::commands::{list_cameras, start_camera_stream, stop_camera_stream};
use constants::store::{FIRST_RUN, NATIVE_REQUESTABLE_PERMISSIONS, STORE_NAME};

use parking_lot::Mutex;
use permissions::{
  commands::{check_permissions, open_system_settings, request_permission},
  service::{ensure_permissions, monitor_permissions},
};
use rdev::{listen, set_is_main_thread};
use recording::commands::{start_recording, stop_recording};
use recording_sources::commands::{list_monitors, list_windows};
use screen_capture::commands::init_magnifier_capturer;
use serde_json::{json, Value};
use system_tray::service::init_system_tray;
use tauri::{App, AppHandle, Manager, Wry};
use tauri_plugin_store::{Store, StoreExt};
use tokio::sync::broadcast;
use windows::{
  commands::{
    collapse_recording_source_selector, expand_recording_source_selector, get_dock_bounds,
    hide_region_selector, hide_start_recording_dock, init_recording_dock,
    init_recording_input_options, init_recording_source_selector, init_region_selector,
    init_standalone_listbox, is_recording_input_options_open, is_start_recording_dock_open,
    quit_app, reset_panels, show_recording_input_options, show_region_selector,
    show_standalone_listbox, show_start_recording_dock, update_dock_opacity,
  },
  service::open_permissions,
};

use crate::{
  export::commands::{cancel_export, export_recording, open_path_in_file_browser, path_exists},
  models::{EditingState, GlobalState, MagnifierState, PreviewState, RecordingState},
  recording::commands::{pause_recording, resume_recording},
  screen_capture::commands::{start_magnifier_capture, stop_magnifier_capture},
  windows::{
    commands::{init_start_recording_dock, passthrough_region_selector},
    service::{editor_close_listener, spawn_window_close_manager},
  },
};

static APP_HANDLE: OnceLock<AppHandle> = OnceLock::new();

async fn setup_store(app: &App) -> Arc<Store<Wry>> {
  let store = app.store(STORE_NAME).unwrap();

  #[cfg(target_os = "macos")]
  {
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
  }

  store
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  ffmpeg_sidecar::download::auto_download().unwrap();

  let (input_event_tx, _) = broadcast::channel::<rdev::Event>(1024);

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
      passthrough_region_selector,
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
      open_path_in_file_browser,
      path_exists,
      export_recording,
      cancel_export,
      pause_recording,
      resume_recording
    ])
    .manage(Mutex::new(GlobalState::new(input_event_tx.clone())))
    .manage(Mutex::new(PreviewState::new()))
    .manage(Mutex::new(MagnifierState::new()))
    .manage(Mutex::new(RecordingState::new()))
    .manage(Mutex::new(EditingState::new()))
    .plugin(tauri_plugin_opener::init())
    .plugin(tauri_plugin_os::init())
    .plugin(tauri_plugin_macos_permissions::init())
    .plugin(tauri_nspanel::init())
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_store::Builder::new().build())
    .plugin(
      tauri_plugin_log::Builder::new()
        .level(if cfg!(debug_assertions) {
          log::LevelFilter::Debug
        } else {
          log::LevelFilter::Info
        })
        .build(),
    )
    .setup(|app: &mut App| {
      let store = tauri::async_runtime::block_on(setup_store(app));

      let app_handle = app.handle();
      let app_handle_clone = Arc::new(app_handle.clone());

      init_system_tray(app_handle.clone())?;
      init_start_recording_dock(app_handle.clone());
      spawn_window_close_manager(app_handle.clone(), input_event_tx.subscribe());
      editor_close_listener(&app_handle.clone());

      #[cfg(target_os = "macos")]
      app.set_activation_policy(tauri::ActivationPolicy::Accessory); // Removes dock icon

      tauri::async_runtime::block_on(async {
        #[cfg(target_os = "macos")]
        {
          let has_required = ensure_permissions().await;
          if !has_required {
            open_permissions(app.handle()).await;
            show_start_recording_dock(app.handle().clone(), app.state(), app.state(), app.state());
          } else if matches!(store.get(FIRST_RUN), Some(Value::Bool(true))) {
            store.set(FIRST_RUN, json!(false));
            show_start_recording_dock(app.handle().clone(), app.state(), app.state(), app.state());
          }
        }

        #[cfg(target_os = "windows")]
        {
          show_start_recording_dock(app.handle(), app.state());
        }
      });

      #[cfg(target_os = "macos")]
      tauri::async_runtime::spawn(async move {
        if let Err(e) = monitor_permissions(app_handle_clone).await {
          eprintln!("Permission monitoring error: {e}");
        }
      });

      std::thread::spawn(move || {
        set_is_main_thread(false);
        if let Err(error) = listen(move |e| {
          global_inputs::service::global_input_event_handler(e, input_event_tx.clone());
        }) {
          eprintln!("Failed to listen: {error:?}")
        }
      });

      Ok(())
    })
    .build(context)
    .unwrap();

  APP_HANDLE.set(app.app_handle().to_owned()).unwrap();

  app.run(|_, _| {})
}
