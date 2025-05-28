use std::sync::Mutex;

use once_cell::sync::Lazy;
use rdev::{Button, Event, EventType};
use tauri::{Emitter, Manager};

use crate::{
  constants::{Events, WindowLabel},
  windows::service::is_coordinate_in_window,
  APP_HANDLE,
};

static LAST_MOUSE_POS: Lazy<Mutex<(f64, f64)>> = Lazy::new(|| Mutex::new((0.0, 0.0)));

pub fn global_input_event_handler(event: Event) {
  match event.event_type {
    EventType::MouseMove { x, y } => {
      let mut pos = LAST_MOUSE_POS.lock().unwrap();
      *pos = (x, y);
    }
    EventType::ButtonRelease(Button::Left) => {
      let app_handle = APP_HANDLE.get().unwrap();
      let _ = app_handle.emit(Events::StandaloneListboxDidResignKey.as_ref(), ());

      // Handle recording input options popover
      let pos = LAST_MOUSE_POS.lock().unwrap();
      let recording_input_options_window = app_handle
        .get_webview_window(WindowLabel::RecordingInputOptions.as_ref())
        .unwrap();

      let standalone_listbox_window = app_handle
        .get_webview_window(WindowLabel::StandaloneListbox.as_ref())
        .unwrap();

      if !is_coordinate_in_window(pos.0, pos.1, &recording_input_options_window)
        && !is_coordinate_in_window(pos.0, pos.1, &standalone_listbox_window)
      {
        let _ = app_handle.emit(Events::RecordingInputOptionsDidResignKey.as_ref(), ());
      }
    }
    _ => {}
  }
}
