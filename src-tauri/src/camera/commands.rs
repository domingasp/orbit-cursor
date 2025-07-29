use nokhwa::{query, utils::ApiBackend};
use parking_lot::Mutex;
use tauri::{ipc::Channel, AppHandle, Manager, State};

use crate::{
  camera::service::{create_camera, live_frame_callback},
  models::PreviewState,
};

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
pub async fn start_camera_stream(
  preview_state: State<'_, Mutex<PreviewState>>,
  name: String,
  channel: Channel,
) -> Result<(), ()> {
  let mut stop_camera_rx = preview_state.lock().subscribe_to_camera_stop();

  if let Some(camera_to_start) = query(ApiBackend::Auto)
    .unwrap()
    .iter()
    .find(|camera| camera.human_name() == name)
  {
    if let Some(mut camera) = create_camera(camera_to_start.index().clone(), move |frame| {
      live_frame_callback(frame, &channel);
    }) {
      std::thread::spawn(move || {
        if let Err(e) = camera.open_stream() {
          eprintln!("Failed to start camera: {e}");
        }

        let _ = stop_camera_rx.blocking_recv(); // Keeps camera alive
      });
    }
  }

  Ok(())
}

#[tauri::command]
pub async fn stop_camera_stream(app_handle: AppHandle) {
  let preview_state: State<'_, Mutex<PreviewState>> = app_handle.state();
  preview_state.lock().stop_camera();
}
