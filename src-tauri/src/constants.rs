use strum_macros::{AsRefStr, Display, EnumString};

pub mod store {
  pub const STORE_NAME: &str = "orbit-cursor-store.json";
  pub const FIRST_RUN: &str = "firstRun";
  pub const NATIVE_REQUESTABLE_PERMISSIONS: &str = "nativeRequestablePermissions";
}

#[derive(EnumString, AsRefStr, Display, Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Events {
  #[strum(serialize = "system_audio_stream_error")]
  SystemAudioStreamError,

  #[strum(serialize = "input_audio_stream_error")]
  InputAudioStreamError,

  #[strum(serialize = "standalone_listbox_did_resign_key")]
  StandaloneListboxDidResignKey,

  #[strum(serialize = "recording_input_options_did_resign_key")]
  RecordingInputOptionsDidResignKey,

  #[strum(serialize = "monitor_permissions")]
  MonitorPermissions,

  #[strum(serialize = "start_recording_dock_opened")]
  StartRecordingDockOpened,

  #[strum(serialize = "recording_input_options_opened")]
  RecordingInputOptionsOpened,

  #[strum(serialize = "closed_standalone_listbox")]
  ClosedStandaloneListbox,

  #[strum(serialize = "closed_recording_input_options")]
  ClosedRecordingInputOptions,
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
