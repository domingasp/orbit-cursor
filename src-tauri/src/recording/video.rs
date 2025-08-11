use std::{
  path::{Path, PathBuf},
  process::ChildStdin,
  sync::Arc,
  thread::JoinHandle,
};

use ffmpeg_sidecar::child::FfmpegChild;
use parking_lot::Mutex;
use tokio::sync::broadcast;

use crate::recording::{
  ffmpeg::{spawn_rawvideo_ffmpeg, FfmpegInputDetails},
  models::VideoCaptureDetails,
};

/// Spawns a thread to handle cleanup of the video stream on stop
pub fn spawn_video_cleanup_thread(
  mut stop_rx: broadcast::Receiver<()>,
  writer: Arc<Mutex<Option<ChildStdin>>>,
  mut ffmpeg: FfmpegChild,
  log_prefix: String,
) -> JoinHandle<()> {
  std::thread::spawn(move || {
    let _ = stop_rx.blocking_recv();

    log::info!("{log_prefix} Finalizing video stream");
    {
      let mut writer = writer.lock();
      let _ = writer.take(); // close stdin to ffmpeg
    }

    let _ = ffmpeg.wait();
    log::info!("{log_prefix} Video stream finalized");
  })
}

/// Resumes a paused video recording
pub fn resume_video_recording(
  file_path: PathBuf,
  capture_details: VideoCaptureDetails,
  stop_video_rx: broadcast::Receiver<()>,
) -> JoinHandle<()> {
  let VideoCaptureDetails {
    writer,
    ffmpeg_input_details,
    log_prefix,
  } = capture_details;

  let (ffmpeg, stdin) = spawn_rawvideo_ffmpeg(&file_path, ffmpeg_input_details, log_prefix.clone());

  {
    // Swap in new stdin into writer
    let mut writer = writer.lock();
    let _ = (*writer).replace(stdin);
  }

  spawn_video_cleanup_thread(stop_video_rx, writer, ffmpeg, log_prefix)
}

/// Spawn ffmpeg process and return stdin + child
pub fn create_ffmpeg_writer(
  file_path: &Path,
  ffmpeg_input_details: FfmpegInputDetails,
  log_prefix: String,
) -> (Arc<Mutex<Option<ChildStdin>>>, FfmpegChild) {
  let (ffmpeg, stdin) = spawn_rawvideo_ffmpeg(file_path, ffmpeg_input_details, log_prefix);
  (Arc::new(Mutex::new(Some(stdin))), ffmpeg)
}
