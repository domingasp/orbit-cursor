use std::sync::Arc;
use std::{
  io::{BufRead, BufReader},
  path::{Path, PathBuf},
  process::ChildStdout,
};

use ffmpeg_sidecar::command::FfmpegCommand;
use parking_lot::Mutex;
use tauri::{AppHandle, Emitter, Manager, State};
use uuid::Uuid;

#[cfg(target_os = "macos")]
use std::process::Command;

use crate::models::EditingState;
use crate::{constants::Events, recording::models::RecordingFile};

pub fn encode_recording(
  app_handle: AppHandle,
  source_folder_path: PathBuf,
  destination_file_path: PathBuf,
  separate_audio_tracks: bool,
  separate_camera_file: bool,
  open_folder_after_export: bool,
) {
  let mut child = FfmpegCommand::new();

  let available_streams = check_recording_files(source_folder_path.as_path());

  let (output_path, camera_path) =
    prepare_output_path(&destination_file_path, separate_camera_file);

  // Start with copying across camera if relevant, better UX for progress
  // Instead of percentage 100% -> indeterminate, it goes the opposite
  // thus 100% is when the export is finished (ffmpeg done)
  if let Some(camera_path) = camera_path.clone() {
    let _ = std::fs::copy(
      source_folder_path.join(RecordingFile::Camera.to_string()),
      camera_path,
    );
  }

  configure_input_streams(
    &mut child,
    &source_folder_path,
    &available_streams,
    separate_camera_file,
  );

  configure_progress_options(&mut child);

  let video_filter = configure_video_tracks(
    &mut child,
    available_streams.has_camera,
    separate_camera_file,
  );

  let audio_filter = configure_audio_tracks(
    &mut child,
    &available_streams,
    separate_audio_tracks,
    separate_camera_file,
  );

  let mut filters = Vec::new();
  if let Some(f) = video_filter {
    filters.push(f);
  }
  if let Some(f) = audio_filter {
    filters.push(f);
  }
  if !filters.is_empty() {
    child.filter_complex(filters.join(";"));
  }

  configure_output_options(&mut child, &output_path);

  let ffmpeg_child = child.spawn().unwrap();

  let ffmpeg_arc = Arc::new(Mutex::new(ffmpeg_child));

  // Store in state for cancellation
  {
    let editing_state: State<'_, Mutex<EditingState>> = app_handle.state();
    editing_state.lock().set_export_process(ffmpeg_arc.clone());
  }

  let stdout = ffmpeg_arc.clone().lock().take_stdout().unwrap();
  let app_handle_for_reader = app_handle.clone();
  std::thread::spawn(move || {
    ffmpeg_progress_reader(app_handle_for_reader, stdout);

    let status = ffmpeg_arc.lock().wait(); // Clean up resources

    let success = status.as_ref().map(|s| s.success()).unwrap_or(false);

    if success {
      let _ = app_handle.emit(Events::ExportComplete.as_ref(), output_path.clone());

      if open_folder_after_export {
        open_path_in_file_browser(output_path);
      }
    } else {
      handle_cancellation(output_path, camera_path);
    }
  });
}

#[derive(Debug, Clone, Copy)]
struct RecordingFilePresence {
  pub has_system_audio: bool,
  pub has_microphone: bool,
  pub has_camera: bool,
}
fn check_recording_files(folder: &Path) -> RecordingFilePresence {
  RecordingFilePresence {
    has_system_audio: folder.join(RecordingFile::SystemAudio.to_string()).exists(),
    has_microphone: folder.join(RecordingFile::Microphone.to_string()).exists(),
    has_camera: folder.join(RecordingFile::Camera.to_string()).exists(),
  }
}

fn configure_input_streams(
  child: &mut FfmpegCommand,
  source_folder_path: &Path,
  available_streams: &RecordingFilePresence,
  separate_camera_file: bool,
) {
  child.input(
    source_folder_path
      .join(RecordingFile::Screen.as_ref())
      .to_string_lossy(),
  );

  // Only if burned in do we need it as an input stream
  if available_streams.has_camera && !separate_camera_file {
    child.input(
      source_folder_path
        .join(RecordingFile::Camera.as_ref())
        .to_string_lossy(),
    );
  }

  if available_streams.has_microphone {
    child.input(
      source_folder_path
        .join(RecordingFile::Microphone.as_ref())
        .to_string_lossy(),
    );
  }

  if available_streams.has_system_audio {
    child.input(
      source_folder_path
        .join(RecordingFile::SystemAudio.as_ref())
        .to_string_lossy(),
    );
  }
}

fn configure_progress_options(child: &mut FfmpegCommand) {
  child.args(["-progress", "pipe:1"]);
  child.arg("-nostats");
}

/// Return filter_complex string for video tracks
fn configure_video_tracks(
  ffmpeg: &mut FfmpegCommand,
  has_camera: bool,
  separate_camera_file: bool,
) -> Option<String> {
  // Burned in Camera
  if !separate_camera_file && has_camera {
    ffmpeg.map("[outv]");
    Some(
      "[1:v]scale=320:-1[camera_scaled];[0:v][camera_scaled]overlay=W-w-10:H-h-10[outv]"
        .to_string(),
    )
  } else {
    ffmpeg.map("0:v");
    None
  }
}

/// Return filter_complex string for audio tracks
fn configure_audio_tracks(
  ffmpeg: &mut FfmpegCommand,
  available_streams: &RecordingFilePresence,
  separate_audio_tracks: bool,
  separate_camera_file: bool,
) -> Option<String> {
  let &RecordingFilePresence {
    has_camera,
    has_microphone,
    has_system_audio,
  } = available_streams;

  let camera_input_offset = if has_camera && !separate_camera_file {
    1
  } else {
    0
  };

  let mic_input_index = camera_input_offset + 1;
  let sys_input_index = if has_microphone {
    mic_input_index + 1
  } else {
    mic_input_index
  };

  if separate_audio_tracks {
    let mut audio_index = mic_input_index;

    if has_microphone {
      ffmpeg.map(format!("{audio_index}:a"));
      audio_index += 1;
    }

    if has_system_audio {
      ffmpeg.map(format!("{audio_index}:a"));
    }

    None
  } else if has_microphone && has_system_audio {
    ffmpeg.map("[aout]");

    Some(format!("[{mic_input_index}:a][{sys_input_index}:a]amix=inputs=2[aout]").to_string())
  } else if has_microphone || has_system_audio {
    let audio_index = if has_microphone {
      mic_input_index
    } else {
      sys_input_index
    };

    ffmpeg.map(format!("{audio_index}:a"));

    None
  } else {
    None
  }
}

fn configure_output_options(ffmpeg: &mut FfmpegCommand, destination_file_path: &Path) {
  ffmpeg.arg("-shortest");

  #[cfg(target_os = "macos")]
  {
    ffmpeg.codec_video("h264_videotoolbox");
    ffmpeg.args(["-b:v", "12000k", "-profile:v", "high"]);
  }

  #[cfg(not(target_os = "macos"))]
  ffmpeg.codec_video("libx264").crf(20); // Software backed

  ffmpeg.pix_fmt("yuv420p");
  ffmpeg.codec_audio("aac");
  ffmpeg.args(["-b:a", "192k"]);

  ffmpeg.output(destination_file_path.to_string_lossy());
}

/// Return unique non existing path for base.
///
/// Supports files and directories.
fn unique_path(base: PathBuf) -> PathBuf {
  if !base.exists() {
    return base;
  }

  let parent = base.parent().unwrap_or_else(|| Path::new("."));
  let name = base.file_name().unwrap_or_default().to_string_lossy();

  let (stem, extension) = match name.rsplit_once(".") {
    Some((s, e)) if base.is_file() => (s.to_string(), Some(e.to_string())),
    _ => (name.to_string(), None),
  };

  loop {
    let uuid = Uuid::new_v4();
    let candidate_name = match &extension {
      Some(ext) => format!("{stem}_{uuid}.{ext}"),
      None => format!("{stem}_{uuid}"),
    };

    let candidate_path = parent.join(candidate_name);
    if !candidate_path.exists() {
      return candidate_path;
    }
  }
}

fn prepare_output_path(
  destination_file_path: &Path,
  separate_camera_file: bool,
) -> (PathBuf, Option<PathBuf>) {
  if separate_camera_file {
    let unique_dir = unique_path(destination_file_path.parent().unwrap().to_path_buf());
    std::fs::create_dir_all(&unique_dir).expect("Failed to create output directory");

    let file_name = destination_file_path.file_name().unwrap();
    let stem = destination_file_path.file_stem().unwrap().to_string_lossy();
    let ext = destination_file_path
      .extension()
      .map_or("".into(), |e| format!("{}", e.to_string_lossy()));

    let recording_file = unique_dir.join(file_name);
    let camera_file = unique_dir.join(format!("{stem}_camera.{ext}"));

    (recording_file, Some(camera_file))
  } else {
    (unique_path(destination_file_path.to_path_buf()), None)
  }
}

/// Spawn a FFmpeg progress thread.
///
/// Emits `ExportProgress` with milliseconds processed.
fn ffmpeg_progress_reader(app_handle: AppHandle, stdout: ChildStdout) {
  let reader = BufReader::new(stdout);
  for line in reader.lines().map_while(Result::ok) {
    if let Some(timestamp_str) = line.strip_prefix("out_time=") {
      if let Ok(milliseconds) = parse_timestamp_to_milliseconds(timestamp_str) {
        let _ = app_handle.emit(Events::ExportProgress.as_ref(), milliseconds);
      }
    }
  }
}

/// Parse FFmpeg timestamp string `HH:MM:SS.mmm` to milliseconds.
fn parse_timestamp_to_milliseconds(ts: &str) -> Result<u64, ()> {
  let parts: Vec<&str> = ts.trim().split(":").collect();
  if parts.len() != 3 {
    return Err(());
  }

  let hours: u64 = parts[0].parse().map_err(|_| ())?;
  let minutes: u64 = parts[1].parse().map_err(|_| ())?;

  let seconds_parts: Vec<&str> = parts[2].split(".").collect();
  let seconds: u64 = seconds_parts[0].parse().map_err(|_| ())?;
  let milliseconds: u64 = if seconds_parts.len() > 1 {
    seconds_parts[1]
      .chars()
      .take(3)
      .collect::<String>()
      .parse()
      .unwrap_or(0)
  } else {
    0
  };

  let total_milliseconds = (hours * 3600 + minutes * 60 + seconds) * 1000 + milliseconds;

  Ok(total_milliseconds)
}

/// Delete generated files (including new folder, if relevant)
fn handle_cancellation(output_path: PathBuf, camera_path: Option<PathBuf>) {
  if let Some(camera_path) = camera_path {
    if let Ok(exists) = camera_path.try_exists() {
      if exists {
        if let Some(folder) = camera_path.parent() {
          if let Err(e) = std::fs::remove_dir_all(folder) {
            eprintln!("Failed to remove folder {folder:?}: {e}");
          }
          return;
        }
      }
    }
  }

  if let Ok(exists) = output_path.try_exists() {
    if exists {
      if let Err(e) = std::fs::remove_file(&output_path) {
        eprintln!("Failed to remove output file {output_path:?}: {e}");
      }
    }
  }
}

/// Open path in file manager.
///
/// Opens to the folder rather than the file, if provided.
pub fn open_path_in_file_browser(path: PathBuf) {
  let target = if path.is_dir() {
    path
  } else {
    path.parent().unwrap_or(path.as_path()).to_path_buf()
  };

  #[cfg(target_os = "macos")]
  let _ = Command::new("open").arg(target).status();

  #[cfg(target_os = "windows")]
  unimplemented!("Windows does not support opening folders after export")
}
