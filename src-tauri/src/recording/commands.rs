use std::sync::{
  atomic::{AtomicBool, Ordering},
  Arc, Mutex,
};

use cpal::traits::StreamTrait;
use nokhwa::{query, utils::ApiBackend};
use tauri::{AppHandle, State};
use tauri_nspanel::ManagerExt;

use crate::{
  audio::service::{build_audio_into_file_stream, get_input_audio_device, get_system_audio_device},
  camera::service::{capture_to_file_callback, create_and_start_camera},
  constants::WindowLabel,
  recording::service::{
    create_ffmpeg_writer, create_recording_directory, stop_audio_writer, stop_camera_writer,
  },
  AppState, AudioRecordingDetails, RecordingStreams,
};

#[tauri::command]
pub fn start_recording(
  app_handle: AppHandle,
  state: State<'_, Mutex<AppState>>,
  system_audio: bool,
  device_name: Option<String>,
  camera_name: Option<String>,
) {
  let stop_recording_flag = Arc::new(AtomicBool::new(false));
  let stop_recording_flag_clone = stop_recording_flag.clone();

  if let Ok(mut state) = state.lock() {
    let mut streams = RecordingStreams {
      stop_recording_flag,
      system_audio: None,
      input_audio: None,
      camera: None,
    };

    // Setup and start recording
    let recording_dir = create_recording_directory(&app_handle);

    if system_audio {
      let (device, config) = get_system_audio_device();
      let (stream, wav_writer) =
        build_audio_into_file_stream(&device, &config, &recording_dir, "system_audio".to_string());
      stream.play().expect("Failed to play system audio stream");
      streams.system_audio = Some(AudioRecordingDetails { stream, wav_writer })
    }

    if let Some(device_name) = device_name {
      let (device, config) = get_input_audio_device(device_name);
      let (stream, wav_writer) =
        build_audio_into_file_stream(&device, &config, &recording_dir, "microphone".to_string());
      stream.play().expect("Failed to play input audio stream");
      streams.input_audio = Some(AudioRecordingDetails { stream, wav_writer })
    }

    if let Some(camera_name) = camera_name {
      if let Some(camera_to_start) = query(ApiBackend::Auto)
        .unwrap()
        .iter()
        .find(|camera| camera.human_name() == camera_name)
      {
        let mut ffmpeg_child = create_ffmpeg_writer(camera_to_start.index(), &recording_dir);
        let ffmpeg_stdin = Arc::new(Mutex::new(Some(ffmpeg_child.take_stdin().unwrap())));

        let ffmpeg_stdin_clone = ffmpeg_stdin.clone();
        if let Some(camera) =
          create_and_start_camera(camera_to_start.index().clone(), move |frame| {
            // Flag required to correctly drop stdin when recording stopped to avoid
            // ffmpeg hanging
            if stop_recording_flag_clone.load(std::sync::atomic::Ordering::SeqCst) {
              let mut lock = ffmpeg_stdin_clone.lock().unwrap();
              *lock = None;
              return;
            }

            if let Some(stdin_lock) = &mut *ffmpeg_stdin_clone.lock().unwrap() {
              capture_to_file_callback(frame, stdin_lock);
            }
          })
        {
          streams.camera = Some(crate::CameraRecordingDetails {
            stream: camera,
            ffmpeg: ffmpeg_child,
            stdin: ffmpeg_stdin,
          });
        }
      }
    }

    state.is_recording = true;
    state.recording_streams = streams;

    let recording_dock = app_handle
      .get_webview_panel(WindowLabel::RecordingDock.as_ref())
      .unwrap();
    recording_dock.order_front_regardless();
  }
}

#[tauri::command]
pub fn stop_recording(app_handle: AppHandle, state: State<'_, Mutex<AppState>>) {
  if let Ok(mut state) = state.lock() {
    state.is_recording = false;
    // cpal and hound automatically clean up on Drop
    let recording_streams = RecordingStreams {
      stop_recording_flag: Arc::new(AtomicBool::new(false)),
      system_audio: None,
      input_audio: None,
      camera: None,
    };

    state
      .recording_streams
      .stop_recording_flag
      .store(true, Ordering::SeqCst);

    stop_audio_writer(state.recording_streams.system_audio.as_ref());
    stop_audio_writer(state.recording_streams.input_audio.as_ref());
    stop_camera_writer(state.recording_streams.camera.take());

    state.recording_streams = recording_streams;

    let recording_dock = app_handle
      .get_webview_panel(WindowLabel::RecordingDock.as_ref())
      .unwrap();
    recording_dock.order_out(None);
  }
}
