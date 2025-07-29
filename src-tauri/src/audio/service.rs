use std::collections::VecDeque;

use cpal::{
  traits::{DeviceTrait, HostTrait},
  Device, Stream, StreamConfig,
};
use tauri::{ipc::Channel, Emitter};

use crate::APP_HANDLE;

use super::models::AudioStreamChannel;

pub fn build_audio_live_monitoring_stream(
  device: &Device,
  config: &StreamConfig,
  channel: Channel<AudioStreamChannel>,
  emit_on_err: Option<String>,
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
      move |err| {
        if let Some(to_emit) = &emit_on_err {
          let _ = APP_HANDLE.get().unwrap().emit(to_emit.as_str(), ());
        } else {
          eprintln!("{err:?}");
        }
      },
      None,
    )
    .expect("Error creating stream")
}

pub fn get_input_audio_device(device_name: String) -> Option<(Device, StreamConfig)> {
  let host = cpal::default_host();
  let device = host
    .input_devices()
    .unwrap()
    .find(|device| device.name().unwrap() == device_name.as_str())?;
  let config = device.default_input_config().unwrap();

  Some((device, config.into()))
}

/// Return system audio device and config
#[cfg(target_os = "macos")]
pub fn get_system_audio_device() -> (Device, StreamConfig) {
  let host = cpal::host_from_id(cpal::HostId::ScreenCaptureKit).unwrap();
  let device = host
    .default_input_device()
    .expect("No default device found");
  let config = device
    .default_input_config()
    .expect("Unsupported input config");

  (device, config.into())
}

#[cfg(target_os = "windows")]
pub fn get_system_audio_device() -> (Device, StreamConfig) {
  unimplemented!("System audio not supported on windows");
}

fn buffer_to_decibels(samples: &[f32]) -> f32 {
  let sum_squares: f32 = samples.iter().map(|&s| s * s).sum();
  let mean_square: f32 = sum_squares / (samples.len() as f32);
  let rms = mean_square.sqrt();

  20.0 * rms.max(1e-8).log10()
}
