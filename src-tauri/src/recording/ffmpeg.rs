use std::{
  io::{BufRead, BufReader},
  path::Path,
  process::{ChildStderr, ChildStdin},
};

use ffmpeg_sidecar::{child::FfmpegChild, command::FfmpegCommand};

/// Create and spawn the camera writer ffmpeg
pub fn spawn_rawvideo_ffmpeg(
  file_path: &Path,
  width: u32,
  height: u32,
  frame_rate: u32,
  pixel_format: String,
  log_prefix: String,
) -> (FfmpegChild, ChildStdin) {
  log::info!("{log_prefix} Spawning rawvideo ffmpeg");

  let mut command = FfmpegCommand::new();

  command
    .args(["-framerate", &frame_rate.to_string()])
    .format("rawvideo")
    .pix_fmt(pixel_format)
    .size(width, height)
    .input("-");

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

  command
    .rate(frame_rate as f32)
    .output(file_path.to_string_lossy());

  let mut ffmpeg = command.spawn().unwrap();

  #[cfg(debug_assertions)]
  log_ffmpeg_output(ffmpeg.take_stderr().unwrap(), log_prefix);

  let stdin = ffmpeg
    .take_stdin()
    .expect("Failed to take stdin for video Ffmpeg");

  (ffmpeg, stdin)
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
