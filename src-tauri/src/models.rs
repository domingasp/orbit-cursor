use std::{
  collections::HashMap,
  sync::{atomic::AtomicBool, Arc},
};

use ffmpeg_sidecar::child::FfmpegChild;
use parking_lot::Mutex;
use rdev::Event;
use scap::capturer::Capturer;
use tokio::sync::broadcast::{self, Receiver, Sender};

use crate::{
  audio::models::AudioStream, constants::WindowLabel, recording::models::RecordingManifest,
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

pub struct RecordingState {
  pub is_recording: bool,
  pub recording_manifest: Option<RecordingManifest>,
}

impl RecordingState {
  pub fn new() -> Self {
    RecordingState {
      is_recording: false,
      recording_manifest: None,
    }
  }

  pub fn recording_started(&mut self, recording_manifest: RecordingManifest) {
    self.is_recording = true;
    self.recording_manifest = Some(recording_manifest);
  }

  pub fn recording_stopped(&mut self) -> Option<RecordingManifest> {
    self.is_recording = false;
    self.recording_manifest.take()
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
