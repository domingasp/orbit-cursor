use parking_lot::Mutex;
use strum_macros::Display;
use tauri::image::Image;
use tauri::menu::{Menu, MenuBuilder, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIcon, TrayIconEvent};
use tauri::{AppHandle, Manager, State};

use crate::models::RecordingState;
use crate::recording::commands::{pause_recording, resume_recording, stop_recording};
use crate::windows::commands::{
  show_and_focus_editor, show_start_recording_dock, INIT_RECORDING_SOURCE_SELECTOR,
};

pub fn init_system_tray(app_handle: AppHandle) -> tauri::Result<()> {
  let tray = app_handle.tray_by_id("tray_icon").unwrap();
  add_tray_menu(app_handle.clone(), &tray);
  tray.set_show_menu_on_left_click(false)?;
  tray.on_tray_icon_event(|tray, event| {
    // Wait for recording source selector to be initialized
    if INIT_RECORDING_SOURCE_SELECTOR.is_completed() {
      if let TrayIconEvent::Click {
        button: MouseButton::Left,
        button_state: MouseButtonState::Up,
        ..
      } = event
      {
        let app_handle = tray.app_handle();
        let recording_state: State<'_, Mutex<RecordingState>> = tray.app_handle().state();

        if recording_state.lock().is_recording() {
          if recording_state.lock().is_paused() {
            tauri::async_runtime::block_on(resume_recording(app_handle.clone()));
          } else {
            pause_recording(tray.app_handle().clone(), recording_state.clone());
          }
        } else {
          // These decide if to show accordingly, needed to do this as state
          // is not available when setting up the tray causing a panic
          show_start_recording_dock(app_handle.clone(), app_handle.state(), app_handle.state());
        }
      }

      if let TrayIconEvent::Click {
        button: MouseButton::Right,
        button_state: MouseButtonState::Up,
        ..
      } = event
      {
        let recording_state: State<'_, Mutex<RecordingState>> = tray.app_handle().state();
        if recording_state.lock().is_recording() {
          tauri::async_runtime::block_on(stop_recording(tray.app_handle().clone()));
        }
      }
    }
  });

  Ok(())
}

fn add_tray_menu(app_handle: AppHandle, tray: &TrayIcon) {
  let open_editor = MenuItem::with_id(
    &app_handle,
    "open_editor",
    "Open Editor",
    true,
    None::<&str>,
  )
  .unwrap();

  let quit_i =
    MenuItem::with_id(&app_handle, "quit", "Quit Orbit Cursor", true, None::<&str>).unwrap();

  let menu = MenuBuilder::new(&app_handle)
    .item(&open_editor)
    .separator()
    .item(&quit_i)
    .build()
    .unwrap();

  tray.on_menu_event(|app, event| match event.id.as_ref() {
    "open_editor" => {
      show_and_focus_editor(app.clone(), app.state());
    }
    "quit" => {
      app.exit(0);
    }
    _ => {
      println!("menu item {:?} not handled", event.id);
    }
  });

  let _ = tray.set_menu(Some(menu));
}

fn remove_tray_menu(tray: &TrayIcon) {
  let _ = tray.set_menu::<Menu<tauri::Wry>>(None);
}

#[derive(Display, Debug, Clone, PartialEq, Eq)]
pub enum SystemTrayIcon {
  Default,
  Recording,
  Paused,
  Loading,
}

pub fn update_system_tray_icon(app_handle: AppHandle, icon: SystemTrayIcon) {
  let tray = app_handle.tray_by_id("tray_icon").unwrap();

  let icon_bytes = match icon {
    SystemTrayIcon::Default => include_bytes!("../../icons/system-tray-default.ico"),
    SystemTrayIcon::Recording => include_bytes!("../../icons/system-tray-recording.ico"),
    SystemTrayIcon::Paused => include_bytes!("../../icons/system-tray-paused.ico"),
    SystemTrayIcon::Loading => include_bytes!("../../icons/system-tray-loading.ico"),
  };

  if icon == SystemTrayIcon::Default {
    add_tray_menu(app_handle.clone(), &tray);
  } else {
    remove_tray_menu(&tray);
  }

  // Apply icon
  if let Ok(image) = Image::from_bytes(icon_bytes) {
    let _ = tray.set_icon(Some(image));
  }
}
