use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconEvent};
use tauri::{AppHandle, Manager};

use crate::windows::commands::{show_start_recording_dock, INIT_RECORDING_SOURCE_SELECTOR};

pub fn init_system_tray(app_handle: AppHandle) -> tauri::Result<()> {
  let quit_i = MenuItem::with_id(&app_handle, "quit", "Quit Orbit Cursor", true, None::<&str>)?;
  let menu = Menu::with_items(&app_handle, &[&quit_i])?;
  let tray = app_handle.tray_by_id("tray_icon").unwrap();
  tray.on_menu_event(|app, event| match event.id.as_ref() {
    "quit" => {
      app.exit(0);
    }
    _ => {
      println!("menu item {:?} not handled", event.id);
    }
  });
  tray.set_menu(Some(menu))?;
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
        show_start_recording_dock(app_handle, app_handle.state());
      }
    }
  });

  Ok(())
}
