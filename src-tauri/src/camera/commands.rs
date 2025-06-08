use std::sync::Mutex;

use nokhwa::{query, utils::ApiBackend};
use tauri::{ipc::Channel, State};

use crate::{camera::service::live_frame_callback, AppState};

use super::service::create_and_start_camera;

#[tauri::command]
pub fn list_cameras() -> Vec<String> {
  let cameras = query(ApiBackend::Auto).unwrap();

  let mut camera_details = Vec::new();
  for camera in cameras {
    camera_details.push(camera.human_name().to_string());
  }

  camera_details
}

#[tauri::command]
pub fn start_camera_stream(state: State<'_, Mutex<AppState>>, name: String, channel: Channel) {
  let mut state = state.lock().unwrap();

  if let Some(camera_to_start) = query(ApiBackend::Auto)
    .unwrap()
    .iter()
    .find(|camera| camera.human_name() == name)
  {
    if let Some(camera) = create_and_start_camera(camera_to_start.index().clone(), move |frame| {
      live_frame_callback(frame, &channel);
    }) {
      state.camera_stream = Some(camera)
    }
  }
}

#[tauri::command]
pub fn stop_camera_stream(state: State<'_, Mutex<AppState>>) {
  let mut state = state.lock().unwrap();

  if let Some(mut camera_stream) = state.camera_stream.take() {
    std::thread::spawn(move || {
      // Need a thread to stop stream otherwise freezes main thread
      let _ = camera_stream.stop_stream();
    });
  }
}
