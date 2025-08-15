use std::sync::Once;

use once_cell::sync::OnceCell;
use parking_lot::Mutex;
use serde::Serialize;
use tauri::{ipc::Channel, AppHandle, Emitter, LogicalPosition, LogicalSize, Manager, State};
#[cfg(target_os = "windows")]
use windows::Win32::Foundation::HWND;

#[cfg(target_os = "windows")]
use crate::windows::service::convert_to_stationary_panel;
use crate::{
  constants::{Events, WindowLabel},
  models::{EditingState, GlobalState, RecordingState},
  screen_capture::commands::capture_display_screenshot,
  windows::service::{calculate_position_above_dock, handle_dock_positioning},
};

#[cfg(target_os = "windows")]
use crate::windows::service::set_hwnd_opacity;

use super::service::{
  add_close_panel_listener, animate_resize, position_recording_source_selector,
};

#[cfg(target_os = "macos")]
use super::service::{add_animation, add_border, convert_to_stationary_panel};
#[cfg(target_os = "macos")]
use crate::constants::PanelLevel;
#[cfg(target_os = "macos")]
use tauri_nspanel::{panel_delegate, ManagerExt};

// We use static variable as storing in state was causing a lock contention
// when input options open and straight to start recording
pub static APP_WEBVIEW_TITLES: OnceCell<Vec<String>> = OnceCell::new();

pub static INIT_RECORDING_SOURCE_SELECTOR: Once = Once::new();

static INIT_STANDALONE_LISTBOX: Once = Once::new();
static INIT_RECORDING_OPTIONS_PANEL: Once = Once::new();
static INIT_REGION_SELECTOR: Once = Once::new();

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Bounds {
  pub start_point: LogicalPosition<f64>,
  pub end_point: LogicalPosition<f64>,
  pub display_id: Option<String>,
}

pub fn init_start_recording_dock(app_handle: AppHandle) {
  let window = app_handle
    .get_webview_window(WindowLabel::StartRecordingDock.as_ref())
    .unwrap();

  #[cfg(target_os = "macos")]
  {
    add_border(&window);
    add_animation(&window, 3);
    let _ = convert_to_stationary_panel(&window, PanelLevel::StartRecordingDock);
  }

  #[cfg(target_os = "windows")]
  convert_to_stationary_panel(&window);

  handle_dock_positioning(&window);
}

#[cfg(target_os = "windows")]
pub fn init_editor(app_handle: AppHandle) {
  if let Some(editor) = app_handle.get_webview_window(WindowLabel::Editor.as_ref()) {
    // To support custom title bar in windows
    editor.set_decorations(false).ok();
  }
}

#[tauri::command]
pub fn init_standalone_listbox(app_handle: AppHandle) {
  INIT_STANDALONE_LISTBOX.call_once(|| {
    let window = app_handle
      .get_webview_window(WindowLabel::StandaloneListbox.as_ref())
      .unwrap();

    #[cfg(target_os = "macos")]
    {
      let panel = convert_to_stationary_panel(&window, PanelLevel::StandaloneListBox);

      let panel_delegate = panel_delegate!(StandaloneListBoxDelegate {
        window_did_resign_key
      });

      let handle = app_handle.clone();
      panel_delegate.set_listener(Box::new(move |delegate_name: String| {
        if delegate_name.as_str() == "window_did_resign_key" {
          let _ = handle.emit(Events::StandaloneListboxDidResignKey.as_ref(), ());
        }
      }));
      panel.set_delegate(panel_delegate);
    }

    #[cfg(target_os = "windows")]
    convert_to_stationary_panel(&window);

    add_close_panel_listener(
      app_handle,
      WindowLabel::StandaloneListbox,
      Events::StandaloneListboxDidResignKey,
      move |app_handle| {
        let _ = app_handle.emit(Events::ClosedStandaloneListbox.as_ref(), ());
      },
    );

    let _ = window.hide();
  });
}

#[tauri::command]
pub fn init_recording_input_options(app_handle: AppHandle) {
  INIT_RECORDING_OPTIONS_PANEL.call_once(|| {
    if let Some(window) = app_handle.get_webview_window(WindowLabel::RecordingInputOptions.as_ref())
    {
      #[cfg(target_os = "macos")]
      {
        add_border(&window);
        convert_to_stationary_panel(&window, PanelLevel::RecordingInputOptions);
      }

      #[cfg(target_os = "windows")]
      convert_to_stationary_panel(&window);

      add_close_panel_listener(
        app_handle,
        WindowLabel::RecordingInputOptions,
        Events::RecordingInputOptionsDidResignKey,
        move |app_handle| {
          let _ = app_handle.emit(Events::ClosedRecordingInputOptions.as_ref(), ());
          let global_state: State<'_, GlobalState> = app_handle.state();
          global_state.window_closed(WindowLabel::RecordingInputOptions);
        },
      );
    }
  });
}

#[tauri::command]
pub fn init_region_selector(app_handle: AppHandle) {
  INIT_REGION_SELECTOR.call_once(|| {
    if let Some(window) = app_handle.get_webview_window(WindowLabel::RegionSelector.as_ref()) {
      #[cfg(target_os = "macos")]
      let _ = convert_to_stationary_panel(&window, PanelLevel::RegionSelector);

      #[cfg(target_os = "windows")]
      convert_to_stationary_panel(&window);
    }
  });
}

#[tauri::command]
pub fn init_recording_source_selector(app_handle: AppHandle) {
  INIT_RECORDING_SOURCE_SELECTOR.call_once(|| {
    if let Some(window) =
      app_handle.get_webview_window(WindowLabel::RecordingSourceSelector.as_ref())
    {
      #[cfg(target_os = "macos")]
      {
        add_border(&window);
        add_animation(&window, 3);
        let _ = convert_to_stationary_panel(&window, PanelLevel::RecordingSourceSelector);
      }

      #[cfg(target_os = "windows")]
      convert_to_stationary_panel(&window);

      position_recording_source_selector(app_handle, &window);
    }
  });
}

#[tauri::command]
pub fn quit_app(app_handle: AppHandle) {
  app_handle.exit(0);
}

#[tauri::command]
pub fn show_standalone_listbox(
  app_handle: AppHandle,
  parent_window_label: String,
  offset: LogicalPosition<f64>,
  size: LogicalSize<f64>,
) {
  let parent_window = app_handle
    .get_webview_window(parent_window_label.as_ref())
    .unwrap();
  let window = app_handle
    .get_webview_window(WindowLabel::StandaloneListbox.as_ref())
    .unwrap();
  let scale_factor = parent_window.scale_factor().unwrap();

  let parent_position = parent_window
    .outer_position()
    .unwrap()
    .to_logical::<f64>(scale_factor);
  let _ = window.set_position(LogicalPosition {
    x: parent_position.x + offset.x,
    y: parent_position.y + offset.y,
  });
  let _ = window.set_size(size);

  if let Err(e) = window.show() {
    eprintln!("Failed to show standalone listbox: {e}");
  }
}

#[tauri::command]
pub fn show_recording_input_options(
  app_handle: AppHandle,
  global_state: State<'_, GlobalState>,
  x: f64,
) {
  {
    global_state.window_opened(WindowLabel::RecordingInputOptions);
  }

  let window = app_handle
    .get_webview_window(WindowLabel::RecordingInputOptions.as_ref())
    .unwrap();

  window
    .set_position(calculate_position_above_dock(
      app_handle.clone(),
      WindowLabel::RecordingInputOptions,
      x,
      None,
    ))
    .ok();

  if let Err(e) = window.show() {
    eprintln!("Failed to show recording input options: {e}");
  }

  let _ = app_handle
    .emit(Events::RecordingInputOptionsOpened.as_ref(), ())
    .map_err(|e| {
      format!(
        "Failed to emit {} event: {}",
        Events::RecordingInputOptionsOpened.as_ref(),
        e
      )
    });
}

#[tauri::command]
pub fn show_start_recording_dock(
  app_handle: AppHandle,
  global_state: State<'_, GlobalState>,
  recording_state: State<'_, Mutex<RecordingState>>,
  editing_state: State<'_, Mutex<EditingState>>,
) {
  {
    if recording_state.lock().is_recording || editing_state.lock().is_editing {
      return;
    }
  }

  global_state.window_opened(WindowLabel::StartRecordingDock);

  let window = app_handle
    .get_webview_window(WindowLabel::StartRecordingDock.as_ref())
    .unwrap();
  if let Err(e) = window.show() {
    eprintln!("Failed to show start recording dock: {e}");
  }

  // Showing/hiding doesn't remount component, instead we emit event to UI
  let _ = app_handle
    .emit(Events::StartRecordingDockOpened.as_ref(), ())
    .map_err(|e| {
      format!(
        "Failed to emit {} event: {}",
        Events::StartRecordingDockOpened.as_ref(),
        e
      )
    });

  if let Some(recording_source_selector) =
    app_handle.get_webview_window(WindowLabel::RecordingSourceSelector.as_ref())
  {
    global_state.window_closed(WindowLabel::RecordingSourceSelector);

    let recording_source_selector_window = app_handle
      .get_webview_window(WindowLabel::RecordingSourceSelector.as_ref())
      .unwrap();
    position_recording_source_selector(app_handle, &recording_source_selector_window);
    if let Err(e) = recording_source_selector.show() {
      eprintln!("Failed to show recording source selector: {e}");
    }
  }
}

#[cfg(target_os = "windows")]
fn focus_start_recording_dock(app_handle: AppHandle) {
  let start_recording_dock =
    app_handle.get_webview_window(WindowLabel::StartRecordingDock.as_ref());

  let recording_source_selector =
    app_handle.get_webview_window(WindowLabel::RecordingSourceSelector.as_ref());

  if let (Some(start_recording_dock), Some(recording_source_selector)) =
    (start_recording_dock, recording_source_selector)
  {
    let _ = recording_source_selector.set_focus();
    let _ = start_recording_dock.set_focus();
  }
}

#[tauri::command]
pub fn show_region_selector(
  app_handle: AppHandle,
  size: LogicalSize<f64>,
  position: LogicalPosition<f64>,
) {
  if let Some(window) = app_handle.get_webview_window(WindowLabel::RegionSelector.as_ref()) {
    let _ = window.set_size(size);
    let _ = window.set_position(position);

    if let Err(e) = window.show() {
      eprintln!("Failed to show region selector: {e}");
    }

    #[cfg(target_os = "windows")]
    focus_start_recording_dock(app_handle);
  }
}

#[tauri::command]
pub fn show_and_focus_editor(
  app_handle: AppHandle,
  recording_state: State<'_, Mutex<RecordingState>>,
  editing_state: State<'_, Mutex<EditingState>>,
) {
  {
    if !recording_state.lock().is_recording() || !editing_state.lock().is_editing() {
      return;
    }
  }

  let editor = app_handle
    .get_webview_window(WindowLabel::Editor.as_ref())
    .unwrap();

  let _ = editor.unminimize();
  let _ = editor.set_focus();
}

#[tauri::command]
pub async fn hide_start_recording_dock(app_handle: AppHandle) {
  let global_state: State<'_, GlobalState> = app_handle.state();
  global_state.window_closed(WindowLabel::StartRecordingDock);

  let panel = app_handle
    .get_webview_window(WindowLabel::StartRecordingDock.as_ref())
    .unwrap();
  let _ = panel.hide();

  let recording_source_selector = app_handle
    .get_webview_window(WindowLabel::RecordingSourceSelector.as_ref())
    .unwrap();
  let _ = recording_source_selector.hide();

  if global_state.is_window_open(&WindowLabel::RecordingSourceSelector) {
    collapse_recording_source_selector(app_handle.clone()).await;
  }
}

#[tauri::command]
pub fn hide_region_selector(app_handle: AppHandle) {
  if let Some(window) = app_handle.get_webview_window(WindowLabel::RegionSelector.as_ref()) {
    let _ = window.hide();
  }
}

#[tauri::command]
pub fn passthrough_region_selector(
  app_handle: AppHandle,
  passthrough: bool,
  display_id: String,
  channel: Channel,
) {
  let window = app_handle
    .get_webview_window(WindowLabel::RegionSelector.as_ref())
    .unwrap();
  let _ = window.set_ignore_cursor_events(passthrough);

  // Refocus so dock appears in front of Region Selector
  // Mac has levels windows does not
  #[cfg(target_os = "windows")]
  if passthrough {
    focus_start_recording_dock(app_handle);
  }
  // Only when in editing mode
  if !passthrough {
    #[cfg(target_os = "windows")] // Can't exclude windows on Windows
    set_hwnd_opacity(HWND(window.hwnd().unwrap().0), 0.0);

    let screenshot_for_magnifier = capture_display_screenshot(display_id);

    channel
      .send(tauri::ipc::InvokeResponseBody::Raw(
        screenshot_for_magnifier,
      ))
      .ok();

    #[cfg(target_os = "windows")]
    set_hwnd_opacity(HWND(window.hwnd().unwrap().0), 1.0);

    window.set_focus().ok();
  }
}

#[tauri::command]
pub fn is_start_recording_dock_open(global_state: State<'_, GlobalState>) -> bool {
  global_state.is_window_open(&WindowLabel::StartRecordingDock)
}

#[tauri::command]
pub fn is_recording_input_options_open(global_state: State<'_, GlobalState>) -> bool {
  global_state.is_window_open(&WindowLabel::RecordingInputOptions)
}

#[tauri::command]
pub async fn expand_recording_source_selector(
  app_handle: AppHandle,
  size: Option<LogicalSize<f64>>,
) {
  let window = app_handle
    .get_webview_window(WindowLabel::RecordingSourceSelector.as_ref())
    .unwrap();

  let target_size = if let Some(has_size) = size {
    has_size
  } else {
    LogicalSize {
      width: 500.0,
      height: 250.0,
    }
  };

  animate_resize(window, target_size);

  let global_state: State<'_, GlobalState> = app_handle.state();
  global_state.window_opened(WindowLabel::RecordingSourceSelector);
}

#[tauri::command]
pub async fn collapse_recording_source_selector(app_handle: AppHandle) {
  let global_state: State<'_, GlobalState> = app_handle.state();
  global_state.window_closed(WindowLabel::RecordingSourceSelector);

  let window = app_handle
    .get_webview_window(WindowLabel::RecordingSourceSelector.as_ref())
    .unwrap();

  let target_size = LogicalSize {
    width: 300.0,
    height: 40.0,
  };

  animate_resize(window.clone(), target_size);
}

/// Reset panels to default state.
#[tauri::command]
pub fn reset_panels(app_handle: AppHandle, global_state: State<'_, GlobalState>) {
  if global_state.is_window_open(&WindowLabel::RecordingSourceSelector) {
    tauri::async_runtime::block_on(collapse_recording_source_selector(app_handle.clone()));
  }

  let _ = app_handle
    .get_webview_window(WindowLabel::RecordingInputOptions.as_ref())
    .unwrap()
    .hide();

  let _ = app_handle
    .get_webview_window(WindowLabel::StandaloneListbox.as_ref())
    .unwrap()
    .hide();
}

#[tauri::command]
pub fn get_dock_bounds(app_handle: AppHandle) -> Bounds {
  let dock = app_handle
    .get_webview_window(WindowLabel::StartRecordingDock.as_ref())
    .unwrap();
  let source_selector = app_handle
    .get_webview_window(WindowLabel::RecordingSourceSelector.as_ref())
    .unwrap();

  let scale_factor = dock.scale_factor().unwrap();
  let dock_position = dock
    .outer_position()
    .unwrap()
    .to_logical::<f64>(scale_factor);
  let dock_size = dock.outer_size().unwrap().to_logical::<f64>(scale_factor);

  let source_selector_position = source_selector
    .outer_position()
    .unwrap()
    .to_logical::<f64>(scale_factor);

  let start_point = LogicalPosition {
    x: dock_position.x,
    y: source_selector_position.y,
  };
  let end_point = LogicalPosition {
    x: dock_position.x + dock_size.width,
    y: dock_position.y + dock_size.height,
  };

  let display_id = match dock.current_monitor() {
    Ok(Some(monitor)) => monitor.name().cloned(),
    _ => None,
  };
  Bounds {
    start_point,
    end_point,
    display_id,
  }
}

#[tauri::command]
#[cfg(target_os = "macos")]
pub fn update_dock_opacity(app_handle: AppHandle, opacity: f64) {
  let dock = app_handle
    .get_webview_panel(WindowLabel::StartRecordingDock.as_ref())
    .unwrap();

  let source_selector = app_handle
    .get_webview_panel(WindowLabel::RecordingSourceSelector.as_ref())
    .unwrap();

  dock.set_alpha_value(opacity);
  source_selector.set_alpha_value(opacity);
}

#[tauri::command]
#[cfg(target_os = "windows")]
pub fn update_dock_opacity(app_handle: AppHandle, opacity: f64) {
  use crate::windows::service::set_hwnd_opacity;
  use windows::Win32::Foundation::HWND;

  let dock = app_handle.get_webview_window(WindowLabel::StartRecordingDock.as_ref());
  let source_selector =
    app_handle.get_webview_window(WindowLabel::RecordingSourceSelector.as_ref());

  if let (Some(dock), Some(source_selector)) = (dock, source_selector) {
    if let Ok(dock_hwnd) = dock.hwnd() {
      set_hwnd_opacity(HWND(dock_hwnd.0), opacity);
    }

    if let Ok(source_selector_hwnd) = source_selector.hwnd() {
      set_hwnd_opacity(HWND(source_selector_hwnd.0), opacity);
    }
  }
}
