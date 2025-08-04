use std::{sync::Arc, time::Duration};

use once_cell::sync::Lazy;
use parking_lot::Mutex;
use rdev::{Button, EventType};
use tauri::{
  AppHandle, Emitter, Listener, LogicalPosition, LogicalSize, Manager, State, WebviewWindow,
  WindowEvent,
};

#[cfg(target_os = "macos")]
use std::ffi::CString;
#[cfg(target_os = "macos")]
use tauri::{
  utils::config::WindowEffectsConfig,
  window::{Effect, EffectState},
  WebviewWindowBuilder,
};

use tokio::sync::broadcast::Receiver;

#[cfg(target_os = "macos")]
use tauri_nspanel::{
  block::ConcreteBlock,
  objc_id::{Id, Shared},
  raw_nspanel::RawNSPanel,
  WebviewWindowExt,
};

#[cfg(target_os = "macos")]
use border::WebviewWindowExt as BorderWebviewWindowExt;

#[cfg(target_os = "macos")]
use cocoa::{
  appkit::{NSMainMenuWindowLevel, NSWindowCollectionBehavior},
  base::{id, nil},
};

#[cfg(target_os = "macos")]
use crate::constants::PanelLevel;
#[cfg(target_os = "macos")]
use objc::{class, msg_send, sel, sel_impl};

use crate::{
  constants::{Events, WindowLabel},
  models::EditingState,
  windows::commands::collapse_recording_source_selector,
};

#[allow(non_upper_case_globals)]
#[cfg(target_os = "macos")]
const NSWindowStyleMaskNonActivatingPanel: i32 = 1 << 7;

pub fn editor_close_listener(app_handle: &AppHandle) {
  let editor = app_handle
    .get_webview_window(WindowLabel::Editor.as_ref())
    .unwrap();

  let editor_clone = editor.clone();
  let app_handle_for_listener = app_handle.clone();

  editor.on_window_event(move |event| {
    if let WindowEvent::CloseRequested { api, .. } = event {
      api.prevent_close();

      {
        let editing_state: State<'_, Mutex<EditingState>> = app_handle_for_listener.state();
        editing_state.lock().editing_stopped();
      }

      let _ = editor_clone.hide();
      let _ = app_handle_for_listener.emit(Events::ClosedEditor.as_ref(), ());

      #[cfg(target_os = "macos")]
      let _ = app_handle_for_listener.set_activation_policy(tauri::ActivationPolicy::Accessory);
    }
  });
}

/// Convert a Webview Window into a stationary NSPanel.
#[cfg(target_os = "macos")]
pub fn convert_to_stationary_panel(
  window: &WebviewWindow,
  level: PanelLevel,
) -> Id<RawNSPanel, Shared> {
  let panel = window.to_panel().unwrap();
  panel.set_level(NSMainMenuWindowLevel + level.value());
  panel.set_collection_behaviour(
    NSWindowCollectionBehavior::NSWindowCollectionBehaviorFullScreenAuxiliary
      | NSWindowCollectionBehavior::NSWindowCollectionBehaviorCanJoinAllSpaces
      | NSWindowCollectionBehavior::NSWindowCollectionBehaviorStationary,
  );

  // Necessary to show above fullscreen apps
  panel.set_style_mask(NSWindowStyleMaskNonActivatingPanel);

  let _ = window.hide();
  panel
}

#[cfg(target_os = "windows")]
pub fn convert_to_stationary_panel(window: &WebviewWindow) {
  let _ = window.set_skip_taskbar(true);
}

/// Attach event listener which closes panel on `event_to_listen_for`.
///
/// Execute custom `close_callback` if provided.
pub fn add_close_panel_listener<F>(
  app_handle: AppHandle,
  window_label: WindowLabel,
  event_to_listen_for: Events,
  close_callback: F,
) where
  F: Fn(&AppHandle) + Send + Sync + 'static,
{
  fn hide_panel(app_handle: &AppHandle, window_label: WindowLabel) {
    if let Some(panel) = app_handle.get_webview_window(window_label.as_ref()) {
      panel.hide().ok();
    }
  }

  let close_callback_arc: Arc<F> = Arc::new(close_callback);

  let listener_handle = app_handle.clone();
  let listener_close_callback = close_callback_arc.clone();
  app_handle.listen_any(event_to_listen_for.as_ref(), move |_| {
    hide_panel(&listener_handle, window_label);
    listener_close_callback(&listener_handle);
  });

  #[cfg(target_os = "macos")]
  {
    let workspace_handle = app_handle.clone();
    let workspace_close_callback = close_callback_arc.clone();
    register_workspace_listener(
      "NSWorkspaceDidActivateApplicationNotification".into(),
      Box::new(move || {
        hide_panel(&workspace_handle, window_label);
        workspace_close_callback(&workspace_handle);
      }),
    );
  }
}

/// Open the permissions window.
#[cfg(target_os = "macos")]
pub async fn open_permissions(app_handle: &AppHandle) {
  let window = WebviewWindowBuilder::new(
    app_handle,
    WindowLabel::RequestPermissions.as_ref(),
    tauri::WebviewUrl::App("/request-permissions".into()),
  )
  .title("Request Permissions")
  .inner_size(540.0, 432.0)
  .decorations(false)
  .resizable(false)
  .shadow(true)
  .transparent(true)
  .closable(false)
  .effects(WindowEffectsConfig {
    effects: vec![Effect::UnderWindowBackground],
    state: Some(EffectState::Active),
    radius: Some(10.0),
    color: None,
  })
  .build()
  .unwrap();

  add_border(&window);

  window.show().ok();
}

/// Position window above recording dock, `x` parameter determines the x position.
pub fn position_window_above_dock(app_handle: AppHandle, window_label: WindowLabel, x: f64) {
  let margin_bottom = 5.0;

  let dock = app_handle
    .get_webview_window(WindowLabel::StartRecordingDock.as_ref())
    .unwrap();
  let window = app_handle
    .get_webview_window(window_label.as_ref())
    .unwrap();
  let scale_factor = window.scale_factor().unwrap();

  let window_logical_size = window.outer_size().unwrap().to_logical::<f64>(scale_factor);
  let dock_y = dock
    .outer_position()
    .unwrap()
    .to_logical::<f64>(scale_factor)
    .y;

  window
    .set_position(LogicalPosition {
      x: x - (window_logical_size.width) / 2.0,
      y: dock_y - window_logical_size.height - margin_bottom,
    })
    .ok();
}

/// Center the window horizontally and 200 px from the bottom of the monitor.
pub fn handle_dock_positioning(window: &WebviewWindow) {
  if let Ok(Some(monitor)) = window.current_monitor() {
    let scale_factor = monitor.scale_factor();
    let window_size = window.outer_size().unwrap().to_logical::<f64>(scale_factor);
    let monitor_size = monitor.size().to_logical::<f64>(scale_factor);

    let x = (monitor_size.width / 2.0) - (window_size.width / 2.0);
    let y = monitor_size.height - window_size.height - 100.0;

    let _ = window.set_position(LogicalPosition { x, y });
  }
}

pub fn position_recording_source_selector(app_handle: AppHandle, window: &WebviewWindow) {
  let scale_factor = window.scale_factor().unwrap();
  let dock = app_handle
    .get_webview_window(WindowLabel::StartRecordingDock.as_ref())
    .unwrap();

  let dock_pos = dock
    .outer_position()
    .unwrap()
    .to_logical::<f64>(scale_factor);
  let dock_size = dock.outer_size().unwrap().to_logical::<f64>(scale_factor);

  position_window_above_dock(
    app_handle,
    WindowLabel::RecordingSourceSelector,
    dock_pos.x + (dock_size.width / 2.0),
  );
}

pub fn position_recording_dock(window: &WebviewWindow) {
  if let Ok(Some(monitor)) = window.current_monitor() {
    let scale_factor = monitor.scale_factor();
    let window_size = window.outer_size().unwrap().to_logical::<f64>(scale_factor);
    let monitor_size = monitor.size().to_logical::<f64>(scale_factor);

    let margin = 10.0;
    let x = monitor_size.width / 2.0 - window_size.width / 2.0;
    let y = window_size.height + margin;

    let _ = window.set_position(LogicalPosition { x, y });
  }
}

#[cfg(target_os = "macos")]
fn register_workspace_listener(name: String, callback: Box<dyn Fn()>) {
  let workspace: id = unsafe { msg_send![class!(NSWorkspace), sharedWorkspace] };

  let notification_center: id = unsafe { msg_send![workspace, notificationCenter] };

  let block = ConcreteBlock::new(move |_notification: id| callback());

  let name: id =
    unsafe { msg_send![class!(NSString), stringWithCString: CString::new(name).unwrap()] };

  unsafe {
    let _: () = msg_send![
      notification_center,
      addObserverForName: name object: nil queue: nil usingBlock: block
    ];
  }
}

/// Add window border effect.
#[cfg(target_os = "macos")]
pub fn add_border(window: &WebviewWindow) {
  window.add_border(None);
  let border = window.border().expect("window has no border");
  border.set_accepts_first_mouse(true);
}

/// Add animation behaviour.
///
/// Available values: https://github.com/phracker/MacOSX-SDKs/blob/master/MacOSX10.9.sdk/System/Library/Frameworks/AppKit.framework/Versions/C/Headers/NSWindow.h?#L131
#[cfg(target_os = "macos")]
pub fn add_animation(window: &WebviewWindow, animation_behaviour: u32) {
  unsafe {
    let ns_window: id = window.ns_window().unwrap() as id;
    let _: () = msg_send![ns_window, setAnimationBehavior: animation_behaviour];
  }
}

pub fn is_coordinate_in_window(x: f64, y: f64, window: &WebviewWindow) -> bool {
  let Ok(size) = window.outer_size() else {
    return false;
  };

  let Ok(position) = window.outer_position() else {
    return false;
  };

  let Ok(scale_factor) = window.scale_factor() else {
    return false;
  };
  let top = position.y as f64 / scale_factor;
  let bottom = top + (size.height as f64 / scale_factor);
  let left = position.x as f64 / scale_factor;
  let right = left + (size.width as f64 / scale_factor);

  y >= top && y <= bottom && x >= left && x <= right
}

#[allow(dead_code)]
#[derive(Debug, Copy, Clone)]
pub enum Anchor {
  Bottom,
  Left,
  Top,
  Right,
}

/// Resize window to target size with transition.
///
/// When no anchor provided sizing happens from top-left.
pub fn animate_resize(
  window: WebviewWindow,
  target_size: LogicalSize<f64>,
  anchor: Option<Anchor>,
) {
  // TODO refactor - shifts around on windows
  std::thread::spawn(move || {
    let steps = 60;
    let delay = Duration::from_millis(175 / steps);

    let start_size = window
      .outer_size()
      .unwrap()
      .to_logical::<f64>(window.scale_factor().unwrap());

    let start_position = window
      .outer_position()
      .unwrap()
      .to_logical::<f64>(window.scale_factor().unwrap());

    let start_x = start_position.x;
    let start_y = start_position.y;
    let start_width = start_size.width;
    let start_height = start_size.height;

    let delta_width = target_size.width - start_width;
    let delta_height = target_size.height - start_height;

    for i in 1..=steps {
      let t = i as f64 / steps as f64;

      let transition_width = start_width + delta_width * t;
      let transition_height = start_height + delta_height * t;

      let _ = window.set_size(LogicalSize::new(transition_width, transition_height));

      if let Some(anchor) = anchor {
        let (offset_x, offset_y) = match anchor {
          Anchor::Bottom => (
            (start_width - transition_width) / 2.0,
            start_height - transition_height,
          ),
          Anchor::Left => (0.0, (start_height - transition_height) / 2.0),
          Anchor::Top => ((start_width - transition_width) / 2.0, 0.0),
          Anchor::Right => (
            start_width - transition_width,
            (start_height - transition_height) / 2.0,
          ),
        };

        let new_x = start_x + offset_x;
        let new_y = start_y + offset_y;

        let _ = window.set_position(LogicalPosition::new(new_x, new_y));
      }

      std::thread::sleep(delay);
    }
  });
}

/// Spawn a thread which closes windows based on input events
pub fn spawn_window_close_manager(
  app_handle: AppHandle,
  mut input_event_rx: Receiver<rdev::Event>,
) {
  std::thread::spawn(move || {
    static LAST_MOUSE_POS: Lazy<Mutex<(f64, f64)>> = Lazy::new(|| Mutex::new((0.0, 0.0)));

    loop {
      if let Ok(event) = input_event_rx.blocking_recv() {
        match event.event_type {
          EventType::MouseMove { x, y } => {
            let mut pos = LAST_MOUSE_POS.lock();
            *pos = (x, y);
          }
          EventType::ButtonRelease(Button::Left) => {
            let pos = LAST_MOUSE_POS.lock();

            // Any click should close standalone listbox
            let _ = app_handle.emit(Events::StandaloneListboxDidResignKey.as_ref(), ());

            // Handle recording input options popover
            let recording_input_options_window = app_handle
              .get_webview_window(WindowLabel::RecordingInputOptions.as_ref())
              .unwrap();

            let standalone_listbox_window = app_handle
              .get_webview_window(WindowLabel::StandaloneListbox.as_ref())
              .unwrap();

            let recording_source_selector = app_handle
              .get_webview_window(WindowLabel::RecordingSourceSelector.as_ref())
              .unwrap();

            // Recording input options close detection
            if !is_coordinate_in_window(pos.0, pos.1, &recording_input_options_window)
              && !is_coordinate_in_window(pos.0, pos.1, &standalone_listbox_window)
            {
              let _ = app_handle.emit(Events::RecordingInputOptionsDidResignKey.as_ref(), ());
            }

            // Region source selector collapse detection
            if !is_coordinate_in_window(pos.0, pos.1, &recording_source_selector) {
              collapse_recording_source_selector(app_handle.clone(), app_handle.state());
              let _ = app_handle.emit(Events::CollapsedRecordingSourceSelector.as_ref(), ());
            }
          }
          _ => {}
        }
      }
    }
  });
}
