use std::{
  fs::File,
  io::{BufRead, BufReader},
  path::{Path, PathBuf},
  process::{ChildStderr, ChildStdin},
};

use ffmpeg_sidecar::{child::FfmpegChild, command::FfmpegCommand};
use tauri::{PhysicalPosition, PhysicalSize};
use uuid::Uuid;

use crate::recording::models::RecordingFile;

use std::io::Write;

#[derive(Debug, Clone)]
pub struct FfmpegInputDetails {
  pub width: u32,
  pub height: u32,
  pub frame_rate: u32,
  pub pixel_format: String,
  pub wallclock_timestamps: bool,
  pub crop: Option<(PhysicalSize<f64>, PhysicalPosition<f64>)>,
}

/// Create and spawn the camera writer ffmpeg
pub fn spawn_rawvideo_ffmpeg(
  file_path: &Path,
  input_details: FfmpegInputDetails,
  log_prefix: String,
) -> (FfmpegChild, ChildStdin) {
  log::info!("{log_prefix} Spawning rawvideo ffmpeg");

  let FfmpegInputDetails {
    width,
    height,
    frame_rate,
    pixel_format,
    wallclock_timestamps,
    crop,
  } = input_details;

  let mut command = FfmpegCommand::new();

  if wallclock_timestamps {
    command.args(["-use_wallclock_as_timestamps", "1"]);
  } else {
    command.args(["-framerate", &frame_rate.to_string()]);
  }

  command
    .format("rawvideo")
    .pix_fmt(pixel_format)
    .size(width, height)
    .input("-");

  if let Some((PhysicalSize { width, height }, PhysicalPosition { x, y })) = crop {
    command.args(["-vf", &format!("crop={width}:{height}:{x}:{y}")]);
  }

  #[cfg(target_os = "macos")]
  {
    // `h264_videotoolbox` does not support multiple streams on hardware
    // `hevc_videotoolbox` does - this allows hardware backed video
    // encoding
    command.codec_video("hevc_videotoolbox");
    command.args(["-b:v", "12000k"]);

    // Allows playing of files in various places, avoids needing
    // a re-encode to `h264`
    command.args(["-tag:v", "hvc1"]);
  }

  #[cfg(not(target_os = "macos"))]
  command.codec_video("libx264").crf(20);

  #[cfg(target_os = "macos")]
  command.pix_fmt("yuv420p"); // QuickTime compatibility

  command.output(file_path.to_string_lossy());

  let mut ffmpeg = command.spawn().unwrap();

  #[cfg(debug_assertions)]
  log_ffmpeg_output(ffmpeg.take_stderr().unwrap(), log_prefix);

  let stdin = ffmpeg
    .take_stdin()
    .expect("Failed to take stdin for video Ffmpeg");

  (ffmpeg, stdin)
}

/// Concat provided screen segments into a single file
///
/// Deletes segments after operation is complete.
pub fn concat_screen_segments(screen_segments: Vec<PathBuf>, recording_dir: PathBuf) {
  log::info!("Generating screen segment list file");
  let segments_path = recording_dir.join(format!("screen-segments_{}.txt", Uuid::new_v4()));
  let mut file = File::create(&segments_path).unwrap();
  for path in &screen_segments {
    let _ = writeln!(file, "file '{}'", path.display());
  }

  log::info!("Concating screen recording segments");
  let mut child = FfmpegCommand::new();

  child.format("concat");
  child.args(["-safe", "0"]);
  child.input(segments_path.to_string_lossy());
  child.args(["-c", "copy"]);
  child.output(
    recording_dir
      .join(RecordingFile::Screen.as_ref())
      .to_string_lossy(),
  );

  let mut ffmpeg_child = child.spawn().unwrap();
  let _ = ffmpeg_child.wait();

  log::info!("Concat complete, cleaning up");
  for segment in &screen_segments {
    if let Err(e) = std::fs::remove_file(segment) {
      log::warn!(
        "Failed to delete recording segment {}: {}",
        segment.display(),
        e
      );
    }
  }

  if let Err(e) = std::fs::remove_file(&segments_path) {
    log::warn!(
      "Failed to delete list file {}: {}",
      segments_path.display(),
      e
    );
  }
}

#[cfg(debug_assertions)]
pub fn log_ffmpeg_output(stderr: ChildStderr, tag: String) {
  std::thread::spawn(move || {
    let reader = BufReader::new(stderr);
    for line in reader.lines().map_while(Result::ok) {
      log::debug!("[ffmpeg]{tag}{line}");
    }
  });
}
