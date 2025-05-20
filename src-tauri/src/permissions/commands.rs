use tauri::{ AppHandle };
use tauri_plugin_shell::ShellExt;
use tauri_plugin_store::StoreExt;

use crate::STORE_NAME;

use super::{ models::{ CheckPermissionsResponse, PermissionType }, service };

/// Check status of permission.
///
/// Return if access granted and can request.
#[tauri::command]
pub async fn check_permissions(app_handle: AppHandle) -> CheckPermissionsResponse {
  service::check_permissions(app_handle.store(STORE_NAME).unwrap()).await
}

/// Request permission. Only works the first time (MacOS limitation).
#[tauri::command]
pub async fn request_permission(
  app_handle: AppHandle,
  permission: PermissionType
) -> Result<(), String> {
  match service::request_permission(app_handle.store(STORE_NAME).unwrap(), permission).await {
    Ok(()) => Ok(()),
    Err(e) => Err(format!("Error: {}", e)),
  }
}

/// Open MacOS System Settings on Privacy and Security section.
#[tauri::command]
pub async fn open_system_settings(app_handle: AppHandle) -> Result<(), String> {
  let _ = app_handle
    .shell()
    .command("open")
    .arg("x-apple.systempreferences:com.apple.preference.security")
    .spawn();

  Ok(())
}
