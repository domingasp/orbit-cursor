use std::collections::VecDeque;

use cpal::{
  traits::{DeviceTrait, HostTrait},
  Stream,
};
use tauri::{ipc::Channel, Emitter};

use crate::{constants::events::SYSTEM_AUDIO_STREAM_ERROR, APP_HANDLE};

use super::commands::AudioStreamChannel;

fn buffer_to_decibels(samples: &[f32]) -> f32 {
  let sum_squares: f32 = samples.iter().map(|&s| s * s).sum();

  let mean_square: f32 = sum_squares / (samples.len() as f32);
  let rms = mean_square.sqrt();

  20.0 * rms.max(1e-8).log10()
}

fn adaptive_ema(current: f32, previous: f32, alpha: f32) -> f32 {
  alpha * current + (1.0 - alpha) * previous
}

pub fn create_system_audio_stream(channel: Channel<AudioStreamChannel>) -> Stream {
  const BUFFER_SIZE: usize = 1024;

  let host = cpal::host_from_id(cpal::HostId::ScreenCaptureKit).unwrap();
  let device = host
    .default_input_device()
    .expect("No default device found");
  let config = device
    .default_input_config()
    .expect("Unsupported input config");

  let mut buffer = VecDeque::with_capacity(BUFFER_SIZE);
  let mut previous_smoothed = -100.0;
  let mut previous_raw = -100.0;

  device
    .build_input_stream(
      &config.into(),
      move |data: &[f32], _: &cpal::InputCallbackInfo| {
        for &sample in data.iter() {
          if buffer.len() == BUFFER_SIZE {
            buffer.pop_front();
          }
          buffer.push_back(sample);
        }

        if buffer.len() == BUFFER_SIZE {
          let current_raw = buffer_to_decibels(buffer.make_contiguous());
          let delta = (current_raw - previous_raw).abs();
          let alpha = if delta > 5.0 {
            0.2
          } else if delta < 2.0 {
            0.01
          } else {
            0.1
          };
          let smoothed = adaptive_ema(current_raw, previous_smoothed, alpha);

          channel
            .send(AudioStreamChannel::Signal { decibels: smoothed })
            .unwrap();
          previous_raw = current_raw;
          previous_smoothed = smoothed;
        }
      },
      move |_err| {
        let _ = APP_HANDLE
          .get()
          .unwrap()
          .emit(SYSTEM_AUDIO_STREAM_ERROR, ());
      },
      None,
    )
    .expect("Error creating stream")
}
