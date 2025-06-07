use std::{
  sync::{atomic::Ordering, Arc, Mutex},
  thread,
};

use scap::frame::Frame;
use tauri::{ipc::Channel, AppHandle, Manager, State};

use crate::{AppState, APP_HANDLE};

use super::service::{self, bgra_frame_to_rgba_buffer};

#[tauri::command]
pub fn init_magnifier_capturer(
  app_handle: AppHandle,
  state: State<'_, Mutex<AppState>>,
  display_name: String,
) {
  service::init_magnifier_capturer(app_handle, state, display_name);
}

#[tauri::command]
pub fn start_magnifier_capture(channel: Channel) {
  let app_state = APP_HANDLE.get().unwrap().state::<Mutex<AppState>>().inner();

  let (mut capturer, running_flag) = if let Ok(mut state) = app_state.lock() {
    if let Some(c) = state.magnifier_capturer.take() {
      let running_flag = Arc::clone(&state.magnifier_running);
      running_flag.store(true, Ordering::SeqCst);
      (c, running_flag)
    } else {
      return;
    }
  } else {
    return;
  };

  thread::spawn(move || {
    capturer.start_capture();
    while running_flag.load(Ordering::SeqCst) {
      if let Ok(Frame::BGRA(bgra_frame)) = capturer.get_next_frame() {
        let rgba_buffer = bgra_frame_to_rgba_buffer(bgra_frame);
        let _ = channel.send(tauri::ipc::InvokeResponseBody::Raw(rgba_buffer));
      }
    }
    capturer.stop_capture();

    if let Ok(mut state) = app_state.lock() {
      state.magnifier_capturer = Some(capturer);
    }
  });
}

#[tauri::command]
pub fn stop_magnifier_capture(state: State<'_, Mutex<AppState>>) {
  if let Ok(state) = state.lock() {
    state.magnifier_running.store(false, Ordering::SeqCst);
  }
}
