use std::{io::Write, path::PathBuf, sync::Arc, thread::JoinHandle};

use cpal::{
  traits::{DeviceTrait, StreamTrait},
  Device, StreamConfig,
};
use ffmpeg_sidecar::command::FfmpegCommand;
use parking_lot::Mutex;

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
  spawn_audio_recorder(device, config, file_path, synchronization)
}

pub fn start_microphone_recorder(
  file_path: PathBuf,
  synchronization: StreamSync,
  device_name: String,
) -> Option<JoinHandle<()>> {
  if let Some((device, config)) = get_microphone(device_name.clone()) {
    Some(spawn_audio_recorder(
      device,
      config,
      file_path,
      synchronization,
    ))
  } else {
    log::warn!("Failed to find microphone: {device_name}");
    None
  }
}

fn spawn_audio_recorder(
  device: Device,
  config: StreamConfig,
  file_path: PathBuf,
  synchronization: StreamSync,
) -> JoinHandle<()> {
  let device_name = device.name().unwrap();
  let log_prefix = format!("[audio:{device_name}]");

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
  log_ffmpeg_output(ffmpeg.take_stderr().unwrap(), log_prefix.clone());

  let stdin = ffmpeg
    .take_stdin()
    .expect("Failed to take stdin for audio Ffmpeg");
  let writer = Arc::new(Mutex::new(stdin));

  let writer_for_callback = writer.clone();
  let should_write = synchronization.should_write;

  log::info!("{log_prefix} Building audio stream");
  let stream = device
    .build_input_stream(
      &config,
      move |data: &[f32], _| {
        if !should_write.load(std::sync::atomic::Ordering::SeqCst) {
          return;
        }

        let mut buffer = Vec::with_capacity(data.len() * 2);
        for &sample in data {
          let s = (sample * i16::MAX as f32).clamp(i16::MIN as f32, i16::MAX as f32);
          buffer.extend_from_slice(&(s as i16).to_le_bytes());
        }

        let _ = writer_for_callback.lock().write_all(&buffer);
      },
      |err| {
        log::warn!("Audio stream error: {err:?}");
      },
      None,
    )
    .expect("Failed to build audio stream");

  let mut stop_rx = synchronization.stop_tx.subscribe();

  std::thread::spawn(move || {
    log::info!("{log_prefix} Starting audio stream");
    stream.play().expect("Failed to start audio stream");

    let _ = stop_rx.blocking_recv();

    log::info!("{log_prefix} Audio stream received stop message, dropping stdin");
    drop(stream); // cpal has no stop capability, stream cleaned on drop

    log::info!("{log_prefix} Cleaning up audio ffmpeg");
    let _ = ffmpeg.wait();

    log::info!("{log_prefix} Audio ffmpeg finished");
  })
}
