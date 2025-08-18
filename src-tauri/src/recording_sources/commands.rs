use std::path::PathBuf;

use serde::Serialize;
use tauri::{AppHandle, LogicalPosition, LogicalSize, Manager, PhysicalSize};

use super::service::get_visible_windows;

#[cfg(target_os = "windows")]
use crate::recording_sources::service::find_window_by_pid_and_title;

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
  pub pid: i32,
  pub title: String,
  pub size: LogicalSize<f64>,
  pub position: LogicalPosition<f64>,
  pub scale_factor: f64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowDetails {
  pub id: u32,
  pub pid: i32,
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
      pid: data.pid,
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

#[cfg(target_os = "macos")]
#[tauri::command]
pub async fn resize_window(pid: i32, title: String, size: LogicalSize<f64>) {
  let app = cidre::ax::UiElement::with_app_pid(pid);

  let mut app_windows = match app.children() {
    Ok(c) => c,
    Err(e) => {
      log::error!("Failed to get children for app with pid {pid}: {e}");
      return;
    }
  };

  // Track best fuzzy match as no way to get window id using
  // accessibility API - closest title match
  let mut best_idx: Option<usize> = None;
  let mut best_score: f64 = -1.0;
  let mut best_title: Option<String> = None;

  for (idx, app_window) in app_windows.iter().enumerate() {
    let role = app_window
      .role()
      .ok()
      .map(|r| r.to_string())
      .unwrap_or_else(|| "???".into());

    if role != "AXWindow" {
      continue;
    }

    let Ok(window_title) = app_window.attr_value(cidre::ax::attr::title()) else {
      continue;
    };

    let title_cf_string: cidre::arc::Retained<cidre::cf::String> =
      unsafe { cidre::cf::Type::retain(&window_title) };
    let current_title = title_cf_string.to_string();

    let score = rapidfuzz::fuzz::ratio(current_title.chars(), title.chars());

    if score > best_score {
      best_score = score;
      best_idx = Some(idx);
      best_title = Some(current_title);
    }
  }

  if let Some(idx) = best_idx {
    let app_window = &mut app_windows[idx];

    // Resize window
    if app_window
      .is_settable(cidre::ax::attr::size())
      .unwrap_or(false)
    {
      let ax_size = cidre::ax::Value::with_cg_size(&cidre::cg::Size {
        width: size.width,
        height: size.height,
      });

      if let Err(e) = app_window.set_attr(cidre::ax::attr::size(), ax_size.as_ref()) {
        log::error!(
          "Failed to set AX size: {e:?} (best match: '{best_title:?}', score: {best_score:.1}%)"
        );
      }
    }
  } else {
    log::warn!("No AXWindow candidates found for pid {pid}");
  }
}

#[cfg(target_os = "windows")]
#[tauri::command]
pub async fn resize_window(pid: i32, title: String, size: LogicalSize<f64>) {
  use windows::Win32::UI::WindowsAndMessaging::{
    SetWindowPos, SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOZORDER,
  };
  let Some((hwnd, best_title, best_score)) = find_window_by_pid_and_title(pid, &title) else {
    log::warn!("No window candidates found for pid {pid}");
    return;
  };

  let width = size.width.round() as i32;
  let height = size.height.round() as i32;

  unsafe {
    if let Err(e) = SetWindowPos(
      hwnd,
      None,
      0,
      0,
      width,
      height,
      SWP_NOMOVE | SWP_NOZORDER | SWP_NOACTIVATE,
    ) {
      log::error!(
        "Failed to resize window: {:?} (best match: '{:?}', score: {:.1}%)",
        e,
        best_title,
        best_score
      );
    }
  }
}

#[cfg(target_os = "macos")]
#[tauri::command]
pub fn center_window(pid: i32, title: String) {
  log::error!("not implemented for macos")
}

#[cfg(target_os = "windows")]
#[tauri::command]
pub fn center_window(pid: i32, title: String) {
  use std::mem::size_of;
  use windows::Win32::Foundation::RECT;
  use windows::Win32::Graphics::Gdi::{
    GetMonitorInfoW, MonitorFromWindow, MONITORINFO, MONITOR_DEFAULTTONEAREST,
  };
  use windows::Win32::UI::WindowsAndMessaging::{
    GetWindowRect, SetWindowPos, SWP_NOACTIVATE, SWP_NOSIZE, SWP_NOZORDER,
  };

  let Some((hwnd, best_title, best_score)) = find_window_by_pid_and_title(pid, &title) else {
    log::warn!("No window candidates found for pid {pid}");
    return;
  };

  unsafe {
    let mut rect = RECT::default();
    if let Err(e) = GetWindowRect(hwnd, &mut rect) {
      log::error!(
        "GetWindowRect failed: {:?} (best match: '{:?}', score: {:.1}%)",
        e,
        best_title,
        best_score
      );
      return;
    }

    let hmon = MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST);
    if hmon.0.is_null() {
      log::warn!("MonitorFromWindow returned null, cannot center window");
      return;
    }

    let mut mi = MONITORINFO {
      cbSize: size_of::<MONITORINFO>() as u32,
      ..Default::default()
    };
    if !GetMonitorInfoW(hmon, &mut mi).as_bool() {
      log::error!("GetMonitorInfoW failed");
      return;
    }

    let work = mi.rcWork;
    let win_w = rect.right - rect.left;
    let win_h = rect.bottom - rect.top;

    let target_x = work.left + (work.right - work.left - win_w) / 2;
    let target_y = work.top + (work.bottom - work.top - win_h) / 2;

    if let Err(e) = SetWindowPos(
      hwnd,
      None,
      target_x,
      target_y,
      0,
      0,
      SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE,
    ) {
      log::error!(
        "Failed to center window: {:?} (best match: '{:?}', score: {:.1}%)",
        e,
        best_title,
        best_score
      );
    }
  }
}

#[cfg(target_os = "windows")]
#[tauri::command]
pub fn make_borderless(pid: i32, title: String) {
  use windows::Win32::UI::WindowsAndMessaging::{
    GetWindowLongPtrW, SetWindowLongPtrW, SetWindowPos, GWL_EXSTYLE, GWL_STYLE, SWP_FRAMECHANGED,
    SWP_NOMOVE, SWP_NOSIZE, SWP_NOZORDER, WS_CAPTION, WS_EX_CLIENTEDGE, WS_EX_DLGMODALFRAME,
    WS_EX_STATICEDGE, WS_MAXIMIZEBOX, WS_MINIMIZEBOX, WS_SYSMENU, WS_THICKFRAME,
  };

  let Some((hwnd, best_title, best_score)) = find_window_by_pid_and_title(pid, &title) else {
    log::warn!("No window candidates found for pid {pid}");
    return;
  };

  unsafe {
    let style = GetWindowLongPtrW(hwnd, GWL_STYLE) as u32;
    let ex_style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE) as u32;

    // Remove decorations for borderless
    let mut new_style = style;
    new_style &= !WS_CAPTION.0;
    new_style &= !WS_THICKFRAME.0;
    new_style &= !WS_MINIMIZEBOX.0;
    new_style &= !WS_MAXIMIZEBOX.0;
    new_style &= !WS_SYSMENU.0;

    let mut new_ex_style = ex_style;
    new_ex_style &= !WS_EX_DLGMODALFRAME.0;
    new_ex_style &= !WS_EX_CLIENTEDGE.0;
    new_ex_style &= !WS_EX_STATICEDGE.0;

    let _ = SetWindowLongPtrW(hwnd, GWL_STYLE, new_style as isize);
    let _ = SetWindowLongPtrW(hwnd, GWL_EXSTYLE, new_ex_style as isize);

    if let Err(e) = SetWindowPos(
      hwnd,
      None,
      0,
      0,
      0,
      0,
      SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_FRAMECHANGED,
    ) {
      log::error!(
        "Failed to make borderless: {:?} (best match: '{:?}', score: {:.1}%)",
        e,
        best_title,
        best_score
      );
    }
  }
}

#[cfg(target_os = "windows")]
#[tauri::command]
pub fn restore_border(pid: i32, title: String) {
  use windows::Win32::UI::WindowsAndMessaging::{
    GetWindowLongPtrW, SetWindowLongPtrW, SetWindowPos, GWL_EXSTYLE, GWL_STYLE, SWP_FRAMECHANGED,
    SWP_NOMOVE, SWP_NOSIZE, SWP_NOZORDER, WS_EX_CLIENTEDGE, WS_EX_WINDOWEDGE, WS_OVERLAPPEDWINDOW,
  };

  let Some((hwnd, best_title, best_score)) = find_window_by_pid_and_title(pid, &title) else {
    log::warn!("No window candidates found for pid {pid}");
    return;
  };

  unsafe {
    let style = GetWindowLongPtrW(hwnd, GWL_STYLE) as u32;
    let ex_style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE) as u32;

    // Re-add typical decorations
    let new_style = style | WS_OVERLAPPEDWINDOW.0;
    let new_ex_style = ex_style | WS_EX_WINDOWEDGE.0 | WS_EX_CLIENTEDGE.0;

    let _ = SetWindowLongPtrW(hwnd, GWL_STYLE, new_style as isize);
    let _ = SetWindowLongPtrW(hwnd, GWL_EXSTYLE, new_ex_style as isize);

    if let Err(e) = SetWindowPos(
      hwnd,
      None,
      0,
      0,
      0,
      0,
      SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_FRAMECHANGED,
    ) {
      log::error!(
        "Failed to restore border: {:?} (best match: '{:?}', score: {:.1}%)",
        e,
        best_title,
        best_score
      );
    }
  }
}
