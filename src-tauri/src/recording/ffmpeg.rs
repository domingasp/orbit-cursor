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
  pub pixel_format: String,
  pub crop: Option<(PhysicalSize<f64>, PhysicalPosition<f64>)>,
  // On windows, without rate ffmpeg drops frames
  pub output_frame_rate: Option<u32>,
}

/// Create and spawn the camera writer ffmpeg
///
/// Uses wallclock timestamps to maintain order and timing of frames.
pub fn spawn_rawvideo_ffmpeg(
  file_path: &Path,
  input_details: FfmpegInputDetails,
  log_prefix: String,
) -> (FfmpegChild, ChildStdin) {
  log::info!("{log_prefix} Spawning rawvideo ffmpeg");

  let FfmpegInputDetails {
    width,
    height,
    pixel_format,
    crop,
    output_frame_rate,
  } = input_details;

  let mut command = FfmpegCommand::new();

  command
    .args(["-use_wallclock_as_timestamps", "1"])
    .format("rawvideo")
    .pix_fmt(pixel_format)
    .size(width, height)
    .realtime()
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

  #[cfg(target_os = "windows")]
  {
    command.codec_video(get_hardware_encoder()).crf(20);
    command.args(["-b:v", "12000k"]);
  }

  command.pix_fmt("yuv420p"); // General, and QuickTime, compatibility

  if let Some(frame_rate) = output_frame_rate {
    command.rate(frame_rate as f32);
  }

  command.output(file_path.to_string_lossy());

  let mut ffmpeg = command.spawn().unwrap();

  #[cfg(debug_assertions)]
  log_ffmpeg_output(ffmpeg.take_stderr().unwrap(), log_prefix);

  let stdin = ffmpeg
    .take_stdin()
    .expect("Failed to take stdin for video Ffmpeg");

  (ffmpeg, stdin)
}

/// Return the hardware-accelerated encoder if available, otherwise "libx264".
#[cfg(target_os = "windows")]
pub fn get_hardware_encoder() -> String {
  // Priority list: NVIDIA > Intel QSV > AMD AMF
  let preferred_encoders = [
    "h264_nvenc",
    "hevc_nvenc",
    "h264_qsv",
    "hevc_qsv",
    "h264_amf",
    "hevc_amf",
  ];

  let output = std::process::Command::new("ffmpeg")
    .arg("-hide_banner")
    .arg("-encoders")
    .output();

  if let Ok(output) = output {
    if output.status.success() {
      let stdout = String::from_utf8_lossy(&output.stdout);
      for encoder in preferred_encoders {
        if stdout.contains(encoder) {
          return encoder.to_string();
        }
      }
    }
  }

  // Fallback to software encoder
  "libx264".to_string()
}

/// Concat provided video segments into a single file
///
/// Deletes segments after operation is complete.
pub fn concat_video_segments(
  video_segments: Vec<PathBuf>,
  recording_dir: PathBuf,
  output_file: RecordingFile,
) {
  log::info!("Generating video segment list file");
  let segments_path: PathBuf = recording_dir.join(format!("video-segments_{}.txt", Uuid::new_v4()));
  let mut file = File::create(&segments_path).unwrap();
  for path in &video_segments {
    let _ = writeln!(file, "file '{}'", path.display());
  }

  log::info!("Concating video recording segments");
  let mut child = FfmpegCommand::new();

  child.format("concat");
  child.args(["-safe", "0"]);
  child.input(segments_path.to_string_lossy());
  child.args(["-c", "copy"]);
  child.output(recording_dir.join(output_file.as_ref()).to_string_lossy());

  let mut ffmpeg_child = child.spawn().unwrap();
  let _ = ffmpeg_child.wait();

  log::info!("Concat complete, cleaning up");
  for segment in &video_segments {
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
