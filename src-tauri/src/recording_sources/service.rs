use std::{
  ffi::{c_char, CStr},
  fs::{self, File},
  io::{self, Write},
  path::PathBuf,
  sync::Arc,
};

use cidre::sc::{self};
use cocoa::base::nil;

use futures::{stream::FuturesUnordered, StreamExt};
use image::DynamicImage;
use objc::{
  msg_send,
  runtime::{Class, Object},
  sel, sel_impl,
};
use scap::{get_all_targets, Target};
use uuid::Uuid;
use xcap::Window;

use super::commands::WindowDetails;

/// Return data for visible windows.
///
/// Icons and preview thumbnails are saved under `{app_temp_dir}/window-selector`.
pub async fn get_visible_windows(app_temp_dir: PathBuf) -> Vec<WindowDetails> {
  let window_selector_folder = app_temp_dir.join("window-selector");
  let _ = clear_folder_contents(&window_selector_folder);

  let targets = Arc::new(get_all_targets());
  let shareable_content = sc::ShareableContent::current().await.unwrap();
  let shareable_windows = shareable_content.windows();
  let windows_for_thumbnail_arc = Arc::new(Window::all().unwrap());

  let futures = FuturesUnordered::new();

  for window in shareable_windows.iter() {
    if let Some(title) = window.title() {
      if !title.is_empty() && window.window_layer() == 0 && window.is_on_screen() {
        let title = title.to_string();
        let app_pid = window.owning_app().unwrap().process_id();
        let targets = Arc::clone(&targets);
        let window_selector_folder = window_selector_folder.clone();

        let windows_for_thumbnail = Arc::clone(&windows_for_thumbnail_arc);
        futures.push(async move {
          let app_icon_path = get_app_icon(window_selector_folder.clone(), app_pid);
          let thumbnail_path = tokio::task::spawn_blocking(move || {
            create_and_save_thumbnail(
              window_selector_folder,
              app_pid as u32,
              windows_for_thumbnail,
            )
          })
          .await
          .unwrap();

          let target_id = targets.iter().find_map(|t| match t {
            Target::Window(window_target) if window_target.title == title => Some(window_target.id),
            _ => None,
          });

          WindowDetails {
            id: target_id.unwrap_or_default(),
            title,
            app_icon_path,
            thumbnail_path,
          }
        });
      }
    }
  }

  let results: Vec<WindowDetails> = futures.collect().await;
  results
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

/// Save screenshot of app with `app_pid`
fn create_and_save_thumbnail(
  dir_path: PathBuf,
  app_pid: u32,
  windows_for_thumbnail: Arc<Vec<Window>>,
) -> Option<PathBuf> {
  if let Some(window_for_thumbnail) = windows_for_thumbnail
    .iter()
    .find(|w| w.pid().unwrap_or_default() == app_pid)
  {
    let thumbnail = window_for_thumbnail.capture_image().unwrap();
    let (width, height) = thumbnail.dimensions();

    let dyn_image = DynamicImage::ImageRgba8(thumbnail);
    let resized = dyn_image.resize(width / 5, height / 5, image::imageops::FilterType::Nearest);

    let uuid = Uuid::new_v4();
    let thumbnail_path = dir_path.join(format!("{}.png", uuid));
    let _ = resized.save(&thumbnail_path);

    return Some(thumbnail_path);
  }

  None
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
