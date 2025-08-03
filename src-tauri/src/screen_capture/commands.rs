use parking_lot::Mutex;
use scap::frame::Frame;
use tauri::{ipc::Channel, State};

use crate::{models::MagnifierState, screen_capture::service::init_magnifier_capturer};

use super::service::bgra_frame_to_rgba_buffer;

#[tauri::command]
pub fn start_magnifier_capture(
  magnifier_state: State<'_, Mutex<MagnifierState>>,
  channel: Channel,
  display_name: String,
) {
  let is_running = magnifier_state.lock().start_magnifier();

  std::thread::spawn(move || {
    let mut capturer = init_magnifier_capturer(display_name);

    capturer.start_capture();
    while is_running.load(std::sync::atomic::Ordering::SeqCst) {
      if let Ok(Frame::BGRA(bgra_frame)) = capturer.get_next_frame() {
        let rgba_buffer = bgra_frame_to_rgba_buffer(bgra_frame);
        let _ = channel.send(tauri::ipc::InvokeResponseBody::Raw(rgba_buffer));
      }
    }
    capturer.stop_capture();
  });
}

#[tauri::command]
pub fn stop_magnifier_capture(magnifier_state: State<'_, Mutex<MagnifierState>>) {
  magnifier_state.lock().stop_magnifier();
}
