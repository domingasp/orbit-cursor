use std::{io::Write, process::ChildStdin};

use nokhwa::{
  pixel_format::RgbAFormat,
  utils::{CameraIndex, FrameFormat, RequestedFormat, RequestedFormatType},
  Buffer, CallbackCamera,
};
use tauri::ipc::Channel;
use yuv::{YuvPackedImage, YuvRange, YuvStandardMatrix};

fn yuyv_to_rgba(buffer: &[u8], width: u32, height: u32) -> Vec<u8> {
  let mut rgba_buffer = vec![0u8; (width * height * 4) as usize];

  let packed_image = YuvPackedImage {
    yuy: buffer,
    yuy_stride: width * 2,
    width,
    height,
  };

  let _ = yuv::yuyv422_to_rgba(
    &packed_image,
    &mut rgba_buffer,
    width * 4,
    YuvRange::Limited,
    YuvStandardMatrix::Bt709,
  );

  rgba_buffer
}

pub fn live_frame_callback(frame: Buffer, channel: &Channel) {
  let (width, height) = {
    let r = frame.resolution();
    (r.width(), r.height())
  };

  let buffer = if frame.source_frame_format() == FrameFormat::YUYV {
    yuyv_to_rgba(frame.buffer(), width, height)
  } else {
    frame.buffer().to_vec()
  };

  // Encoding width and height into bytes - avoids heavy serialization
  let mut header = Vec::with_capacity(8);
  header.extend(&width.to_le_bytes());
  header.extend(&height.to_le_bytes());

  let mut combined = header;
  combined.extend(buffer);

  // Send via channel to UI
  let _ = channel.send(tauri::ipc::InvokeResponseBody::Raw(combined));
}

pub fn capture_to_file_callback(frame: Buffer, ffmpeg_stdin: &mut ChildStdin) {
  let (width, height) = {
    let r = frame.resolution();
    (r.width(), r.height())
  };

  let buffer = if frame.source_frame_format() == FrameFormat::YUYV {
    yuyv_to_rgba(frame.buffer(), width, height)
  } else {
    frame.buffer().to_vec()
  };

  let _ = ffmpeg_stdin.write_all(&buffer);
}

pub fn create_and_start_camera(
  camera_index: CameraIndex,
  callback: impl FnMut(Buffer) + Send + 'static,
) -> Option<CallbackCamera> {
  let requested = RequestedFormat::new::<RgbAFormat>(RequestedFormatType::AbsoluteHighestFrameRate);

  match CallbackCamera::new(camera_index, requested, callback) {
    Ok(mut camera) => {
      let _ = camera.open_stream();
      Some(camera)
    }
    Err(e) => {
      eprintln!("Failed to initialize camera: {}", e);
      None
    }
  }
}

/// Temporarily opens a camera to get dimensions
///
/// Returns `(width, height)`
pub fn get_camera_dimensions(camera_index: &CameraIndex) -> Option<(u32, u32)> {
  let requested = RequestedFormat::new::<RgbAFormat>(RequestedFormatType::AbsoluteHighestFrameRate);

  if let Ok(mut camera) = CallbackCamera::new(camera_index.clone(), requested, |_| {}) {
    if camera.open_stream().is_ok() {
      let resolution = camera.resolution().unwrap();
      let width = resolution.width();
      let height = resolution.height();

      std::thread::spawn(move || {
        // Need a thread to stop stream otherwise freezes main thread
        let _ = camera.stop_stream();
      });

      return Some((width, height));
    }
  }
  None
}
