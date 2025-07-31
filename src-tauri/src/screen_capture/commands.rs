use parking_lot::Mutex;
use scap::frame::Frame;
use tauri::{ipc::Channel, AppHandle, Manager, State};

use crate::models::MagnifierState;

use super::service::{self, bgra_frame_to_rgba_buffer};

#[tauri::command]
pub fn init_magnifier_capturer(
  magnifier_state: State<'_, Mutex<MagnifierState>>,
  display_name: String,
) {
  service::init_magnifier_capturer(magnifier_state, display_name);
}

#[tauri::command]
pub fn start_magnifier_capture(
  app_handle: AppHandle,
  magnifier_state: State<'_, Mutex<MagnifierState>>,
  channel: Channel,
) {
  let (is_running, capturer) = magnifier_state.lock().start_magnifier();
  let app_handle_for_thread = app_handle.clone();

  if let Some(mut capturer) = capturer {
    std::thread::spawn(move || {
      capturer.start_capture();
      while is_running.load(std::sync::atomic::Ordering::SeqCst) {
        if let Ok(Frame::BGRA(bgra_frame)) = capturer.get_next_frame() {
          let rgba_buffer = bgra_frame_to_rgba_buffer(bgra_frame);
          let _ = channel.send(tauri::ipc::InvokeResponseBody::Raw(rgba_buffer));
        }
      }
      capturer.stop_capture();

      let state: State<'_, Mutex<MagnifierState>> = app_handle_for_thread.state();
      state.lock().store_magnifier(capturer);
    });
  } else {
    log::warn!("Failed to start magnifier, capturer not available");
  }
}

#[tauri::command]
pub fn stop_magnifier_capture(magnifier_state: State<'_, Mutex<MagnifierState>>) {
  magnifier_state.lock().stop_magnifier();
}
