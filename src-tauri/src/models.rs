use std::{
  collections::HashMap,
  path::PathBuf,
  sync::{atomic::AtomicBool, Arc},
  thread::JoinHandle,
};

use ffmpeg_sidecar::child::FfmpegChild;
use parking_lot::Mutex;
use rdev::Event;
use scap::capturer::Capturer;
use tokio::sync::broadcast::{self, Receiver, Sender};

use crate::{
  audio::models::AudioStream,
  constants::WindowLabel,
  recording::models::{RecordingManifest, ScreenCaptureDetails, StreamSync},
};

pub struct GlobalState {
  pub open_windows: HashMap<WindowLabel, bool>,
  pub input_event_tx: broadcast::Sender<rdev::Event>,
}

impl GlobalState {
  pub fn new(input_event_tx: Sender<Event>) -> Self {
    GlobalState {
      open_windows: HashMap::from([
        (WindowLabel::StartRecordingDock, false),
        (WindowLabel::RecordingInputOptions, false),
        (WindowLabel::RecordingSourceSelector, false),
      ]),
      input_event_tx,
    }
  }

  pub fn window_closed(&mut self, window: WindowLabel) {
    self.open_windows.insert(window, false);
  }

  pub fn window_opened(&mut self, window: WindowLabel) {
    self.open_windows.insert(window, true);
  }

  pub fn is_window_open(&mut self, window: &WindowLabel) -> bool {
    self.open_windows.get(window).copied().unwrap_or(false)
  }

  pub fn subscribe_to_input_events(&self) -> Receiver<rdev::Event> {
    self.input_event_tx.subscribe()
  }
}

pub struct PreviewState {
  pub audio_streams: HashMap<AudioStream, cpal::Stream>,
  // Opting for a sender rather than storing the stream as stop_stream in nowkha
  // is problematic with CallbackCamera
  pub stop_camera_tx: broadcast::Sender<()>,
}

impl PreviewState {
  pub fn new() -> Self {
    PreviewState {
      audio_streams: HashMap::new(),
      stop_camera_tx: broadcast::channel(1).0,
    }
  }

  pub fn set_audio_stream(&mut self, stream_key: AudioStream, stream: cpal::Stream) {
    self.audio_streams.insert(stream_key, stream);
  }

  pub fn remove_audio_stream(&mut self, stream_key: AudioStream) {
    self.audio_streams.remove(&stream_key);
  }

  pub fn subscribe_to_camera_stop(&self) -> Receiver<()> {
    self.stop_camera_tx.subscribe()
  }

  pub fn stop_camera(&self) {
    let _ = self.stop_camera_tx.send(());
  }
}

pub struct MagnifierState {
  pub magnifier_running: Arc<AtomicBool>,
  pub magnifier_capturer: Option<Capturer>,
}

impl MagnifierState {
  pub fn new() -> Self {
    MagnifierState {
      magnifier_running: Arc::new(AtomicBool::new(false)),
      magnifier_capturer: None,
    }
  }

  pub fn store_magnifier(&mut self, capturer: Capturer) {
    self.magnifier_capturer = Some(capturer)
  }

  pub fn start_magnifier(&mut self) -> (Arc<AtomicBool>, Option<Capturer>) {
    self
      .magnifier_running
      .store(true, std::sync::atomic::Ordering::SeqCst);

    (
      self.magnifier_running.clone(),
      self.magnifier_capturer.take(),
    )
  }

  pub fn stop_magnifier(&mut self) {
    self
      .magnifier_running
      .store(false, std::sync::atomic::Ordering::SeqCst);
  }
}

pub struct StoppedRecording {
  pub manifest: Option<RecordingManifest>,
  pub stream_handles: Option<Vec<JoinHandle<()>>>,
  pub screen_handle: Option<JoinHandle<()>>,
  pub screen_files: Option<Vec<PathBuf>>,
}

pub struct RecordingState {
  pub is_recording: bool,
  pub recording_manifest: Option<RecordingManifest>,
  pub stream_sync: Option<StreamSync>,
  pub stream_handles: Option<Vec<JoinHandle<()>>>,
  pub screen_capture_details: Option<ScreenCaptureDetails>,
  pub screen_files: Option<Vec<PathBuf>>,
  pub screen_stream_handle: Option<JoinHandle<()>>,
}

impl RecordingState {
  pub fn new() -> Self {
    RecordingState {
      is_recording: false,
      recording_manifest: None,
      stream_sync: None,
      stream_handles: None,
      screen_capture_details: None,
      screen_files: None,
      screen_stream_handle: None,
    }
  }

  pub fn recording_started(
    &mut self,
    recording_manifest: RecordingManifest,
    stream_sync: StreamSync,
    stream_handles: Vec<JoinHandle<()>>,
    screen_file: PathBuf,
    screen_stream_handle: JoinHandle<()>,
    screen_capture_details: ScreenCaptureDetails,
  ) {
    self.is_recording = true;
    self.recording_manifest = Some(recording_manifest);
    self.stream_sync = Some(stream_sync);
    self.stream_handles = Some(stream_handles);

    // Separate due to pause/resume creating separate screen files
    self.screen_capture_details = Some(screen_capture_details);
    self.screen_files = Some(vec![screen_file]);
    self.screen_stream_handle = Some(screen_stream_handle);
  }

  pub fn recording_stopped(&mut self) -> StoppedRecording {
    self.is_recording = false;

    if let Some(stream_sync) = self.stream_sync.take() {
      stream_sync
        .should_write
        .store(false, std::sync::atomic::Ordering::SeqCst);

      let _ = stream_sync.stop_tx.send(());
      let _ = stream_sync.stop_screen_tx.send(());
    }

    StoppedRecording {
      manifest: self.recording_manifest.take(),
      stream_handles: self.stream_handles.take(),
      screen_handle: self.screen_stream_handle.take(),
      screen_files: self.screen_files.take(),
    }
  }

  pub fn pause_recording(&mut self) {
    if let Some(stream_sync) = &self.stream_sync {
      stream_sync
        .should_write
        .store(false, std::sync::atomic::Ordering::SeqCst);

      // Send a stop to screen, this is because screen uses wallclock
      // timestamps meaning empty frames when not writing
      let _ = stream_sync.stop_screen_tx.send(());
    }
  }

  pub fn resume_recording(&mut self, screen_stream_handle: JoinHandle<()>, screen_file: PathBuf) {
    self.screen_stream_handle = Some(screen_stream_handle);
    if let Some(screen_files) = self.screen_files.as_mut() {
      screen_files.push(screen_file);
    }

    if let Some(stream_sync) = &self.stream_sync {
      stream_sync
        .should_write
        .store(true, std::sync::atomic::Ordering::SeqCst);
    }
  }

  pub fn is_recording(&self) -> bool {
    self.is_recording
  }
}

pub struct EditingState {
  pub is_editing: bool,
  pub export_process: Option<Arc<Mutex<FfmpegChild>>>,
}

impl EditingState {
  pub fn new() -> Self {
    EditingState {
      is_editing: false,
      export_process: None,
    }
  }

  pub fn set_export_process(&mut self, export_process: Arc<Mutex<FfmpegChild>>) {
    self.export_process = Some(export_process);
  }

  pub fn take_export_process(&mut self) -> Option<Arc<Mutex<FfmpegChild>>> {
    self.export_process.take()
  }

  pub fn editing_started(&mut self) {
    self.is_editing = true;
  }

  pub fn editing_stopped(&mut self) {
    self.is_editing = false;
  }

  pub fn is_editing(&self) -> bool {
    self.is_editing
  }
}
