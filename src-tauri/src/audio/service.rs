use std::collections::VecDeque;

use cpal::{
  traits::{DeviceTrait, HostTrait},
  Device, Stream, StreamConfig,
};
use tauri::{ipc::Channel, Emitter};

use crate::{
  constants::events::{INPUT_AUDIO_STREAM_ERROR, SYSTEM_AUDIO_STREAM_ERROR},
  APP_HANDLE,
};

use super::commands::AudioStreamChannel;

fn buffer_to_decibels(samples: &[f32]) -> f32 {
  let sum_squares: f32 = samples.iter().map(|&s| s * s).sum();

  let mean_square: f32 = sum_squares / (samples.len() as f32);
  let rms = mean_square.sqrt();

  20.0 * rms.max(1e-8).log10()
}

fn create_input_stream(
  device: &Device,
  config: &StreamConfig,
  channel: Channel<AudioStreamChannel>,
  emit_on_err: String,
) -> Stream {
  let buffer_window = (config.sample_rate.0 as f32 * 0.1) as usize;
  let mut buffer = VecDeque::with_capacity(buffer_window);

  device
    .build_input_stream(
      config,
      move |data: &[f32], _: &cpal::InputCallbackInfo| {
        for &sample in data.iter() {
          if buffer.len() == buffer_window {
            buffer.pop_front();
          }
          buffer.push_back(sample);
        }

        if buffer.len() == buffer_window {
          let decibels = buffer_to_decibels(buffer.make_contiguous());
          channel
            .send(AudioStreamChannel::Signal { decibels })
            .unwrap();
        }
      },
      move |_err| {
        let _ = APP_HANDLE.get().unwrap().emit(emit_on_err.as_str(), ());
      },
      None,
    )
    .expect("Error creating stream")
}

pub fn create_system_audio_stream(channel: Channel<AudioStreamChannel>) -> Stream {
  let host = cpal::host_from_id(cpal::HostId::ScreenCaptureKit).unwrap();
  let device = host
    .default_input_device()
    .expect("No default device found");
  let config = device
    .default_input_config()
    .expect("Unsupported input config");

  create_input_stream(
    &device,
    &config.into(),
    channel,
    SYSTEM_AUDIO_STREAM_ERROR.to_string(),
  )
}

pub fn create_input_audio_stream(
  device_name: String,
  channel: Channel<AudioStreamChannel>,
) -> Option<Stream> {
  let host = cpal::default_host();
  let device = host
    .input_devices()
    .ok()?
    .find(|device| device.name().ok().as_deref() == Some(device_name.as_str()))?;
  let config = device.default_input_config().ok()?;

  Some(create_input_stream(
    &device,
    &config.into(),
    channel,
    INPUT_AUDIO_STREAM_ERROR.to_string(),
  ))
}
