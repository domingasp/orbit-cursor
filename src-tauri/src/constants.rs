use strum_macros::{AsRefStr, Display, EnumString};

pub mod store {
  pub const STORE_NAME: &str = "orbit-cursor-store.json";
  pub const FIRST_RUN: &str = "firstRun";
  pub const NATIVE_REQUESTABLE_PERMISSIONS: &str = "nativeRequestablePermissions";
}

pub mod events {
  pub const SYSTEM_AUDIO_STREAM_ERROR: &str = "system_audio_stream_error";
  pub const INPUT_AUDIO_STREAM_ERROR: &str = "input_audio_stream_error";
  pub const STANDALONE_LISTBOX_DID_RESIGN_KEY: &str = "standalone_listbox_did_resign_key";
  pub const RECORDING_INPUT_OPTIONS_DID_RESIGN_KEY: &str = "recording_input_options_did_resign_key";
  pub const MONITOR_PERMISSIONS: &str = "monitor_permissions";
  pub const START_RECORDING_DOCK_OPENED: &str = "start_recording_dock_opened";
  pub const RECORDING_INPUT_OPTIONS_OPENED: &str = "recording_input_options_opened";
  pub const CLOSED_STANDALONE_LISTBOX: &str = "closed_standalone_listbox";
  pub const CLOSED_RECORDING_INPUT_OPTIONS: &str = "closed_recording_input_options";
}

#[derive(EnumString, AsRefStr, Display, Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum WindowLabel {
  #[strum(serialize = "start_recording_dock")]
  StartRecordingDock,

  #[strum(serialize = "standalone_listbox")]
  StandaloneListbox,

  #[strum(serialize = "recording_input_options")]
  RecordingInputOptions,
}
