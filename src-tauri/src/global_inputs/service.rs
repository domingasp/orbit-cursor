use rdev::{ Button, Event, EventType };
use tauri::Emitter;

use crate::APP_HANDLE;

pub fn global_input_event_handler(event: Event) {
  if let EventType::ButtonRelease(button) = event.event_type {
    if button == Button::Left {
      let app_handle = APP_HANDLE.get().unwrap();
      let _ = app_handle.emit("standalone_listbox_did_resign_key", ());
    }
  }
}
