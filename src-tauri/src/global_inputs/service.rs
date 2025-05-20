use rdev::{Button, Event, EventType};
use tauri::Emitter;

use crate::{constants::events::STANDALONE_LISTBOX_DID_RESIGN_KEY, APP_HANDLE};

pub fn global_input_event_handler(event: Event) {
  if let EventType::ButtonRelease(button) = event.event_type {
    if button == Button::Left {
      let app_handle = APP_HANDLE.get().unwrap();
      let _ = app_handle.emit(STANDALONE_LISTBOX_DID_RESIGN_KEY, ());
    }
  }
}
