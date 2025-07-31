use nokhwa::{
  pixel_format::RgbAFormat,
  utils::{CameraIndex, FrameFormat, RequestedFormat, RequestedFormatType, Resolution},
  Buffer, CallbackCamera, Camera,
};
use rayon::{
  iter::{IndexedParallelIterator, ParallelIterator},
  slice::ParallelSliceMut,
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

pub fn get_camera_details(camera_index: CameraIndex) -> (Resolution, u32, FrameFormat) {
  let requested = RequestedFormat::new::<RgbAFormat>(RequestedFormatType::AbsoluteHighestFrameRate);
  let camera = Camera::new(camera_index, requested).unwrap();

  let resolution = camera.resolution();
  let frame_rate = camera.frame_rate();
  let frame_format = camera.frame_format();

  (resolution, frame_rate, frame_format)
}

pub fn create_camera(
  camera_index: CameraIndex,
  callback: impl FnMut(Buffer) + Send + 'static,
) -> Option<CallbackCamera> {
  let requested = RequestedFormat::new::<RgbAFormat>(RequestedFormatType::AbsoluteHighestFrameRate);

  match CallbackCamera::new(camera_index, requested, callback) {
    Ok(camera) => Some(camera),
    Err(e) => {
      eprintln!("Failed to initialize camera: {e}");
      None
    }
  }
}

/// Parallelized conversion from YUYV to RGBA
fn yuyv_to_rgba(buffer: &[u8], width: u32, height: u32) -> Vec<u8> {
  let yuyv_stride = width * 2;
  let rgba_stride = width * 4; // 4 represents R G B PixelPadding
  let mut rgba_buffer = vec![0u8; (width * height * 4) as usize];

  // Each chunk is one row of RGBA pixels
  rgba_buffer
    .par_chunks_mut((rgba_stride) as usize)
    .enumerate()
    .for_each(|(row_index, row_rgba)| {
      let input_offset = row_index * (yuyv_stride) as usize;
      let input_slice = &buffer[input_offset..input_offset + (width * 2) as usize];

      let packed_image = YuvPackedImage {
        yuy: input_slice,
        yuy_stride: width * 2,
        width,
        height: 1, // Single row
      };

      let _ = yuv::yuyv422_to_rgba(
        &packed_image,
        row_rgba,
        rgba_stride,
        YuvRange::Full,
        YuvStandardMatrix::Bt601,
      );
    });

  rgba_buffer
}
