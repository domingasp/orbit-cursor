use std::{
  path::{Path, PathBuf},
  sync::{atomic::AtomicBool, Arc, Barrier},
  thread::JoinHandle,
};

use parking_lot::Mutex;
use serde::Deserialize;
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::sync::broadcast;

use crate::{
  constants::{Events, WindowLabel},
  models::{
    EditingState, GlobalState, RecordingState, StoppedRecording, VideoTrackDetails,
    VideoTrackStartDetails,
  },
  recording::{
    audio::{start_microphone_recorder, start_system_audio_recorder},
    camera::start_camera_recorder,
    ffmpeg::concat_video_segments,
    file::{create_recording_directory, write_metadata_to_file},
    input_events::start_mouse_event_recorder,
    models::{
      RecordingFile, RecordingFileSet, RecordingManifest, RecordingMetadata, RecordingType, Region,
      StreamSync,
    },
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
    let mut recording_file_set = RecordingFileSet::default();

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

    let mut recorder_handles: Vec<JoinHandle<()>> = Vec::new();

    // Optional
    if options.system_audio {
      log::info!("Starting system audio recorder");
      recording_file_set.system_audio = Some(RecordingFile::SystemAudio);
      recorder_handles.push(start_system_audio_recorder(
        recording_dir.join(RecordingFile::SystemAudio.as_ref()),
        synchronization.clone(),
      ));
      log::info!("System audio recorder ready");
    }

    if let Some(microphone_name) = options.microphone_name {
      log::info!("Starting input audio recorder");
      recording_file_set.microphone = Some(RecordingFile::Microphone);
      if let Some(handle) = start_microphone_recorder(
        recording_dir.join(RecordingFile::Microphone.as_ref()),
        synchronization.clone(),
        microphone_name,
      ) {
        recorder_handles.push(handle);
      }
      log::info!("Input audio recorder ready");
    }

    let camera_recorder = options.camera_name.and_then(|camera_name| {
      log::info!("Starting camera recorder");
      recording_file_set.camera = Some(RecordingFile::Camera);

      let camera_file = recording_dir.join(RecordingFile::Camera.unique());
      start_camera_recorder(camera_file.clone(), synchronization.clone(), camera_name).map(
        |(handle, capture_details)| {
          log::info!("Camera recorder ready");
          VideoTrackStartDetails {
            path: camera_file,
            handle,
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
    recorder_handles.push(mouse_event_handle);

    write_metadata_to_file(
      recording_dir.join(RecordingFile::Metadata.as_ref()),
      RecordingMetadata {
        recording_origin,
        scale_factor,
      },
    );
    log::info!("Extra writers ready");

    log::info!("Waiting for streams to be ready");
    ready_barrier.wait(); // Synchronized start
    should_write.store(true, std::sync::atomic::Ordering::SeqCst);
    let _ = app_handle.emit(Events::RecordingStarted.as_ref(), ());

    update_system_tray_icon(
      app_handle.clone(),
      crate::system_tray::service::SystemTrayIcon::Recording,
    );

    let recording_state: State<'_, Mutex<RecordingState>> = app_handle.state();
    recording_state.lock().recording_started(
      RecordingManifest {
        directory: recording_dir,
        files: recording_file_set,
      },
      synchronization,
      recorder_handles,
      VideoTrackStartDetails {
        path: screen_file,
        handle: screen_handle,
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
    let recording_state: State<'_, Mutex<RecordingState>> = app_handle.state();
    if let StoppedRecording {
      manifest: Some(recording_manifest),
      stream_handles: Some(stream_handles),
      screen_handle: Some(screen_stream_handle),
      screen_files: Some(screen_files),
      camera_handle,
      camera_files,
    } = recording_state.lock().recording_stopped()
    {
      for stream_handle in stream_handles {
        if let Err(e) = stream_handle.join() {
          log::warn!("Failed to join stream thread: {e:?}");
        }
      }

      let _ = screen_stream_handle.join();
      concat_video_segments(
        screen_files,
        recording_manifest.directory.clone(),
        RecordingFile::Screen,
      );

      if let (Some(camera_handle), Some(camera_files)) = (camera_handle, camera_files) {
        let _ = camera_handle.join();
        concat_video_segments(
          camera_files,
          recording_manifest.directory.clone(),
          RecordingFile::Camera,
        );
      }

      let _ = app_handle.emit(Events::RecordingComplete.as_ref(), recording_manifest);
    };
  }

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
  let mut state = recording_state.lock();

  let Some(recording_manifest) = state.recording_manifest.clone() else {
    log::warn!("No recording manifest found, cannot resume");
    return;
  };
  let Some(stream_sync) = state.stream_sync.clone() else {
    log::warn!("No stream sync found, cannot resume");
    return;
  };

  let screen_resume = resume_video_track(
    &state.screen_capture_details,
    &recording_manifest.directory,
    RecordingFile::Screen,
    stream_sync.clone(),
  );

  let camera_resume = resume_video_track(
    &state.camera_capture_details,
    &recording_manifest.directory,
    RecordingFile::Camera,
    stream_sync,
  );

  if let Some((screen_handle, screen_file)) = screen_resume {
    let (camera_handle, camera_file) = camera_resume
      .map(|(h, f)| (Some(h), Some(f)))
      .unwrap_or((None, None));

    state.resume_recording(screen_handle, screen_file, camera_handle, camera_file);

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
