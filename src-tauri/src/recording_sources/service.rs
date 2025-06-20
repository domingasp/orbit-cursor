use std::{
  ffi::{c_char, CStr},
  fs::{self, File},
  io::{self, Write},
  path::PathBuf,
  sync::Arc,
};

use cidre::{
  ns::Array,
  sc::{self, Display},
};
use cocoa::base::nil;

use futures::future::join_all;
use image::DynamicImage;
use objc::{
  msg_send,
  runtime::{Class, Object},
  sel, sel_impl,
};
use scap::{get_all_targets, Target};
use tauri::{Emitter, LogicalSize, Monitor};
use uuid::Uuid;
use xcap::Window;

use crate::{constants::Events, APP_HANDLE};

use super::commands::WindowDetails;

/// \[MacOS\] Return data for visible windows.
///
/// Icons and preview thumbnails are saved under `{app_temp_dir}/window-selector`.
/// If no dir provided no thumbnails will be generated. Emits `WindowThumbnailsGenerated`.
pub fn get_visible_windows(
  monitors: Vec<Monitor>,
  app_temp_dir: Option<PathBuf>,
) -> Vec<WindowDetails> {
  let targets = Arc::new(get_all_targets());

  // no sync method for current, this is the correct approach - https://github.com/yury/cidre/discussions/26
  let (tx, rx) = std::sync::mpsc::channel();
  sc::ShareableContent::current_with_ch(move |res, _err| {
    tx.send(res.unwrap().retained()).unwrap();
  });

  let shareable_content = rx.recv().unwrap();
  let shareable_displays = shareable_content.displays();
  let shareable_windows = shareable_content.windows();
  let windows_for_thumbnail_arc = Arc::new(Window::all().unwrap());

  let window_selector_folder = if let Some(app_temp_dir) = app_temp_dir {
    let dir = app_temp_dir.join("window-selector");
    let _ = clear_folder_contents(&dir);
    Some(dir)
  } else {
    None
  };

  let mut all_windows = Vec::new();
  let mut thumbnail_tasks = Vec::new();
  for window in shareable_windows.iter() {
    if let Some(title) = window.title() {
      if !title.is_empty() && window.window_layer() == 0 && window.is_on_screen() {
        let title = title.to_string();
        let app_pid = window.owning_app().unwrap().process_id();
        let window_id = window.id();
        let frame = window.frame();
        let targets = Arc::clone(&targets);
        let window_selector_folder = window_selector_folder.clone();

        let window_display_index = get_window_display(&shareable_displays, frame);
        let scale_factor = monitors[window_display_index].scale_factor();

        let windows_for_thumbnail = Arc::clone(&windows_for_thumbnail_arc);

        let mut app_icon_path: Option<PathBuf> = None;
        let mut thumbnail_path: Option<PathBuf> = None;

        if let Some(thumbnail_folder) = window_selector_folder.clone() {
          app_icon_path = get_app_icon(thumbnail_folder.clone(), app_pid);

          let path = generate_thumbnail_path(thumbnail_folder);
          thumbnail_path = Some(path.clone());

          let thumbnail_task = tauri::async_runtime::spawn_blocking(move || {
            create_and_save_thumbnail(path, window_id, windows_for_thumbnail)
          });

          thumbnail_tasks.push(thumbnail_task);
        }

        let target_id = targets.iter().find_map(|t| match t {
          Target::Window(window_target) if window_target.title == title => Some(window_target.id),
          _ => None,
        });

        all_windows.push(WindowDetails {
          id: target_id.unwrap_or_default(),
          title,
          app_icon_path,
          thumbnail_path,
          size: LogicalSize::new(frame.size.width, frame.size.height),
          scale_factor,
        });
      }
    }
  }

  if !thumbnail_tasks.is_empty() {
    // Use async runtime for faster thumbnail generation
    tauri::async_runtime::spawn(async move {
      join_all(thumbnail_tasks).await;

      let app_handle = APP_HANDLE.get().unwrap();
      let _ = app_handle.emit(Events::WindowThumbnailsGenerated.as_ref(), ());
    });
  }

  all_windows
}

#[link(name = "AppKit", kind = "framework")]
extern "C" {
  pub fn NSIntersectionRect(a: cidre::ns::Rect, b: cidre::ns::Rect) -> cidre::ns::Rect;
}

/// Estimates the display based on intersection size
///
/// Many edge cases not managed, down to the user to properly position their
/// windows.
fn get_window_display(shareable_displays: &Array<Display>, window_frame: cidre::ns::Rect) -> usize {
  let mut display_index: usize = 0;

  let mut largest_intersection_size: f64 = 0.0;
  for (i, display) in shareable_displays.iter().enumerate() {
    let display_frame = display.frame();
    unsafe {
      let intersection_rect = NSIntersectionRect(display_frame, window_frame);
      let intersection_size = intersection_rect.size.width * intersection_rect.size.height;

      if intersection_size > largest_intersection_size {
        largest_intersection_size = intersection_size;
        display_index = i;
      }
    }
  }

  display_index
}

/// [MacOS] Fetch app icon, save to file, and return path
fn get_app_icon(dir_path: PathBuf, pid: i32) -> Option<PathBuf> {
  unsafe {
    let running_app_class = Class::get("NSRunningApplication").unwrap();

    let running_app: *mut Object =
      msg_send![running_app_class, runningApplicationWithProcessIdentifier:pid];

    if running_app.is_null() {
      return None;
    }

    let bundle_id_obj: *const Object = msg_send![running_app, bundleIdentifier];
    if bundle_id_obj.is_null() {
      return None;
    }

    let cstr: *const c_char = msg_send![bundle_id_obj, UTF8String];
    let bundle_id = CStr::from_ptr(cstr).to_string_lossy().into_owned();
    let file_path = dir_path.join(format!("{}.png", bundle_id));
    if file_path.exists() {
      return Some(file_path);
    }

    let icon: *mut Object = msg_send![running_app, icon];
    if icon.is_null() {
      return None;
    }

    // NSImage to CGImage
    let cgimage: *mut Object = msg_send![icon, CGImageForProposedRect: nil context: nil hints: nil];
    if cgimage.is_null() {
      return None;
    }

    // CGImage to NSBitmapImageRep
    let bitmap_image_rep_class = Class::get("NSBitmapImageRep").unwrap();
    let bitmap_rep: *mut Object = msg_send![bitmap_image_rep_class, alloc];
    let bitmap_rep: *mut Object = msg_send![bitmap_rep, initWithCGImage: cgimage];
    if bitmap_rep.is_null() {
      return None;
    }

    // Bitmap to PNG (4 is the png representation)
    let png_data: *mut Object = msg_send![bitmap_rep, representationUsingType: 4 properties: nil];
    if png_data.is_null() {
      return None;
    }

    // NSData to Vec<u8>
    let length: usize = msg_send![png_data, length];
    let bytes: *const u8 = msg_send![png_data, bytes];
    if bytes.is_null() {
      return None;
    }

    let slice = std::slice::from_raw_parts(bytes, length);

    if let Err(e) = fs::create_dir_all(&dir_path) {
      eprintln!("Failed to create directory: {}", e);
      return None;
    }

    if let Err(e) = File::create(&file_path).and_then(|mut f| f.write_all(slice)) {
      eprintln!("Failed to write PNG file: {}", e);
      return None;
    }

    Some(file_path)
  }
}

pub fn generate_thumbnail_path(dir_path: PathBuf) -> PathBuf {
  let uuid = Uuid::new_v4();
  dir_path.join(format!("{}.png", uuid))
}

/// Save screenshot of app with `app_pid`
fn create_and_save_thumbnail(
  thumbnail_path: PathBuf,
  window_id: u32,
  windows_for_thumbnail: Arc<Vec<Window>>,
) {
  if let Some(window_for_thumbnail) = windows_for_thumbnail
    .iter()
    .find(|w| w.id().unwrap_or_default() == window_id)
  {
    let thumbnail = window_for_thumbnail.capture_image().unwrap();
    let (width, height) = thumbnail.dimensions();

    let dyn_image = DynamicImage::ImageRgba8(thumbnail);
    let resized = dyn_image.resize(width / 5, height / 5, image::imageops::FilterType::Nearest);

    let _ = resized.save(&thumbnail_path);
  }
}

fn clear_folder_contents(folder_path: &PathBuf) -> io::Result<()> {
  if folder_path.exists() && folder_path.is_dir() {
    for entry in fs::read_dir(folder_path)? {
      let entry = entry?;
      let path = entry.path();
      if path.is_dir() {
        fs::remove_dir_all(&path)?;
      } else {
        fs::remove_file(&path)?;
      }
    }
  }

  Ok(())
}
