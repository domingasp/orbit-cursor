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

  #[strum(serialize = "recording_started")]
  RecordingStarted,

  #[strum(serialize = "closed_standalone_listbox")]
  ClosedStandaloneListbox,

  #[strum(serialize = "closed_recording_input_options")]
  ClosedRecordingInputOptions,

  #[strum(serialize = "collapsed_recording_source_selector")]
  CollapsedRecordingSourceSelector,

  #[strum(serialize = "window_thumbnails_generated")]
  WindowThumbnailsGenerated,

  #[strum(serialize = "recording_complete")]
  RecordingComplete,
}

#[derive(EnumString, AsRefStr, Display, Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum WindowLabel {
  #[strum(serialize = "request_permissions")]
  RequestPermissions,

  #[strum(serialize = "start_recording_dock")]
  StartRecordingDock,

  #[strum(serialize = "standalone_listbox")]
  StandaloneListbox,

  #[strum(serialize = "recording_input_options")]
  RecordingInputOptions,

  #[strum(serialize = "region_selector")]
  RegionSelector,

  #[strum(serialize = "recording_source_selector")]
  RecordingSourceSelector,

  #[strum(serialize = "recording_dock")]
  RecordingDock,

  #[strum(serialize = "editor")]
  Editor,
}

#[repr(i32)]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum PanelLevel {
  RegionSelector = 1,
  StartRecordingDock = 2,
  RecordingSourceSelector = 3,
  RecordingInputOptions = 4,
  StandaloneListBox = 5,
  RecordingDock = 6,
}

impl PanelLevel {
  pub fn value(self) -> i32 {
    self as i32
  }
}
