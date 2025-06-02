use serde::Serialize;
use tauri::LogicalPosition;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Bounds {
  pub start_point: LogicalPosition<f64>,
  pub end_point: LogicalPosition<f64>,
}
