#[tauri::command]
pub fn path_exists(path: String) -> bool {
  std::path::Path::new(&path).exists()
}
