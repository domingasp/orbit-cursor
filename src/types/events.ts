export const events = {
  CLOSED_EDITOR: "closed_editor",
  CLOSED_RECORDING_INPUT_OPTIONS: "closed_recording_input_options",
  CLOSED_STANDALONE_LIST_BOX: "closed_standalone_listbox",
  COLLAPSED_RECORDING_SOURCE_SELECTOR: "collapsed_recording_source_selector",
  EXPORT_COMPLETE: "export_complete",
  EXPORT_PROGRESS: "export_progress",
  MICROPHONE_STREAM_ERROR: "microphone_stream_error",
  MONITOR_PERMISSIONS: "monitor_permissions",
  RECORDING_COMPLETE: "recording_complete",
  RECORDING_INPUT_OPTIONS_OPENED: "recording_input_options_opened",
  RECORDING_STARTED: "recording_started",
  START_RECORDING_DOCK_OPENED: "start_recording_dock_opened",
  SYSTEM_AUDIO_STREAM_ERROR: "system_audio_stream_error",
  WINDOW_THUMBNAILS_GENERATED: "window_thumbnails_generated",
} as const;

export type Events = (typeof events)[keyof typeof events];
