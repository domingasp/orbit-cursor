use std::sync::Mutex;

use nokhwa::{
  query,
  utils::{ApiBackend, CameraIndex},
};
use tauri::{ipc::Channel, State};

use crate::AppState;

use super::{models::CameraDetails, service::create_and_start_camera};

#[tauri::command]
pub fn list_cameras() -> Vec<CameraDetails> {
  let cameras = query(ApiBackend::Auto).unwrap();

  let mut camera_details = Vec::new();
  for camera in cameras {
    camera_details.push(CameraDetails {
      index: camera.index().as_string(),
      name: camera.human_name().to_string(),
    });
  }

  camera_details
}

#[tauri::command]
pub fn start_camera_stream(state: State<'_, Mutex<AppState>>, device_index: u32, channel: Channel) {
  let mut state = state.lock().unwrap();

  if let Some(camera) = create_and_start_camera(CameraIndex::Index(device_index), channel) {
    state.camera_stream = Some(camera)
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
