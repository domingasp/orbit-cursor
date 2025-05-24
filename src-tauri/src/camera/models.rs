use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct CameraDetails {
  pub index: String,
  pub name: String,
}
