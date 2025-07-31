use std::{
  io::Write,
  path::{Path, PathBuf},
  process::ChildStdin,
  sync::{atomic::AtomicBool, Arc, Barrier},
  thread::JoinHandle,
};

use cpal::{
  traits::{DeviceTrait, StreamTrait},
  Device, StreamConfig,
};
use ffmpeg_sidecar::{child::FfmpegChild, command::FfmpegCommand};
use once_cell::sync::OnceCell;
use parking_lot::Mutex;
use tokio::sync::broadcast;

#[cfg(debug_assertions)]
use crate::recording::ffmpeg::log_ffmpeg_output;
use crate::{
  audio::service::{get_microphone, get_system_audio_device},
  recording::models::StreamSync,
};

/// Start system audio recorder in a dedicated thread
pub fn start_system_audio_recorder(
  file_path: PathBuf,
  synchronization: StreamSync,
) -> JoinHandle<()> {
  let (device, config) = get_system_audio_device();
  spawn_audio_recorder(device, config, file_path, synchronization, 0.0)
}

/// Start microphone audio recorder in dedicated thread
pub fn start_microphone_recorder(
  file_path: PathBuf,
  synchronization: StreamSync,
  device_name: String,
) -> Option<JoinHandle<()>> {
  if let Some((device, config)) = get_microphone(device_name.clone()) {
    let offset = {
      #[cfg(target_os = "macos")]
      {
        // Mac system recording is slightly delayed when trying to sync with microphone recording
        // this offset compensates for this
        0.19
      }
      #[cfg(not(target_os = "macos"))]
      {
        0.0
      }
    };

    Some(spawn_audio_recorder(
      device,
      config,
      file_path,
      synchronization,
      offset,
    ))
  } else {
    log::warn!("Failed to find microphone: {device_name}");
    // Need to mark this as ready even though no device was found
    tauri::async_runtime::spawn_blocking(move || {
      synchronization.ready_barrier.wait();
    });
    None
  }
}

/// Coordinate spawning audio recording thread, conversion, and writing to file
fn spawn_audio_recorder(
  device: Device,
  config: StreamConfig,
  file_path: PathBuf,
  synchronization: StreamSync,
  start_offset_secs: f32,
) -> JoinHandle<()> {
  let device_name = device.name().unwrap();
  let log_prefix = format!("[audio:{device_name}]");

  let (ffmpeg, stdin) = spawn_audio_ffmpeg(&file_path, &config, log_prefix.clone());
  let writer = Arc::new(Mutex::new(stdin));

  let (silence_bytes, tail_buffer, silence_written) =
    prepare_offset_handling(&config, start_offset_secs);

  let stream = build_audio_stream(
    &device,
    &config,
    writer.clone(),
    tail_buffer.clone(),
    silence_written,
    synchronization.should_write.clone(),
    silence_bytes,
  );

  spawn_audio_thread(
    stream,
    tail_buffer,
    writer,
    synchronization.stop_tx.subscribe(),
    synchronization.ready_barrier.clone(),
    ffmpeg,
    log_prefix,
  )
}

/// Create and spawn the audio writer ffmpeg
fn spawn_audio_ffmpeg(
  file_path: &Path,
  config: &StreamConfig,
  log_prefix: String,
) -> (FfmpegChild, ChildStdin) {
  log::info!("{log_prefix} Spawning audio ffmpeg");

  let mut ffmpeg = FfmpegCommand::new()
    .format("s16le")
    .args(["-ar", &config.sample_rate.0.to_string()])
    .args(["-ac", &config.channels.to_string()])
    .input("-")
    .codec_audio("pcm_s16le")
    .output(file_path.to_string_lossy())
    .spawn()
    .unwrap();

  #[cfg(debug_assertions)]
  log_ffmpeg_output(ffmpeg.take_stderr().unwrap(), log_prefix);

  let stdin = ffmpeg
    .take_stdin()
    .expect("Failed to take stdin for audio Ffmpeg");

  (ffmpeg, stdin)
}

/// Spawn audio thread for tearing down and finalizing recording
fn spawn_audio_thread(
  stream: cpal::Stream,
  tail_buffer: Arc<Mutex<TailBuffer>>,
  writer: Arc<Mutex<ChildStdin>>,
  mut stop_rx: broadcast::Receiver<()>,
  ready_barrier: Arc<Barrier>,
  mut ffmpeg: FfmpegChild,
  log_prefix: String,
) -> JoinHandle<()> {
  std::thread::spawn(move || {
    log::info!("{log_prefix} Starting audio stream");
    stream.play().expect("Failed to start audio stream");
    ready_barrier.wait();

    let _ = stop_rx.blocking_recv();

    log::info!("{log_prefix} Audio stream received stop message, finishing writing");

    drop(stream); // cpal has no stop capability, stream cleaned on drop
    drop(writer);
    drop(tail_buffer);

    log::info!("{log_prefix} Cleaning up audio ffmpeg");
    let _ = ffmpeg.wait();

    log::info!("{log_prefix} Audio ffmpeg finished");
  })
}

/// Offset may be introduced in streams to ensure correct synchronization
fn prepare_offset_handling(
  config: &StreamConfig,
  start_offset_secs: f32,
) -> (Vec<u8>, Arc<Mutex<TailBuffer>>, Arc<OnceCell<bool>>) {
  let sample_rate = config.sample_rate.0 as usize;
  let channels = config.channels as usize;
  let bytes_per_sample = 2;

  let samples_to_delay = ((start_offset_secs * sample_rate as f32).round() as usize) * channels;
  let silence_bytes = vec![0u8; samples_to_delay * bytes_per_sample];

  let tail_buffer = Arc::new(Mutex::new(TailBuffer::new(silence_bytes.len())));
  let silence_written = Arc::new(OnceCell::new());

  (silence_bytes, tail_buffer, silence_written)
}

/// Build audio stream for reading and writing audio data
fn build_audio_stream(
  device: &Device,
  config: &StreamConfig,
  writer: Arc<Mutex<ChildStdin>>,
  tail_buffer: Arc<Mutex<TailBuffer>>,
  silence_written: Arc<OnceCell<bool>>,
  should_write: Arc<AtomicBool>,
  silence_bytes: Vec<u8>,
) -> cpal::Stream {
  device
    .build_input_stream(
      config,
      move |samples: &[f32], _| {
        if !should_write.load(std::sync::atomic::Ordering::SeqCst) {
          return;
        }

        let bytes = f32_samples_to_i16_bytes(samples);
        let mut writer = writer.lock();

        if silence_written.get().is_none() {
          let _ = writer.write_all(&silence_bytes);
          let _ = silence_written.set(true);
        }

        let _ = tail_buffer.lock().push_and_write(&bytes, &mut *writer);
      },
      |err| {
        log::warn!("Audio stream error: {err:?}");
      },
      None,
    )
    .expect("Failed to build audio stream")
}

/// Convert raw samples into signed 16 little endian format
fn f32_samples_to_i16_bytes(samples: &[f32]) -> Vec<u8> {
  let mut bytes = Vec::with_capacity(samples.len() * 2);
  for &sample in samples {
    let clamped = (sample * i16::MAX as f32).clamp(i16::MIN as f32, i16::MAX as f32);
    bytes.extend_from_slice(&(clamped as i16).to_le_bytes());
  }

  bytes
}

// This is only relevant if offset is used, the offset on the front is removed
// from the end, this way the audio length is correct without extra padding
struct TailBuffer {
  buffer: std::collections::VecDeque<u8>,
  capacity: usize,
}

impl TailBuffer {
  fn new(capacity: usize) -> Self {
    Self {
      buffer: std::collections::VecDeque::with_capacity(capacity),
      capacity,
    }
  }

  fn push_and_write<W: std::io::Write>(
    &mut self,
    bytes: &[u8],
    writer: &mut W,
  ) -> std::io::Result<()> {
    while self.buffer.len() + bytes.len() > self.capacity {
      if let Some(byte) = self.buffer.pop_front() {
        writer.write_all(&[byte])?;
      } else {
        break;
      }
    }

    self.buffer.extend(bytes);

    Ok(())
  }
}
