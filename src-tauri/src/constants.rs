use strum_macros::{AsRefStr, Display, EnumString};

pub mod store {
  pub const STORE_NAME: &str = "orbit-cursor-store.json";
  pub const FIRST_RUN: &str = "firstRun";
  #[cfg(target_os = "macos")]
  pub const NATIVE_REQUESTABLE_PERMISSIONS: &str = "nativeRequestablePermissions";
}

#[derive(EnumString, AsRefStr, Display, Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Events {
  #[strum(serialize = "system_audio_stream_error")]
  SystemAudioStreamError,

  #[strum(serialize = "microphone_stream_error")]
  MicrophoneStreamError,

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

  #[strum(serialize = "closed_editor")]
  ClosedEditor,

  #[strum(serialize = "export_progress")]
  ExportProgress,

  #[strum(serialize = "export_complete")]
  ExportComplete,
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

#[cfg(target_os = "macos")]
#[repr(i32)]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum PanelLevel {
  // Starts at 3 as at 1 was causing issues rendering over certain
  // fullscreen apps
  RegionSelector = 3,
  StartRecordingDock = 4,
  RecordingSourceSelector = 5,
  RecordingInputOptions = 6,
  StandaloneListBox = 7,
  RecordingDock = 8,
}

#[cfg(target_os = "macos")]
impl PanelLevel {
  pub fn value(self) -> i32 {
    self as i32
  }
}
