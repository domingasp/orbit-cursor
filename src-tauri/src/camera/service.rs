use nokhwa::{
  pixel_format::RgbAFormat,
  utils::{CameraIndex, FrameFormat, RequestedFormat, RequestedFormatType},
  Buffer, CallbackCamera,
};
use tauri::ipc::Channel;
use yuv::{YuvPackedImage, YuvRange, YuvStandardMatrix};

pub fn frame_to_rgba(frame: Buffer) -> Vec<u8> {
  let (width, height) = {
    let r = frame.resolution();
    (r.width(), r.height())
  };

  if frame.source_frame_format() == FrameFormat::YUYV {
    yuyv_to_rgba(frame.buffer(), width, height)
  } else {
    frame.buffer().to_vec()
  }
}

pub fn live_frame_callback(frame: Buffer, channel: &Channel) {
  let (width, height) = {
    let r = frame.resolution();
    (r.width(), r.height())
  };

  let buffer = frame_to_rgba(frame);

  // Encoding width and height into bytes - avoids heavy serialization
  let mut header = Vec::with_capacity(8);
  header.extend(&width.to_le_bytes());
  header.extend(&height.to_le_bytes());

  let mut combined = header;
  combined.extend(buffer);

  // Send via channel to UI
  let _ = channel.send(tauri::ipc::InvokeResponseBody::Raw(combined));
}

pub fn create_camera(
  camera_index: CameraIndex,
  callback: impl FnMut(Buffer) + Send + 'static,
) -> Option<CallbackCamera> {
  let requested = RequestedFormat::new::<RgbAFormat>(RequestedFormatType::AbsoluteHighestFrameRate);

  match CallbackCamera::new(camera_index, requested, callback) {
    Ok(camera) => Some(camera),
    Err(e) => {
      eprintln!("Failed to initialize camera: {}", e);
      None
    }
  }
}

pub fn frame_format_to_ffmpeg(frame_format: FrameFormat) -> &'static str {
  match frame_format {
    FrameFormat::MJPEG => "mjpeg",
    FrameFormat::YUYV => "yuyv422",
    FrameFormat::NV12 => "nv12",
    FrameFormat::GRAY => "gray",
    FrameFormat::RAWRGB => "rgb24",
    FrameFormat::RAWBGR => "bgr24",
  }
}

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
