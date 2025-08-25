use std::{
  path::{Path, PathBuf},
  sync::{atomic::AtomicBool, Arc, Barrier},
  thread::JoinHandle,
};

use parking_lot::Mutex;
use serde::Deserialize;
use sqlx::{Pool, Sqlite};
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::sync::broadcast;

use crate::{
  constants::{Events, WindowLabel},
  db::{self, recordings::NewRecording},
  models::{
    EditingState, GlobalState, RecordingState, StoppedRecording, ThreadHandle, VideoTrackDetails,
    VideoTrackStartDetails,
  },
  recording::{
    audio::{start_microphone_recorder, start_system_audio_recorder},
    camera::start_camera_recorder,
    ffmpeg::concat_video_segments,
    file::create_recording_directory,
    input_events::start_mouse_event_recorder,
    models::{RecordingFile, RecordingType, Region, StreamSync},
    screen::start_screen_recorder,
    video::resume_video_recording,
  },
  system_tray::service::update_system_tray_icon,
  windows::commands::hide_region_selector,
};

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartRecordingOptions {
  pub system_audio: bool,
  pub microphone_name: Option<String>,
  pub camera_name: Option<String>,
  pub recording_type: RecordingType,
  pub monitor_name: String,
  pub window_id: Option<u32>,
  pub region: Region,
  pub show_system_cursor: bool,
}

#[tauri::command]
pub fn start_recording(app_handle: AppHandle, options: StartRecordingOptions) -> Result<(), ()> {
  update_system_tray_icon(
    app_handle.clone(),
    crate::system_tray::service::SystemTrayIcon::Loading,
  );

  // Setup in a separate thread, this way we don't block UI
  std::thread::spawn(move || {
    log::info!("Starting recording");

    let recording_dir = create_recording_directory(app_handle.path().app_data_dir().unwrap());

    // Calculate number of required barriers
    let mut barrier_count = 2; // For this coordinator + screen
    if options.system_audio {
      barrier_count += 1;
    }
    if options.microphone_name.is_some() {
      barrier_count += 1;
    }
    if options.camera_name.is_some() {
      barrier_count += 1;
    }

    let ready_barrier = Arc::new(Barrier::new(barrier_count));
    let should_write = Arc::new(AtomicBool::new(false));
    let (stop_video_tx, _) = broadcast::channel::<()>(1);
    let (stop_tx, _) = broadcast::channel::<()>(1);
    let synchronization = StreamSync {
      should_write: should_write.clone(),
      stop_video_tx: stop_video_tx.clone(),
      stop_tx: stop_tx.clone(),
      ready_barrier: ready_barrier.clone(),
    };

    let mut recorder_handles: Vec<ThreadHandle> = Vec::new();

    // Optional
    if options.system_audio {
      log::info!("Starting system audio recorder");
      recorder_handles.push(Arc::new(Mutex::new(Some(start_system_audio_recorder(
        recording_dir.join(RecordingFile::SystemAudio.as_ref()),
        synchronization.clone(),
      )))));
      log::info!("System audio recorder ready");
    }

    if let Some(microphone_name) = options.microphone_name.clone() {
      log::info!("Starting input audio recorder");
      if let Some(handle) = start_microphone_recorder(
        recording_dir.join(RecordingFile::Microphone.as_ref()),
        synchronization.clone(),
        microphone_name,
      ) {
        recorder_handles.push(Arc::new(Mutex::new(Some(handle))));
      }
      log::info!("Input audio recorder ready");
    }

    let camera_recorder = options.camera_name.and_then(|camera_name| {
      log::info!("Starting camera recorder");
      let camera_file = recording_dir.join(RecordingFile::Camera.unique());
      start_camera_recorder(camera_file.clone(), synchronization.clone(), camera_name).map(
        |(handle, capture_details)| {
          log::info!("Camera recorder ready");
          VideoTrackStartDetails {
            path: camera_file,
            handle: Arc::new(Mutex::new(Some(handle))),
            capture_details,
          }
        },
      )
    });

    // Always
    // MUST be after the optionals
    // Window capture causes empty frames if this comes first - not sure why, only happens
    // when multiple streams
    log::info!("Starting screen recorder");
    let screen_file = recording_dir.join(RecordingFile::Screen.unique());
    let (screen_handle, screen_capture_details, recording_origin, scale_factor) =
      start_screen_recorder(
        screen_file.clone(),
        options.recording_type,
        options.monitor_name,
        options.window_id,
        options.region,
        options.show_system_cursor,
        synchronization.clone(),
      );
    log::info!("Screen recorder ready");

    log::info!("Starting extra writers: mouse_events, metadata");
    let global_state: State<'_, GlobalState> = app_handle.state();
    let input_event_rx = global_state.subscribe_to_input_events();
    let mouse_event_handle = start_mouse_event_recorder(
      recording_dir.join(RecordingFile::MouseEvents.as_ref()),
      synchronization.clone(),
      input_event_rx,
    );
    recorder_handles.push(Arc::new(Mutex::new(Some(mouse_event_handle))));
    log::info!("Extra writers ready");

    log::info!("Waiting for streams to be ready");
    ready_barrier.wait(); // Synchronized start
    should_write.store(true, std::sync::atomic::Ordering::SeqCst);
    let _ = app_handle.emit(Events::RecordingStarted.as_ref(), ());

    update_system_tray_icon(
      app_handle.clone(),
      crate::system_tray::service::SystemTrayIcon::Recording,
    );

    let pool: State<'_, Pool<Sqlite>> = app_handle.state();
    let recording_id = tauri::async_runtime::block_on(db::recordings::insert_recording(
      &pool,
      &NewRecording {
        recording_directory: recording_dir.to_str().unwrap(),
        origin_x: recording_origin.x,
        origin_y: recording_origin.y,
        scale_factor,
        has_camera: camera_recorder.is_some(),
        has_system_audio: options.system_audio,
        has_microphone: options.microphone_name.is_some(),
        has_system_cursor: options.show_system_cursor,
        name: recording_dir
          .file_stem()
          .unwrap()
          .to_string_lossy()
          .to_string(),
      },
    ))
    .unwrap();

    let recording_state: State<'_, Mutex<RecordingState>> = app_handle.state();
    recording_state.lock().recording_started(
      recording_id,
      synchronization,
      recorder_handles,
      VideoTrackStartDetails {
        path: screen_file,
        handle: Arc::new(Mutex::new(Some(screen_handle))),
        capture_details: screen_capture_details,
      },
      camera_recorder,
    );
    log::info!("Recording started");
  });

  Ok(())
}

pub async fn stop_recording(app_handle: AppHandle) {
  // Re-enable and hide region selector (not always applicable)
  hide_region_selector(app_handle.clone());

  update_system_tray_icon(
    app_handle.clone(),
    crate::system_tray::service::SystemTrayIcon::Loading,
  );

  {
    let (
      recording_id,
      stream_handles,
      screen_stream_handle,
      screen_files,
      camera_handle,
      camera_files,
    ) = {
      let recording_state: State<'_, Mutex<RecordingState>> = app_handle.state();
      let mut guard = recording_state.lock();
      if let StoppedRecording {
        recording_id: Some(recording_id),
        stream_handles: Some(stream_handles),
        screen_handle: Some(screen_stream_handle),
        screen_files: Some(screen_files),
        camera_handle,
        camera_files,
      } = guard.recording_stopped()
      {
        (
          recording_id,
          stream_handles,
          screen_stream_handle,
          screen_files,
          camera_handle,
          camera_files,
        )
      } else {
        return;
      }
    };

    for stream_handle in stream_handles {
      if let Err(e) = stream_handle.lock().take().unwrap().join() {
        log::warn!("Failed to join stream thread: {e:?}");
      }
    }

    let recording_directory =
      db::recordings::get_recording_directory(&app_handle.state::<Pool<Sqlite>>(), recording_id)
        .await
        .unwrap();

    let _ = screen_stream_handle.lock().take().unwrap().join();
    concat_video_segments(
      screen_files,
      recording_directory.clone(),
      RecordingFile::Screen,
    );

    if let (Some(camera_handle), Some(camera_files)) = (camera_handle, camera_files) {
      let _ = camera_handle.lock().take().unwrap().join();
      concat_video_segments(camera_files, recording_directory, RecordingFile::Camera);
    }

    let _ = app_handle.emit(Events::RecordingComplete.as_ref(), recording_id);
  };

  update_system_tray_icon(
    app_handle.clone(),
    crate::system_tray::service::SystemTrayIcon::Default,
  );

  {
    let editing_state: State<'_, Mutex<EditingState>> = app_handle.state();
    editing_state.lock().editing_started();
  }

  let editor = app_handle
    .get_webview_window(WindowLabel::Editor.as_ref())
    .unwrap();
  let _ = editor.show();
  let _ = editor.set_focus();

  #[cfg(target_os = "macos")] // Shows dock icon, allows editor to go fullscreen
  let _ = app_handle.set_activation_policy(tauri::ActivationPolicy::Regular);
}

pub async fn resume_recording(app_handle: AppHandle) {
  log::info!("Resuming recording");

  update_system_tray_icon(
    app_handle.clone(),
    crate::system_tray::service::SystemTrayIcon::Loading,
  );

  let recording_state: State<'_, Mutex<RecordingState>> = app_handle.state();
  let (recording_id, stream_sync, screen_capture_details, camera_capture_details) = {
    let state = recording_state.lock();
    let Some(recording_id) = state.recording_id else {
      log::warn!("No recording id found, cannot resume");
      return;
    };
    let Some(stream_sync) = state.stream_sync.clone() else {
      log::warn!("No stream sync found, cannot resume");
      return;
    };
    (
      recording_id,
      stream_sync,
      state.screen_capture_details.clone(),
      state.camera_capture_details.clone(),
    )
  };

  let recording_directory =
    db::recordings::get_recording_directory(&app_handle.state::<Pool<Sqlite>>(), recording_id)
      .await
      .unwrap();

  let screen_resume = resume_video_track(
    &screen_capture_details,
    &recording_directory,
    RecordingFile::Screen,
    stream_sync.clone(),
  );

  let camera_resume = resume_video_track(
    &camera_capture_details,
    &recording_directory,
    RecordingFile::Camera,
    stream_sync,
  );

  if let Some((screen_handle, screen_file)) = screen_resume {
    let (camera_handle, camera_file) = camera_resume
      .map(|(h, f)| (Some(h), Some(f)))
      .unwrap_or((None, None));

    let mut state = recording_state.lock();
    state.resume_recording(
      Arc::new(Mutex::new(Some(screen_handle))),
      screen_file,
      camera_handle.map(|h| Arc::new(Mutex::new(Some(h)))),
      camera_file,
    );

    update_system_tray_icon(
      app_handle.clone(),
      crate::system_tray::service::SystemTrayIcon::Recording,
    );
  }

  log::info!("Recording resumed");
}

fn resume_video_track(
  details: &Option<VideoTrackDetails>,
  directory: &Path,
  file_type: RecordingFile,
  stream_sync: StreamSync,
) -> Option<(JoinHandle<()>, PathBuf)> {
  details.as_ref()?.capture_details.as_ref().map(|details| {
    let file_path = directory.join(file_type.unique());
    let handle = resume_video_recording(
      file_path.clone(),
      details.clone(),
      stream_sync.stop_video_tx.subscribe(),
    );

    (handle, file_path)
  })
}

pub fn pause_recording(app_handle: AppHandle, recording_state: State<'_, Mutex<RecordingState>>) {
  log::info!("Pausing recording");
  recording_state.lock().pause_recording();

  update_system_tray_icon(
    app_handle,
    crate::system_tray::service::SystemTrayIcon::Paused,
  );
}
