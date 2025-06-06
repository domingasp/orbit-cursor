use std::sync::{Mutex, Once};

use tauri::{AppHandle, Emitter, LogicalPosition, LogicalSize, Manager, State};
use tauri_nspanel::{panel_delegate, ManagerExt};

use crate::{
  constants::{Events, PanelLevel, WindowLabel},
  AppState,
};

use super::{
  models::Bounds,
  service::{
    add_animation, add_border, add_close_panel_listener, animate_resize,
    convert_to_stationary_panel, position_recording_source_selector, position_window_above_dock,
    Anchor,
  },
};

static INIT_STANDALONE_LISTBOX: Once = Once::new();
static INIT_RECORDING_OPTIONS_PANEL: Once = Once::new();
static INIT_REGION_SELECTOR: Once = Once::new();
static INIT_RECORDING_SOURCE_SELECTOR: Once = Once::new();

#[tauri::command]
pub fn init_standalone_listbox(app_handle: AppHandle) {
  INIT_STANDALONE_LISTBOX.call_once(|| {
    let window = app_handle
      .get_webview_window(WindowLabel::StandaloneListbox.as_ref())
      .unwrap();

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

    add_close_panel_listener(
      app_handle,
      WindowLabel::StandaloneListbox,
      Events::StandaloneListboxDidResignKey,
      move |app_handle| {
        let _ = app_handle.emit(Events::ClosedStandaloneListbox.as_ref(), ());
      },
    );
  });
}

#[tauri::command]
pub fn init_recording_input_options(app_handle: AppHandle) {
  INIT_RECORDING_OPTIONS_PANEL.call_once(|| {
    let window = app_handle
      .get_webview_window(WindowLabel::RecordingInputOptions.as_ref())
      .unwrap();
    add_border(&window);

    let _ = convert_to_stationary_panel(&window, PanelLevel::RecordingInputOptions);

    add_close_panel_listener(
      app_handle,
      WindowLabel::RecordingInputOptions,
      Events::RecordingInputOptionsDidResignKey,
      move |app_handle| {
        let _ = app_handle.emit(Events::ClosedRecordingInputOptions.as_ref(), ());

        let app_state: State<'_, Mutex<AppState>> = app_handle.state();
        let mut state = app_state.lock().unwrap();
        state
          .open_windows
          .insert(WindowLabel::RecordingInputOptions, false);
      },
    );
  });
}

#[tauri::command]
pub fn init_region_selector(app_handle: AppHandle) {
  INIT_REGION_SELECTOR.call_once(|| {
    let window = app_handle
      .get_webview_window(WindowLabel::RegionSelector.as_ref())
      .unwrap();
    let _ = convert_to_stationary_panel(&window, PanelLevel::RegionSelector);
  });
}

#[tauri::command]
pub fn init_recording_source_selector(app_handle: AppHandle) {
  INIT_RECORDING_SOURCE_SELECTOR.call_once(|| {
    let window = app_handle
      .get_webview_window(WindowLabel::RecordingSourceSelector.as_ref())
      .unwrap();
    add_border(&window);
    add_animation(&window, 3);

    position_recording_source_selector(&app_handle, &window);

    let _ = convert_to_stationary_panel(&window, PanelLevel::RecordingSourceSelector);
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

  let panel = app_handle
    .get_webview_panel(WindowLabel::StandaloneListbox.as_ref())
    .unwrap();
  panel.show();
}

#[tauri::command]
pub fn show_recording_input_options(
  app_handle: AppHandle,
  state: State<'_, Mutex<AppState>>,
  x: f64,
) {
  let mut state = state.lock().unwrap();
  state
    .open_windows
    .insert(WindowLabel::RecordingInputOptions, true);

  let panel = app_handle
    .get_webview_panel(WindowLabel::RecordingInputOptions.as_ref())
    .unwrap();
  position_window_above_dock(&app_handle, WindowLabel::RecordingInputOptions, x);
  panel.order_front_regardless();

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
pub fn show_start_recording_dock(app_handle: &AppHandle, state: State<'_, Mutex<AppState>>) {
  let mut state = state.lock().unwrap();
  state
    .open_windows
    .insert(WindowLabel::StartRecordingDock, true);

  let panel = app_handle
    .get_webview_panel(WindowLabel::StartRecordingDock.as_ref())
    .unwrap();
  panel.order_front_regardless();

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

  if let Ok(recording_source_selector) =
    app_handle.get_webview_panel(WindowLabel::RecordingSourceSelector.as_ref())
  {
    state
      .open_windows
      .insert(WindowLabel::RecordingSourceSelector, true);

    let recording_source_selector_window = app_handle
      .get_webview_window(WindowLabel::RecordingSourceSelector.as_ref())
      .unwrap();
    position_recording_source_selector(app_handle, &recording_source_selector_window);
    recording_source_selector.order_front_regardless();
  }
}

#[tauri::command]
pub fn show_region_selector(
  app_handle: AppHandle,
  size: LogicalSize<f64>,
  position: LogicalPosition<f64>,
) {
  let window = app_handle
    .get_webview_window(WindowLabel::RegionSelector.as_ref())
    .unwrap();
  let _ = window.set_size(size);
  let _ = window.set_position(position);

  let panel = app_handle
    .get_webview_panel(WindowLabel::RegionSelector.as_ref())
    .unwrap();
  panel.make_key_and_order_front(None);
  let _ = window.set_focus();
}

#[tauri::command]
pub fn hide_start_recording_dock(app_handle: AppHandle, state: State<'_, Mutex<AppState>>) {
  let mut state = state.lock().unwrap();
  state
    .open_windows
    .insert(WindowLabel::StartRecordingDock, false);
  state.audio_streams.clear();

  let panel = app_handle
    .get_webview_panel(WindowLabel::StartRecordingDock.as_ref())
    .unwrap();
  panel.order_out(None);

  let recording_source_selector = app_handle
    .get_webview_panel(WindowLabel::RecordingSourceSelector.as_ref())
    .unwrap();
  recording_source_selector.order_out(None);
  collapse_recording_source_selector(app_handle);
}

#[tauri::command]
pub fn hide_region_selector(app_handle: AppHandle) {
  let panel = app_handle
    .get_webview_panel(WindowLabel::RegionSelector.as_ref())
    .unwrap();
  panel.order_out(None);
}

#[tauri::command]
pub fn is_start_recording_dock_open(state: State<'_, Mutex<AppState>>) -> bool {
  let state = state.lock().unwrap();
  state
    .open_windows
    .get(&WindowLabel::StartRecordingDock)
    .copied()
    .unwrap_or(false)
}

#[tauri::command]
pub fn is_recording_input_options_open(state: State<'_, Mutex<AppState>>) -> bool {
  let state = state.lock().unwrap();
  state
    .open_windows
    .get(&WindowLabel::RecordingInputOptions)
    .copied()
    .unwrap_or(false)
}

#[tauri::command]
pub fn expand_recording_source_selector(app_handle: AppHandle, size: Option<LogicalSize<f64>>) {
  let window = app_handle
    .get_webview_window(WindowLabel::RecordingSourceSelector.as_ref())
    .unwrap();

  let size = if let Some(has_size) = size {
    has_size
  } else {
    LogicalSize {
      width: 500.0,
      height: 250.0,
    }
  };

  animate_resize(window, size, Some(Anchor::Bottom));
}

#[tauri::command]
pub fn collapse_recording_source_selector(app_handle: AppHandle) {
  let window = app_handle
    .get_webview_window(WindowLabel::RecordingSourceSelector.as_ref())
    .unwrap();

  let size = LogicalSize {
    width: 232.0,
    height: 40.0,
  };
  animate_resize(window, size, Some(Anchor::Bottom));
}

/// Reset panels to default state.
#[tauri::command]
pub fn reset_panels(app_handle: AppHandle) {
  collapse_recording_source_selector(app_handle.clone());

  app_handle
    .get_webview_panel(WindowLabel::RecordingInputOptions.as_ref())
    .unwrap()
    .order_out(None);

  app_handle
    .get_webview_panel(WindowLabel::StandaloneListbox.as_ref())
    .unwrap()
    .order_out(None);
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
