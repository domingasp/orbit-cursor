use std::{
  fs::create_dir_all,
  path::{Path, PathBuf},
  sync::Arc,
};

use chrono::Local;
use ffmpeg_sidecar::{child::FfmpegChild, command::FfmpegCommand};
use nokhwa::utils::CameraIndex;
use tauri::{AppHandle, Manager};

use crate::{camera::service::probe_camera_details, AudioRecordingDetails, CameraRecordingDetails};

pub fn create_recording_directory(app_handle: &AppHandle) -> PathBuf {
  let recordings_dir = app_handle.path().app_data_dir().unwrap().join("Recordings");
  let timestamp = Local::now().format("%Y-%m-%d_%H-%M-%S").to_string();
  let session_dir = recordings_dir.join(&timestamp);
  let _ = create_dir_all(&session_dir);

  session_dir
}

pub fn create_ffmpeg_writer(camera_index: &CameraIndex, recording_dir: &Path) -> FfmpegChild {
  let camera_details = probe_camera_details(camera_index).unwrap();
  let resolution = camera_details.resolution;
  let frame_rate = camera_details.frame_rate;

  let child = FfmpegCommand::new()
    .format("rawvideo")
    .pix_fmt("rgba")
    .size(resolution.width(), resolution.height())
    .rate(frame_rate as f32)
    .input("-")
    .codec_video("libx264")
    .format("matroska")
    .output(recording_dir.join("camera.mkv").to_string_lossy())
    .spawn()
    .unwrap();

  child
}

pub fn stop_audio_writer(recording_details: Option<&AudioRecordingDetails>) {
  if let Some(stream) = recording_details {
    let wav_writer = Arc::clone(&stream.wav_writer);

    {
      let mut writer_lock = wav_writer.lock().unwrap();
      if let Some(writer) = writer_lock.take() {
        writer.finalize().unwrap();
      }
    }
  }
}

pub fn stop_camera_writer(camera_details: Option<CameraRecordingDetails>) {
  if let Some(mut details) = camera_details {
    std::thread::spawn(move || {
      {
        let mut stdin_lock = details.stdin.lock().unwrap();
        *stdin_lock = None;
      }

      // Need a thread to stop stream otherwise freezes main thread
      let _ = details.stream.stop_stream();

      let _ = details.ffmpeg.wait();
    });
  }
}
