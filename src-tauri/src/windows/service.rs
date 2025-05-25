use std::{ffi::CString, sync::Mutex};

use border::WebviewWindowExt as BorderWebviewWindowExt;
use cocoa::{
  appkit::{NSMainMenuWindowLevel, NSWindowCollectionBehavior},
  base::{id, nil},
};
use objc::{class, msg_send, sel, sel_impl};
use tauri::{
  utils::config::WindowEffectsConfig,
  window::{Effect, EffectState},
  AppHandle, Emitter, Listener, LogicalSize, Manager, PhysicalPosition, Size, State, WebviewWindow,
  WebviewWindowBuilder,
};
use tauri_nspanel::{block::ConcreteBlock, panel_delegate, ManagerExt, WebviewWindowExt};

use crate::{
  constants::events::{
    CLOSED_RECORDING_INPUT_OPTIONS, CLOSED_STANDALONE_LISTBOX,
    RECORDING_INPUT_OPTIONS_DID_RESIGN_KEY, STANDALONE_LISTBOX_DID_RESIGN_KEY,
  },
  AppState,
};

#[allow(non_upper_case_globals)]
const NSWindowStyleMaskNonActivatingPanel: i32 = 1 << 7;

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

/// Add window border effect.
pub fn add_border(window: &WebviewWindow) -> tauri::Result<()> {
  window.add_border(None);
  let border = window.border().expect("window has no border");
  border.set_accepts_first_mouse(true);
  Ok(())
}

/// Open the permissions window.
pub async fn open_permissions(app_handle: &AppHandle) {
  let window = WebviewWindowBuilder::new(
    app_handle,
    "request_permissions",
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

pub fn init_start_recording_panel(app_handle: &AppHandle) {
  let window = app_handle
    .get_webview_window("start_recording_dock")
    .unwrap();
  handle_record_dock_positioning(&window).ok();
  add_border(&window).ok();

  let panel = window.to_panel().unwrap();

  panel.set_level(NSMainMenuWindowLevel + 1);

  panel.set_collection_behaviour(
    NSWindowCollectionBehavior::NSWindowCollectionBehaviorFullScreenAuxiliary
      | NSWindowCollectionBehavior::NSWindowCollectionBehaviorCanJoinAllSpaces
      | NSWindowCollectionBehavior::NSWindowCollectionBehaviorStationary,
  );

  panel.set_style_mask(NSWindowStyleMaskNonActivatingPanel);

  let window = app_handle
    .get_webview_window("start_recording_dock")
    .unwrap();
  unsafe {
    let ns_window: id = window.ns_window().unwrap() as id;
    // Available enum values: https://github.com/phracker/MacOSX-SDKs/blob/master/MacOSX10.9.sdk/System/Library/Frameworks/AppKit.framework/Versions/C/Headers/NSWindow.h?#L131
    let _: () = msg_send![ns_window, setAnimationBehavior: 3];
  }

  panel.order_out(None);
}

pub fn swizzle_to_standalone_listbox_panel(app_handle: &AppHandle) {
  let panel_delegate = panel_delegate!(StandaloneListBoxDelegate {
    window_did_resign_key,
  });

  let window = app_handle.get_webview_window("standalone_listbox").unwrap();
  let panel = window.to_panel().unwrap();

  let handle = app_handle.clone();

  panel_delegate.set_listener(Box::new(move |delegate_name: String| {
    if delegate_name.as_str() == "window_did_resign_key" {
      let _ = handle.emit(STANDALONE_LISTBOX_DID_RESIGN_KEY, ());
    }
  }));

  panel.set_level(NSMainMenuWindowLevel + 3);

  panel.set_collection_behaviour(
    NSWindowCollectionBehavior::NSWindowCollectionBehaviorFullScreenAuxiliary
      | NSWindowCollectionBehavior::NSWindowCollectionBehaviorCanJoinAllSpaces
      | NSWindowCollectionBehavior::NSWindowCollectionBehaviorStationary,
  );

  panel.set_delegate(panel_delegate);

  // Necessary to show above fullscreen apps
  panel.set_style_mask(NSWindowStyleMaskNonActivatingPanel);
  panel.order_out(None);
}

pub fn setup_standalone_listbox_listeners(app_handle: &AppHandle) {
  fn hide_standalone_listbox_panel(app_handle: &AppHandle) {
    if check_orbit_cursor_frontmost() {
      return;
    }

    let panel = app_handle.get_webview_panel("standalone_listbox").unwrap();
    let _ = app_handle.emit(CLOSED_STANDALONE_LISTBOX, ());
    panel.order_out(None);
  }

  let handle = app_handle.clone();

  app_handle.listen_any(STANDALONE_LISTBOX_DID_RESIGN_KEY, move |_| {
    hide_standalone_listbox_panel(&handle);
  });

  let handle = app_handle.clone();

  let callback = Box::new(move || {
    hide_standalone_listbox_panel(&handle);
  });

  register_workspace_listener(
    "NSWorkspaceDidActivateApplicationNotification".into(),
    callback.clone(),
  );
}

pub fn position_and_size_standalone_listbox_panel(
  app_handle: &AppHandle,
  x: f64,
  y: f64,
  width: f64,
  height: f64,
) {
  let window = app_handle.get_webview_window("standalone_listbox").unwrap();
  window.set_position(PhysicalPosition { x, y }).ok();
  window
    .set_size(Size::Logical(LogicalSize { width, height }))
    .ok();
}

pub fn swizzle_to_recording_input_options_panel(app_handle: &AppHandle) {
  let window = app_handle
    .get_webview_window("recording_input_options")
    .unwrap();
  add_border(&window).ok();

  let panel = window.to_panel().unwrap();

  panel.set_level(NSMainMenuWindowLevel + 2);

  panel.set_collection_behaviour(
    NSWindowCollectionBehavior::NSWindowCollectionBehaviorFullScreenAuxiliary
      | NSWindowCollectionBehavior::NSWindowCollectionBehaviorCanJoinAllSpaces
      | NSWindowCollectionBehavior::NSWindowCollectionBehaviorStationary,
  );

  panel.set_style_mask(NSWindowStyleMaskNonActivatingPanel);
  panel.order_out(None);
}

pub fn position_recording_input_options_panel(app_handle: &AppHandle, x: i32) {
  let margin_bottom = 20;
  let dock = app_handle
    .get_webview_window("start_recording_dock")
    .unwrap();
  let window = app_handle
    .get_webview_window("recording_input_options")
    .unwrap();

  window
    .set_position(PhysicalPosition {
      x: x - (window.outer_size().unwrap().width as i32) / 2,
      y: dock.outer_position().unwrap().y
        - window.outer_size().unwrap().height as i32
        - margin_bottom,
    })
    .ok();
}

pub fn setup_recording_input_options_listener(app_handle: &AppHandle) {
  fn hide_recording_input_options(app_handle: &AppHandle) {
    if check_orbit_cursor_frontmost() {
      return;
    }

    let panel = app_handle
      .get_webview_panel("recording_input_options")
      .unwrap();
    let _ = app_handle.emit(CLOSED_RECORDING_INPUT_OPTIONS, ());
    panel.order_out(None);

    let state: State<'_, Mutex<AppState>> = app_handle.state();
    state.lock().unwrap().recording_input_options_opened = false;
  }

  let handle = app_handle.clone();

  app_handle.listen_any(RECORDING_INPUT_OPTIONS_DID_RESIGN_KEY, move |_| {
    hide_recording_input_options(&handle);
  });

  let handle = app_handle.clone();

  let callback = Box::new(move || {
    hide_recording_input_options(&handle);
  });

  register_workspace_listener(
    "NSWorkspaceDidActivateApplicationNotification".into(),
    callback.clone(),
  );
}

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
