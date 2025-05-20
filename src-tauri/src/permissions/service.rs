use std::{ collections::HashMap, sync::Arc, time::Duration };

use tauri::{ AppHandle, Emitter, Wry };
use tauri_plugin_macos_permissions::{
  check_accessibility_permission,
  check_camera_permission,
  check_microphone_permission,
  check_screen_recording_permission,
  request_accessibility_permission,
  request_camera_permission,
  request_microphone_permission,
  request_screen_recording_permission,
};
use tauri_plugin_store::{ Store, StoreExt };
use tokio::time::interval;

use crate::{
  permissions::models::NativeRequestablePermissions,
  store::constants::{ NATIVE_REQUESTABLE_PERMISSIONS, STORE_NAME },
};

use super::models::{ CheckPermissionsResponse, PermissionStatus, PermissionType };

/// Verify app has all required permissions.
pub async fn ensure_permissions() -> bool {
  let screen = check_screen_recording_permission().await;
  let accessibility = check_accessibility_permission().await;
  screen && accessibility
}

pub async fn check_permissions(store: Arc<Store<Wry>>) -> CheckPermissionsResponse {
  fn insert_permission(
    map: &mut HashMap<String, PermissionStatus>,
    permission_name: &str,
    can_request: bool,
    has_access: bool
  ) {
    map.insert(permission_name.to_string(), PermissionStatus {
      can_request,
      has_access,
    });
  }

  let (accessibility, screen, microphone, camera) = tokio::join!(
    check_accessibility_permission(),
    check_screen_recording_permission(),
    check_microphone_permission(),
    check_camera_permission()
  );

  let native_requestable_permissions: NativeRequestablePermissions = serde_json
    ::from_value(store.get(NATIVE_REQUESTABLE_PERMISSIONS).unwrap())
    .unwrap();

  let mut permissions_map: HashMap<String, PermissionStatus> = HashMap::new();

  insert_permission(
    &mut permissions_map,
    "accessibility",
    native_requestable_permissions.accessibility,
    accessibility
  );

  insert_permission(&mut permissions_map, "screen", native_requestable_permissions.screen, screen);

  insert_permission(
    &mut permissions_map,
    "microphone",
    native_requestable_permissions.microphone,
    microphone
  );

  insert_permission(&mut permissions_map, "camera", native_requestable_permissions.camera, camera);

  CheckPermissionsResponse {
    permissions: permissions_map,
  }
}

/// Polls permissions every seconds - returns once all required permissions granted.
pub async fn monitor_permissions(app_handle: Arc<AppHandle>) -> Result<(), String> {
  let mut interval = interval(Duration::from_secs(1));

  loop {
    interval.tick().await;

    let response = check_permissions(app_handle.store(STORE_NAME).unwrap()).await;
    let all_granted = response.permissions.values().all(|p| p.has_access);

    app_handle
      .emit("monitor-permissions", response.permissions)
      .map_err(|e| format!("Failed to emit monitor-permissions event: {}", e))?;

    if all_granted {
      break;
    }
  }

  Ok(())
}

pub async fn request_permission(
  store: Arc<Store<Wry>>,
  permission: PermissionType
) -> Result<(), String> {
  match permission {
    PermissionType::Accessibility => request_accessibility_permission().await,
    PermissionType::Screen => request_screen_recording_permission().await,
    PermissionType::Microphone => request_microphone_permission().await?,
    PermissionType::Camera => request_camera_permission().await?,
  }

  // After requesting the first time we need to update permission tracking.
  let mut native_requestable_permissions = store
    .get(NATIVE_REQUESTABLE_PERMISSIONS)
    .and_then(|v| v.as_object().cloned())
    .unwrap();

  native_requestable_permissions.insert(permission.to_string(), serde_json::Value::Bool(false));

  store.set(NATIVE_REQUESTABLE_PERMISSIONS, native_requestable_permissions);

  Ok(())
}
