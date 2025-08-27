mod audio;
mod camera;
mod constants;
mod db;
mod export;
mod global_inputs;
mod models;
#[cfg(target_os = "macos")]
mod permissions;
mod recording;
mod recording_management;
mod recording_sources;
mod screen_capture;
mod system_tray;
mod windows;

use std::sync::{Arc, OnceLock};

use audio::commands::{list_audio_inputs, start_audio_listener, stop_audio_listener};
use camera::commands::{list_cameras, start_camera_stream, stop_camera_stream};
use constants::store::{FIRST_RUN, STORE_NAME};

use parking_lot::Mutex;
use rdev::listen;
use recording::commands::start_recording;
use recording_sources::commands::{list_monitors, list_windows};
use serde_json::{json, Value};
use sqlx::{migrate::MigrateDatabase, sqlite::SqlitePoolOptions, Pool, Sqlite};
use system_tray::service::init_system_tray;
use tauri::{App, AppHandle, Manager, Wry};
use tauri_plugin_sql::{Migration, MigrationKind};
use tauri_plugin_store::{Store, StoreExt};
use tokio::sync::broadcast;
use windows::commands::{
  collapse_recording_source_selector, expand_recording_source_selector, get_dock_bounds,
  hide_region_selector, hide_start_recording_dock, init_recording_input_options,
  init_recording_source_selector, init_region_selector, init_standalone_listbox,
  is_recording_input_options_open, is_start_recording_dock_open, quit_app, reset_panels,
  set_region_selector_opacity, show_recording_input_options, show_region_selector,
  show_standalone_listbox, show_start_recording_dock, update_dock_opacity,
};

#[cfg(target_os = "macos")]
use constants::store::NATIVE_REQUESTABLE_PERMISSIONS;

#[cfg(target_os = "macos")]
use windows::service::open_permissions;

#[cfg(target_os = "macos")]
use permissions::{
  commands::{check_permissions, open_system_settings, request_permission},
  service::{ensure_permissions, monitor_permissions},
};

#[cfg(target_os = "macos")]
use rdev::set_is_main_thread;

#[cfg(target_os = "windows")]
use crate::windows::commands::init_editor;
use crate::{
  export::commands::{cancel_export, export_recording, open_path_in_file_browser, path_exists},
  models::{EditingState, GlobalState, PreviewState, RecordingState},
  recording_management::commands::{get_recording_details, update_recording_name},
  recording_sources::commands::{center_window, resize_window},
  windows::{
    commands::{
      init_start_recording_dock, set_region_selector_passthrough, take_display_screenshot,
    },
    service::{editor_close_listener, spawn_window_close_manager},
  },
};

#[cfg(target_os = "windows")]
use crate::recording_sources::commands::{make_borderless, restore_border};

static APP_HANDLE: OnceLock<AppHandle> = OnceLock::new();

async fn setup_store(app: &App) -> Arc<Store<Wry>> {
  let store = app.store(STORE_NAME).unwrap();

  if store.get(FIRST_RUN).is_none() {
    store.set(FIRST_RUN, json!(true));
  }

  #[cfg(target_os = "macos")]
  {
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

async fn setup_db(app: &App) -> Pool<sqlx::Sqlite> {
  let mut path = app
    .path()
    .app_data_dir()
    .expect("Failed to get app_data_dir");

  match std::fs::create_dir_all(path.clone()) {
    Ok(_) => (),
    Err(e) => {
      panic!("Error creating directory: {e}");
    }
  }

  path.push("orbit-cursor.db");

  Sqlite::create_database(
    format!(
      "sqlite:{}",
      path.to_str().expect("Path should have a value")
    )
    .as_str(),
  )
  .await
  .expect("Failed to create database");

  let db = SqlitePoolOptions::new()
    .connect(path.to_str().unwrap())
    .await
    .unwrap();

  db
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  ffmpeg_sidecar::download::auto_download().unwrap();

  let (input_event_tx, _) = broadcast::channel::<rdev::Event>(1024);

  let context = tauri::generate_context!();

  let mut app_builder = tauri::Builder::default();

  // Register Handlers
  app_builder = app_builder.invoke_handler(tauri::generate_handler![
    #[cfg(target_os = "macos")]
    check_permissions,
    #[cfg(target_os = "macos")]
    request_permission,
    #[cfg(target_os = "macos")]
    open_system_settings,
    quit_app,
    init_standalone_listbox,
    show_standalone_listbox,
    init_recording_input_options,
    show_recording_input_options,
    init_region_selector,
    show_region_selector,
    hide_region_selector,
    set_region_selector_passthrough,
    set_region_selector_opacity,
    take_display_screenshot,
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
    list_windows,
    start_recording,
    open_path_in_file_browser,
    path_exists,
    export_recording,
    cancel_export,
    resize_window,
    #[cfg(target_os = "windows")]
    make_borderless,
    #[cfg(target_os = "windows")]
    restore_border,
    center_window,
    get_recording_details,
    update_recording_name
  ]);

  // State
  app_builder = app_builder
    .manage(GlobalState::new(input_event_tx.clone()))
    .manage(Mutex::new(PreviewState::new()))
    .manage(Mutex::new(RecordingState::new()))
    .manage(Mutex::new(EditingState::new()));

  // Database
  let migrations = vec![
    // Version number must match filename prefix
    Migration {
      version: 1,
      description: "create_recordings_table",
      sql: include_str!("../migrations/1_create_recordings_table.up.sql"),
      kind: MigrationKind::Up,
    },
    Migration {
      version: 1,
      description: "create_recordings_table",
      sql: include_str!("../migrations/1_create_recordings_table.down.sql"),
      kind: MigrationKind::Down,
    },
    Migration {
      version: 2,
      description: "track_camera_and_audio_in_recording",
      sql: include_str!("../migrations/2_track_system_cursor_in_recording.up.sql"),
      kind: MigrationKind::Up,
    },
    Migration {
      version: 2,
      description: "track_camera_and_audio_in_recording",
      sql: include_str!("../migrations/2_track_system_cursor_in_recording.down.sql"),
      kind: MigrationKind::Down,
    },
    Migration {
      version: 3,
      description: "add_recording_name",
      sql: include_str!("../migrations/3_add_recording_name.up.sql"),
      kind: MigrationKind::Up,
    },
    Migration {
      version: 3,
      description: "add_recording_name",
      sql: include_str!("../migrations/3_add_recording_name.down.sql"),
      kind: MigrationKind::Down,
    },
  ];

  // Plugins
  app_builder = app_builder
    .plugin(
      tauri_plugin_sql::Builder::default()
        .add_migrations("sqlite:orbit-cursor.db", migrations)
        .build(),
    )
    .plugin(tauri_plugin_opener::init())
    .plugin(tauri_plugin_os::init())
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
    );

  #[cfg(target_os = "macos")]
  {
    app_builder = app_builder
      .plugin(tauri_plugin_macos_permissions::init())
      .plugin(tauri_nspanel::init());
  }

  // Build
  let app = app_builder
    .setup(|app: &mut App| {
      let store = tauri::async_runtime::block_on(setup_store(app));
      tauri::async_runtime::block_on(async {
        let db = setup_db(app).await;
        app.manage(db);
      });

      let app_handle = app.handle().clone();

      #[cfg(target_os = "windows")]
      {
        init_system_tray(app_handle.clone())?;
        init_editor(app_handle.clone());
      }

      init_start_recording_dock(app_handle.clone());
      spawn_window_close_manager(app_handle.clone(), input_event_tx.subscribe());
      editor_close_listener(&app_handle.clone());

      tauri::async_runtime::block_on(async {
        #[cfg(target_os = "macos")]
        {
          let has_required = ensure_permissions().await;
          if !has_required {
            open_permissions(app.handle()).await;
          } else if matches!(store.get(FIRST_RUN), Some(Value::Bool(true))) {
            store.set(FIRST_RUN, json!(false));
            show_start_recording_dock(app.handle().clone(), app.state(), app.state());
          }

          if has_required {
            init_system_tray(app_handle.clone()).ok();
            app.set_activation_policy(tauri::ActivationPolicy::Accessory); // Removes dock icon
          }
        }

        #[cfg(target_os = "windows")]
        {
          if matches!(store.get(FIRST_RUN), Some(Value::Bool(true))) {
            store.set(FIRST_RUN, json!(false));
            show_start_recording_dock(app.handle().clone(), app.state(), app.state(), app.state());
          }
        }
      });

      #[cfg(target_os = "macos")]
      {
        let app_handle_for_permissions = app_handle.clone();
        tauri::async_runtime::spawn(async move {
          if let Err(e) = monitor_permissions(app_handle_for_permissions).await {
            eprintln!("Permission monitoring error: {e}");
          }
        });
      }

      std::thread::spawn(move || {
        #[cfg(target_os = "macos")]
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
