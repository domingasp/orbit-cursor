pub mod store {
  pub const STORE_NAME: &str = "orbit-cursor-store.json";
  pub const FIRST_RUN: &str = "firstRun";
  pub const NATIVE_REQUESTABLE_PERMISSIONS: &str = "nativeRequestablePermissions";
}

pub mod events {
  pub const SYSTEM_AUDIO_STREAM_ERROR: &str = "system_audio_stream_error";
  pub const INPUT_AUDIO_STREAM_ERROR: &str = "input_audio_stream_error";
  pub const STANDALONE_LISTBOX_DID_RESIGN_KEY: &str = "standalone_listbox_did_resign_key";
  pub const MONITOR_PERMISSIONS: &str = "monitor_permissions";
  pub const START_RECORDING_DOCK_OPENED: &str = "start_recording_dock_opened";
}
