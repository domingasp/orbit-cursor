use std::path::PathBuf;

use serde::Serialize;
use tauri::{AppHandle, LogicalPosition, LogicalSize, Manager};

use super::service::get_visible_windows;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MonitorDetails {
  pub id: String,
  pub name: String,
  pub position: LogicalPosition<f64>,
  pub size: LogicalSize<f64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowDetails {
  pub id: u32,
  pub title: String,
  pub app_icon_path: Option<PathBuf>,
  pub thumbnail_path: Option<PathBuf>,
}

#[tauri::command]
pub fn list_monitors(app_handle: AppHandle) -> Vec<MonitorDetails> {
  let monitors = app_handle.available_monitors().unwrap();
  let low_level_screens = cidre::ns::Screen::screens();

  let mut monitor_details = Vec::new();
  for i in 0..monitors.len() {
    let scale_factor = monitors[i].scale_factor();

    monitor_details.push(MonitorDetails {
      id: monitors[i].name().unwrap().to_string(), // this is a unique identifier Monitor #xxxxx
      name: low_level_screens[i].localized_name().to_string(),
      position: monitors[i].position().to_logical(scale_factor),
      size: monitors[i].size().to_logical(scale_factor),
    });
  }

  monitor_details
}

#[tauri::command]
pub async fn list_windows(app_handle: AppHandle) -> Vec<WindowDetails> {
  let app_temp_dir = app_handle.path().temp_dir().unwrap().join("OrbitCursor");
  get_visible_windows(app_temp_dir).await
}
