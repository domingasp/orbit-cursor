use std::collections::HashMap;

use serde::{Deserialize, Serialize};
use strum_macros::{AsRefStr, Display, EnumString};

#[derive(
  EnumString, AsRefStr, Display, Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize,
)]
#[serde(rename_all = "lowercase")]
#[strum(serialize_all = "lowercase")]
pub enum PermissionType {
  Accessibility,
  Screen,
  Camera,
  Microphone,
}

#[derive(Debug, Deserialize)]
pub struct NativeRequestablePermissions {
  pub accessibility: bool,
  pub screen: bool,
  pub microphone: bool,
  pub camera: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PermissionStatus {
  pub can_request: bool,
  pub has_access: bool,
}

#[cfg(target_os = "windows")]
impl PermissionStatus {
  pub fn all_true() -> Self {
    PermissionStatus {
      can_request: true,
      has_access: true,
    }
  }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckPermissionsResponse {
  #[serde(flatten)]
  pub permissions: HashMap<String, PermissionStatus>,
}
