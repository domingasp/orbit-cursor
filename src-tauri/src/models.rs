use std::{
  collections::HashMap,
  path::PathBuf,
  sync::{atomic::AtomicBool, Arc},
  thread::JoinHandle,
};

use ffmpeg_sidecar::child::FfmpegChild;
use parking_lot::Mutex;
use rdev::Event;
use tokio::sync::broadcast::{self, Receiver, Sender};

use crate::{
  audio::models::AudioStream,
  constants::WindowLabel,
  recording::models::{StreamSync, VideoCaptureDetails},
};

pub struct GlobalState {
  pub open_windows: HashMap<WindowLabel, Arc<AtomicBool>>,
  pub input_event_tx: broadcast::Sender<rdev::Event>,
}

impl GlobalState {
  pub fn new(input_event_tx: Sender<Event>) -> Self {
    GlobalState {
      open_windows: HashMap::from([
        (
          WindowLabel::StartRecordingDock,
          Arc::new(AtomicBool::new(false)),
        ),
        (
          WindowLabel::RecordingInputOptions,
          Arc::new(AtomicBool::new(false)),
        ),
        (
          WindowLabel::RecordingSourceSelector,
          Arc::new(AtomicBool::new(false)),
        ),
      ]),
      input_event_tx,
    }
  }

  pub fn window_closed(&self, window: WindowLabel) {
    if let Some(flag) = self.open_windows.get(&window) {
      flag.store(false, std::sync::atomic::Ordering::SeqCst);
    }
  }

  pub fn window_opened(&self, window: WindowLabel) {
    if let Some(flag) = self.open_windows.get(&window) {
      flag.store(true, std::sync::atomic::Ordering::SeqCst);
    }
  }

  pub fn is_window_open(&self, window: &WindowLabel) -> bool {
    self
      .open_windows
      .get(window)
      .map(|f| f.load(std::sync::atomic::Ordering::SeqCst))
      .unwrap_or(false)
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

pub type ThreadHandle = Arc<Mutex<Option<JoinHandle<()>>>>;

pub struct StoppedRecording {
  pub recording_id: Option<i64>,
  pub stream_handles: Option<Vec<ThreadHandle>>,
  pub screen_handle: Option<ThreadHandle>,
  pub screen_files: Option<Vec<PathBuf>>,
  pub camera_handle: Option<ThreadHandle>,
  pub camera_files: Option<Vec<PathBuf>>,
}

#[derive(Debug, Clone)]
pub struct VideoTrackDetails {
  pub capture_details: Option<VideoCaptureDetails>,
  pub files: Option<Vec<PathBuf>>,
  pub stream_handle: Option<ThreadHandle>,
}

impl VideoTrackDetails {
  pub fn add_segment(&mut self, handle: Option<ThreadHandle>, file: Option<PathBuf>) {
    self.stream_handle = handle;
    if let Some(files) = &mut self.files {
      if let Some(file) = file {
        files.push(file);
      }
    }
  }
}

trait TakeStreamAndFiles {
  fn take_stream_and_files(&mut self) -> (Option<ThreadHandle>, Option<Vec<PathBuf>>);
}

impl TakeStreamAndFiles for Option<VideoTrackDetails> {
  fn take_stream_and_files(&mut self) -> (Option<ThreadHandle>, Option<Vec<PathBuf>>) {
    if let Some(details) = self.take() {
      (details.stream_handle, details.files)
    } else {
      (None, None)
    }
  }
}

pub struct RecordingState {
  pub is_recording: bool,
  pub is_paused: bool,
  pub recording_id: Option<i64>,
  pub stream_sync: Option<StreamSync>,
  pub stream_handles: Option<Vec<ThreadHandle>>,
  pub screen_capture_details: Option<VideoTrackDetails>,
  pub camera_capture_details: Option<VideoTrackDetails>,
}

pub struct VideoTrackStartDetails {
  pub path: PathBuf,
  pub handle: ThreadHandle,
  pub capture_details: VideoCaptureDetails,
}

impl VideoTrackStartDetails {
  fn into_video_track_details(self) -> VideoTrackDetails {
    VideoTrackDetails {
      capture_details: Some(self.capture_details),
      files: Some(vec![self.path]),
      stream_handle: Some(self.handle),
    }
  }
}

impl RecordingState {
  pub fn new() -> Self {
    RecordingState {
      is_recording: false,
      is_paused: false,
      recording_id: None,
      stream_sync: None,
      stream_handles: None,
      screen_capture_details: None,
      camera_capture_details: None,
    }
  }

  pub fn recording_started(
    &mut self,
    recording_id: i64,
    stream_sync: StreamSync,
    stream_handles: Vec<ThreadHandle>,
    screen_recorder: VideoTrackStartDetails,
    camera_recorder: Option<VideoTrackStartDetails>,
  ) {
    self.is_recording = true;
    self.is_paused = false;

    self.recording_id = Some(recording_id);
    self.stream_sync = Some(stream_sync);
    self.stream_handles = Some(stream_handles);

    // Separate due to pause/resume creating separate screen files
    self.screen_capture_details = Some(screen_recorder.into_video_track_details());

    if let Some(camera_recorder) = camera_recorder {
      self.camera_capture_details = Some(camera_recorder.into_video_track_details());
    } else {
      self.camera_capture_details = None;
    }
  }

  pub fn recording_stopped(&mut self) -> StoppedRecording {
    self.is_recording = false;
    self.is_paused = false;

    if let Some(stream_sync) = self.stream_sync.take() {
      stream_sync
        .should_write
        .store(false, std::sync::atomic::Ordering::SeqCst);

      let _ = stream_sync.stop_tx.send(());
      let _ = stream_sync.stop_video_tx.send(());
    }

    let (screen_handle, screen_files) = self.screen_capture_details.take_stream_and_files();
    let (camera_handle, camera_files) = self.camera_capture_details.take_stream_and_files();

    StoppedRecording {
      recording_id: self.recording_id.take(),
      stream_handles: self.stream_handles.take(),
      screen_handle,
      screen_files,
      camera_handle,
      camera_files,
    }
  }

  pub fn pause_recording(&mut self) {
    if let Some(stream_sync) = &self.stream_sync {
      stream_sync
        .should_write
        .store(false, std::sync::atomic::Ordering::SeqCst);

      // Send a stop to video streams, screen/camera use wallclock timestamps and
      // must be stopped to avoid issues with audio/video sync
      // For example - video paused T = 5, resumed T = 10 and stopped at T = 15,
      // the video would be 15 seconds long while audio will be 10 seconds long
      let _ = stream_sync.stop_video_tx.send(());
    }

    self.is_paused = true;
  }

  pub fn resume_recording(
    &mut self,
    screen_stream_handle: ThreadHandle,
    screen_file: PathBuf,
    camera_stream_handle: Option<ThreadHandle>,
    camera_file: Option<PathBuf>,
  ) {
    if let Some(screen_capture_details) = &mut self.screen_capture_details {
      screen_capture_details.add_segment(Some(screen_stream_handle), Some(screen_file));
    }

    if let Some(camera_capture_details) = &mut self.camera_capture_details {
      camera_capture_details.add_segment(camera_stream_handle, camera_file);
    }

    if let Some(stream_sync) = &self.stream_sync {
      stream_sync
        .should_write
        .store(true, std::sync::atomic::Ordering::SeqCst);
    }

    self.is_paused = false;
  }

  pub fn is_recording(&self) -> bool {
    self.is_recording
  }

  pub fn is_paused(&self) -> bool {
    self.is_paused
  }
}

pub struct EditingState {
  pub export_process: Option<Arc<Mutex<FfmpegChild>>>,
}

impl EditingState {
  pub fn new() -> Self {
    EditingState {
      export_process: None,
    }
  }

  pub fn set_export_process(&mut self, export_process: Arc<Mutex<FfmpegChild>>) {
    self.export_process = Some(export_process);
  }

  pub fn take_export_process(&mut self) -> Option<Arc<Mutex<FfmpegChild>>> {
    self.export_process.take()
  }
}
