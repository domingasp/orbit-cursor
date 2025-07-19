use std::path::{Path, PathBuf};

use ffmpeg_sidecar::command::FfmpegCommand;
use uuid::Uuid;

use crate::recording::models::RecordingFile;

pub fn encode_recording(
  source_folder_path: PathBuf,
  destination_file_path: PathBuf,
  separate_audio_tracks: bool,
  separate_camera_file: bool,
) {
  let mut child = FfmpegCommand::new();

  let available_streams = check_recording_files(source_folder_path.as_path());

  let (output_path, camera_path) =
    prepare_output_path(&destination_file_path, separate_camera_file);

  // THREAD TO COPY

  configure_input_streams(
    &mut child,
    &source_folder_path,
    &available_streams,
    separate_camera_file,
  );

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

  let mut ffmpeg_child = child.spawn().unwrap();
  let _ = ffmpeg_child.wait();

  if let Some(camera_path) = camera_path {
    let _ = std::fs::copy(
      source_folder_path.join(RecordingFile::Camera.to_string()),
      camera_path,
    );
  }
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
    has_microphone: folder.join(RecordingFile::InputAudio.to_string()).exists(),
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
        .join(RecordingFile::InputAudio.as_ref())
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
      ffmpeg.map(format!("{}:a", audio_index));
      audio_index += 1;
    }

    if has_system_audio {
      ffmpeg.map(format!("{}:a", audio_index));
    }

    None
  } else if has_microphone && has_system_audio {
    ffmpeg.map("[aout]");

    Some(
      format!(
        "[{}:a][{}:a]amix=inputs=2[aout]",
        mic_input_index, sys_input_index
      )
      .to_string(),
    )
  } else if has_microphone || has_system_audio {
    let audio_index = if has_microphone {
      mic_input_index
    } else {
      sys_input_index
    };

    ffmpeg.map(format!("{}:a", audio_index));

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
  child.codec_video("libx264").crf(20); // Software backed

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
      Some(ext) => format!("{}_{}.{}", stem, uuid, ext),
      None => format!("{}_{}", stem, uuid),
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
    let camera_file = unique_dir.join(format!("{}_camera.{}", stem, ext));

    (recording_file, Some(camera_file))
  } else {
    (unique_path(destination_file_path.to_path_buf()), None)
  }
}
