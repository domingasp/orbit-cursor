mod audio;
mod camera;
mod constants;
mod global_inputs;
#[cfg(target_os = "macos")]
mod permissions;
mod system_tray;
mod windows;

use std::{
  collections::HashMap,
  sync::{Arc, Mutex, OnceLock},
};

use audio::{
  commands::{list_audio_inputs, start_audio_listener, stop_audio_listener},
  models::AudioStream,
};
use camera::commands::{list_cameras, start_camera_stream, stop_camera_stream};
use constants::store::{FIRST_RUN, NATIVE_REQUESTABLE_PERMISSIONS, STORE_NAME};
use cpal::Stream;
use nokhwa::CallbackCamera;
use permissions::{
  commands::{check_permissions, open_system_settings, request_permission},
  service::{ensure_permissions, monitor_permissions},
};
use rdev::listen;
use serde_json::{json, Value};
use system_tray::service::create_system_tray;
use tauri::{App, AppHandle, Manager, Wry};
use tauri_plugin_store::{Store, StoreExt};
use windows::{
  commands::{
    hide_start_recording_dock, init_standalone_listbox, is_start_recording_dock_open, quit_app,
    show_standalone_listbox, show_start_recording_dock,
  },
  service::{init_start_recording_panel, open_permissions},
};

static APP_HANDLE: OnceLock<AppHandle> = OnceLock::new();

struct AppState {
  start_recording_dock_opened: bool,
  audio_streams: HashMap<AudioStream, Stream>,
  camera_stream: Option<CallbackCamera>,
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
      hide_start_recording_dock,
      start_audio_listener,
      stop_audio_listener,
      list_audio_inputs,
      is_start_recording_dock_open,
      list_cameras,
      start_camera_stream,
      stop_camera_stream
    ])
    .manage(Mutex::new(AppState {
      start_recording_dock_opened: false,
      audio_streams: HashMap::new(),
      camera_stream: None,
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

      create_system_tray(app)?;
      init_start_recording_panel(app_handle);

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
