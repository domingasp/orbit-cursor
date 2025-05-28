use std::{ffi::CString, sync::Arc};

use border::WebviewWindowExt as BorderWebviewWindowExt;
use cocoa::{
  appkit::{NSMainMenuWindowLevel, NSWindowCollectionBehavior},
  base::{id, nil},
};
use objc::{class, msg_send, sel, sel_impl};
use tauri::{
  utils::config::WindowEffectsConfig,
  window::{Effect, EffectState},
  AppHandle, Emitter, Listener, LogicalSize, Manager, PhysicalPosition, Size, WebviewWindow,
  WebviewWindowBuilder,
};
use tauri_nspanel::{block::ConcreteBlock, panel_delegate, ManagerExt, WebviewWindowExt};

use crate::constants::{Events, PanelLevel, WindowLabel};

#[allow(non_upper_case_globals)]
const NSWindowStyleMaskNonActivatingPanel: i32 = 1 << 7;

// region: Initialize Windows

pub fn init_start_recording_panel(app_handle: &AppHandle) {
  let window = app_handle
    .get_webview_window(WindowLabel::StartRecordingDock.as_ref())
    .unwrap();
  handle_record_dock_positioning(&window).ok();
  add_border(&window).ok();
  add_animation_to_window(&window, 3);

  let panel = window.to_panel().unwrap();

  panel.set_level(NSMainMenuWindowLevel + PanelLevel::StartRecordingDock.value());

  panel.set_collection_behaviour(
    NSWindowCollectionBehavior::NSWindowCollectionBehaviorFullScreenAuxiliary
      | NSWindowCollectionBehavior::NSWindowCollectionBehaviorCanJoinAllSpaces
      | NSWindowCollectionBehavior::NSWindowCollectionBehaviorStationary,
  );

  panel.set_style_mask(NSWindowStyleMaskNonActivatingPanel);
  panel.order_out(None);
}

pub fn swizzle_to_standalone_listbox_panel(app_handle: &AppHandle) {
  let window = app_handle
    .get_webview_window(WindowLabel::StandaloneListbox.as_ref())
    .unwrap();
  let panel = window.to_panel().unwrap();

  let handle = app_handle.clone();

  panel.set_level(NSMainMenuWindowLevel + PanelLevel::StandaloneListBox.value());

  panel.set_collection_behaviour(
    NSWindowCollectionBehavior::NSWindowCollectionBehaviorFullScreenAuxiliary
      | NSWindowCollectionBehavior::NSWindowCollectionBehaviorCanJoinAllSpaces
      | NSWindowCollectionBehavior::NSWindowCollectionBehaviorStationary,
  );

  let panel_delegate = panel_delegate!(StandaloneListBoxDelegate {
    window_did_resign_key,
  });
  panel_delegate.set_listener(Box::new(move |delegate_name: String| {
    if delegate_name.as_str() == "window_did_resign_key" {
      let _ = handle.emit(Events::StandaloneListboxDidResignKey.as_ref(), ());
    }
  }));
  panel.set_delegate(panel_delegate);

  // Necessary to show above fullscreen apps
  panel.set_style_mask(NSWindowStyleMaskNonActivatingPanel);
  panel.order_out(None);
}

pub fn swizzle_to_recording_input_options_panel(app_handle: &AppHandle) {
  let window = app_handle
    .get_webview_window(WindowLabel::RecordingInputOptions.as_ref())
    .unwrap();
  add_border(&window).ok();

  let panel = window.to_panel().unwrap();

  panel.set_level(NSMainMenuWindowLevel + PanelLevel::RecordingInputOptions.value());

  panel.set_collection_behaviour(
    NSWindowCollectionBehavior::NSWindowCollectionBehaviorFullScreenAuxiliary
      | NSWindowCollectionBehavior::NSWindowCollectionBehaviorCanJoinAllSpaces
      | NSWindowCollectionBehavior::NSWindowCollectionBehaviorStationary,
  );

  panel.set_style_mask(NSWindowStyleMaskNonActivatingPanel);
  panel.order_out(None);
}

/// Attach event listener which closes panel on event.
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
    if check_orbit_cursor_frontmost() {
      return;
    }

    if let Ok(panel) = app_handle.get_webview_panel(window_label.as_ref()) {
      panel.order_out(None);
    }
  }

  let close_callback_arc: Arc<F> = Arc::new(close_callback);

  let listener_handle = app_handle.clone();
  let listener_close_callback = close_callback_arc.clone();
  app_handle.listen_any(event_to_listen_for.as_ref(), move |_| {
    hide_panel(&listener_handle, window_label);
    listener_close_callback(&listener_handle);
  });

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

/// Open the permissions window.
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

  add_border(&window).ok();

  window.show().ok();
}

// endregion

// region: Layout

/// Position and size window according to parameters.
pub fn position_and_size_window(
  webview_window: WebviewWindow,
  x: f64,
  y: f64,
  width: f64,
  height: f64,
) {
  webview_window.set_position(PhysicalPosition { x, y }).ok();
  webview_window
    .set_size(Size::Logical(LogicalSize { width, height }))
    .ok();
}

/// Position window above recording dock, `x` parameter determines the x position.
pub fn position_window_above_dock(app_handle: &AppHandle, window_label: WindowLabel, x: f64) {
  let margin_bottom = 20.0;
  let dock = app_handle
    .get_webview_window(WindowLabel::StartRecordingDock.as_ref())
    .unwrap();
  let window = app_handle
    .get_webview_window(window_label.as_ref())
    .unwrap();

  window
    .set_position(PhysicalPosition {
      x: x - (window.outer_size().unwrap().width as f64) / 2.0,
      y: dock.outer_position().unwrap().y as f64
        - window.outer_size().unwrap().height as f64
        - margin_bottom,
    })
    .ok();
}

/// Center the window horizontally and 200 px from the bottom of the monitor.
pub fn handle_record_dock_positioning(window: &WebviewWindow) -> tauri::Result<()> {
  let label = window.label();

  if let Some(monitor) = window.current_monitor()? {
    let window_size = window.outer_size()?;
    let monitor_size = monitor.size();

    if label == "start_recording_dock" {
      let x = (monitor_size.width / 2).saturating_sub(window_size.width / 2);
      let y = monitor_size
        .height
        .saturating_sub(window_size.height)
        .saturating_sub(200);
      window.set_position(PhysicalPosition { x, y })?;
    }
  }

  Ok(())
}

// endregion

// region: Utilities

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
pub fn add_border(window: &WebviewWindow) -> tauri::Result<()> {
  window.add_border(None);
  let border = window.border().expect("window has no border");
  border.set_accepts_first_mouse(true);
  Ok(())
}

/// [MacOS] Add animation behaviour.
///
/// Available values: https://github.com/phracker/MacOSX-SDKs/blob/master/MacOSX10.9.sdk/System/Library/Frameworks/AppKit.framework/Versions/C/Headers/NSWindow.h?#L131
fn add_animation_to_window(window: &WebviewWindow, animation_behaviour: u32) {
  unsafe {
    let ns_window: id = window.ns_window().unwrap() as id;
    let _: () = msg_send![ns_window, setAnimationBehavior: animation_behaviour];
  }
}

fn app_pid() -> i32 {
  let process_info: id = unsafe { msg_send![class!(NSProcessInfo), processInfo] };
  let pid: i32 = unsafe { msg_send![process_info, processIdentifier] };
  pid
}

fn get_frontmost_app_pid() -> i32 {
  let workspace: id = unsafe { msg_send![class!(NSWorkspace), sharedWorkspace] };
  let frontmost_application: id = unsafe { msg_send![workspace, frontmostApplication] };
  let pid: i32 = unsafe { msg_send![frontmost_application, processIdentifier] };
  pid
}

pub fn check_orbit_cursor_frontmost() -> bool {
  get_frontmost_app_pid() == app_pid()
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

// endregion
