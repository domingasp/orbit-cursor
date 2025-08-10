use std::path::PathBuf;

use serde::Serialize;
use tauri::{AppHandle, LogicalPosition, LogicalSize, Manager, PhysicalSize};

use super::service::get_visible_windows;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MonitorDetails {
  pub id: String,
  pub name: String,
  pub position: LogicalPosition<f64>,
  pub size: LogicalSize<f64>,
  pub physical_size: PhysicalSize<f64>,
  pub scale_factor: f64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowMetadata {
  pub id: u32,
  pub pid: Option<i32>, // For app icon generation
  pub title: String,
  pub size: LogicalSize<f64>,
  pub position: LogicalPosition<f64>,
  pub scale_factor: f64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowDetails {
  pub id: u32,
  pub title: String,
  pub app_icon_path: Option<PathBuf>,
  pub thumbnail_path: Option<PathBuf>,
  pub size: LogicalSize<f64>,
  pub position: LogicalPosition<f64>,
  pub scale_factor: f64,
}

impl WindowDetails {
  pub fn from_metadata(
    data: WindowMetadata,
    app_icon_path: Option<PathBuf>,
    thumbnail_path: Option<PathBuf>,
  ) -> Self {
    Self {
      id: data.id,
      title: data.title,
      size: data.size,
      position: data.position,
      scale_factor: data.scale_factor,
      app_icon_path,
      thumbnail_path,
    }
  }
}

#[tauri::command]
pub fn list_monitors(app_handle: AppHandle) -> Vec<MonitorDetails> {
  let monitors = app_handle.available_monitors().unwrap();

  // Assume order of monitors consistent between xcap and Tauri
  let monitor_names = xcap::Monitor::all()
    .unwrap()
    .iter()
    .map(|monitor| monitor.name().unwrap_or_default())
    .collect::<Vec<String>>();

  let mut monitor_details = Vec::new();
  for i in 0..monitors.len() {
    let size = monitors[i].size();
    let scale_factor = monitors[i].scale_factor();

    monitor_details.push(MonitorDetails {
      id: monitors[i].name().unwrap().to_string(), // this is a unique identifier Monitor #xxxxx
      name: monitor_names[i].to_string(),
      position: monitors[i].position().to_logical(scale_factor),
      size: size.to_logical(scale_factor),
      physical_size: PhysicalSize::new(size.width as f64, size.height as f64),
      scale_factor,
    });
  }

  monitor_details
}

#[tauri::command]
pub async fn list_windows(app_handle: AppHandle, generate_thumbnails: bool) {
  let app_temp_dir = if generate_thumbnails {
    Some(app_handle.path().temp_dir().unwrap().join("OrbitCursor"))
  } else {
    None
  };

  #[cfg(target_os = "macos")]
  get_visible_windows(app_handle.available_monitors().unwrap(), app_temp_dir);

  #[cfg(target_os = "windows")]
  get_visible_windows(app_temp_dir);
}
