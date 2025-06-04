use std::{
  sync::{atomic::Ordering, Arc, Mutex},
  thread,
};

use scap::frame::Frame;
use tauri::{ipc::Channel, Manager, State};
use yuv::bgra_to_rgba;

use crate::{AppState, APP_HANDLE};

use super::service;

#[tauri::command]
pub fn init_magnifier_capturer(state: State<'_, Mutex<AppState>>, display_name: String) {
  service::init_magnifier_capturer(state, display_name);
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
        let width = bgra_frame.width as u32;
        let height = bgra_frame.height as u32;
        let mut rgba_buffer = vec![0u8; (width * height * 4) as usize];
        if let Err(e) = bgra_to_rgba(
          &bgra_frame.data,
          width * 4,
          &mut rgba_buffer,
          width * 4,
          width,
          height,
        ) {
          eprintln!("Failed to convert BGRA to RGBA: {:?}", e);
          continue; // skip this frame
        }
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
