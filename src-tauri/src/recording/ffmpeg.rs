use std::{
  io::{BufRead, BufReader},
  process::ChildStderr,
};

#[cfg(debug_assertions)]
pub fn log_ffmpeg_output(stderr: ChildStderr, tag: String) {
  std::thread::spawn(move || {
    let reader = BufReader::new(stderr);
    for line in reader.lines().map_while(Result::ok) {
      log::debug!("[ffmpeg]{tag}{line}");
    }
  });
}
