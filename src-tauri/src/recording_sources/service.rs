use std::{
  fs::{self},
  io::{self},
  path::{Path, PathBuf},
  sync::Arc,
};

use parking_lot::Mutex;

#[cfg(target_os = "windows")]
use std::{ffi::OsString, os::windows::ffi::OsStringExt};

#[cfg(target_os = "macos")]
use std::{
  ffi::{c_char, CStr},
  fs::File,
  io::Write,
};

#[cfg(target_os = "macos")]
use cidre::{
  ns::Array,
  sc::{self, Display},
};
#[cfg(target_os = "macos")]
use cocoa::base::nil;
#[cfg(target_os = "macos")]
use objc::{
  msg_send,
  runtime::{Class, Object},
  sel, sel_impl,
};

use futures::future::join_all;
use image::DynamicImage;

use scap::{get_all_targets, Target};
use tauri::{Emitter, LogicalPosition, LogicalSize, Monitor};
use uuid::Uuid;
use xcap::Window;

#[cfg(target_os = "macos")]
use crate::recording_sources::commands::WindowMetadata;
use crate::{constants::Events, APP_HANDLE};

use super::commands::WindowDetails;

/// Return data for visible windows.
///
/// Icons and preview thumbnails are saved under `{app_temp_dir}/window-selector`.
/// If no dir provided no thumbnails will be generated. Emits `WindowThumbnailsGenerated`.
#[cfg(target_os = "macos")] // TODO generalize for windows
pub fn get_visible_windows(monitors: Vec<Monitor>, app_temp_dir: Option<PathBuf>) {
  let targets = Arc::new(get_all_targets());
  let available_windows_for_thumbnail = Arc::new(xcap::Window::all().unwrap());
  let mut window_detail_tasks = Vec::new();

  let window_selector_folder = if let Some(app_temp_dir) = app_temp_dir {
    let dir = app_temp_dir.join("window-selector");
    let _ = std::fs::create_dir_all(&dir);
    let _ = clear_folder_contents(&dir);
    Some(dir)
  } else {
    None
  };

  let windows_detail_results = Arc::new(Mutex::new(Vec::new()));

  let os_windows = get_os_visible_windows(&monitors);
  for window in os_windows {
    let window_pid = window.pid;
    let window_id = window.id;

    let target_id = match targets.iter().find_map(|t| match t {
      Target::Window(window_target) if window_target.title == window.title => {
        Some(window_target.id)
      }
      _ => None,
    }) {
      Some(target_id) => target_id,
      None => continue,
    };

    let available_windows_for_thumbnail = available_windows_for_thumbnail.clone();
    let window_selector_folder = window_selector_folder.clone();
    let windows_detail_results_for_task = windows_detail_results.clone();
    window_detail_tasks.push(tauri::async_runtime::spawn_blocking(move || {
      let mut app_icon_path: Option<PathBuf> = None;
      let mut thumbnail_path: Option<PathBuf> = None;

      if let Some(folder) = &window_selector_folder {
        thumbnail_path = Some(generate_unique_path(folder));
        if let Some(thumbnail_path) = &thumbnail_path {
          create_and_save_thumbnail(thumbnail_path, window_id, available_windows_for_thumbnail);
        }

        if let Some(pid) = window_pid {
          app_icon_path = get_app_icon(folder.clone(), pid);
        }
      }

      let mut details = WindowDetails::from_metadata(window, app_icon_path, thumbnail_path);
      details.id = target_id;
      windows_detail_results_for_task.lock().push(details);
    }));
  }

  let app_handle = APP_HANDLE.get().unwrap().clone();
  if !window_detail_tasks.is_empty() {
    tauri::async_runtime::spawn(async move {
      join_all(window_detail_tasks).await;
      let mut details = windows_detail_results.lock().clone();
      details.sort_by_key(|w| (w.app_icon_path.clone(), w.title.clone()));
      app_handle
        .emit(Events::WindowThumbnailsGenerated.as_ref(), details)
        .ok();
    });
  } else {
    let mut details = windows_detail_results.lock().clone();
    details.sort_by_key(|w| (w.app_icon_path.clone(), w.title.clone()));
    app_handle
      .emit(Events::WindowThumbnailsGenerated.as_ref(), details)
      .ok();
  }

  // windows_details
}

#[cfg(target_os = "macos")]
#[link(name = "AppKit", kind = "framework")]
extern "C" {
  pub fn NSIntersectionRect(a: cidre::ns::Rect, b: cidre::ns::Rect) -> cidre::ns::Rect;
}

/// Estimates the display based on intersection size
///
/// Many edge cases not managed, down to the user to properly position their
/// windows.
#[cfg(target_os = "macos")]
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

/// Fetch app icon, save to file, and return path
#[cfg(target_os = "macos")]
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
    let file_path = dir_path.join(format!("{bundle_id}.png"));
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

    if let Err(e) = File::create(&file_path).and_then(|mut f| f.write_all(slice)) {
      eprintln!("Failed to write PNG file: {e}");
      return None;
    }

    Some(file_path)
  }
}

#[cfg(target_os = "macos")]
pub fn get_os_visible_windows(monitors: &[Monitor]) -> Vec<WindowMetadata> {
  let mut visible_windows = Vec::new();

  // no sync method for current, this is the correct approach - https://github.com/yury/cidre/discussions/26
  let (tx, rx) = std::sync::mpsc::channel();
  sc::ShareableContent::current_with_ch(move |res, _err| {
    tx.send(res.unwrap().retained()).unwrap();
  });

  let content = rx.recv().unwrap();
  let displays = content.displays();
  let windows = content.windows();

  for window in windows.iter() {
    if let Some(title) = window.title() {
      if title.is_empty() || window.window_layer() != 0 || !window.is_on_screen() {
        continue;
      }

      let frame = window.frame();
      let display_index = get_window_display(&displays, frame);
      let scale_factor = monitors[display_index].scale_factor();

      visible_windows.push(WindowMetadata {
        id: window.id(),
        title: title.to_string(),
        size: LogicalSize::new(frame.size.width, frame.size.height),
        position: LogicalPosition::new(frame.origin.x, frame.origin.y),
        scale_factor,
        pid: Some(window.owning_app().unwrap().process_id()),
      });
    }
  }

  visible_windows
}

// TODO
#[cfg(target_os = "windows")]
fn get_os_visible_windows() -> Vec<WindowDetails> {}
#[cfg(target_os = "windows")]
pub fn get_visible_windows(
  _monitors: Vec<Monitor>,
  app_temp_dir: Option<PathBuf>,
) -> Vec<WindowDetails> {
  use windows::Win32::Graphics::Dwm::DwmGetWindowAttribute;
  use windows::Win32::UI::WindowsAndMessaging::{GetWindowRect, IsIconic, IsWindowVisible};

  let targets = Arc::new(get_all_targets());
  let windows_for_thumbnail_arc = Arc::new(Window::all().unwrap());

  let window_selector_folder = if let Some(app_temp_dir) = app_temp_dir {
    let dir = app_temp_dir.join("window-selector");
    let _ = std::fs::create_dir_all(&dir);
    let _ = clear_folder_contents(&dir);
    Some(dir)
  } else {
    None
  };

  let mut all_windows = Vec::new();
  let mut thumbnail_tasks = Vec::new();
  for target in targets.iter() {
    match target {
      Target::Window(window) => {
        if window.title.trim().is_empty() {
          continue;
        }

        let hwnd = window.raw_handle.get_handle();
        if unsafe { IsWindowVisible(hwnd).as_bool() } && !unsafe { IsIconic(hwnd).as_bool() } {
          // Exclude cloaked windows

          use windows::Win32::Foundation::RECT;
          let mut cloaked: u32 = 0;
          let result = unsafe {
            use windows::Win32::Graphics::Dwm::DWMWA_CLOAKED;

            DwmGetWindowAttribute(
              hwnd,
              DWMWA_CLOAKED,
              &mut cloaked as *mut _ as *mut _,
              std::mem::size_of::<u32>() as u32,
            )
          };

          if result.is_ok() && cloaked != 0 {
            continue;
          }

          let mut rect = RECT::default();
          if unsafe { GetWindowRect(hwnd, &mut rect) }.is_ok() {
            let window_id = window.id;
            let window_selector_folder = window_selector_folder.clone();

            let windows_for_thumbnail = Arc::clone(&windows_for_thumbnail_arc);

            let mut app_icon_path: Option<PathBuf> = None;
            let mut thumbnail_path: Option<PathBuf> = None;

            if let Some(thumbnail_folder) = window_selector_folder.clone() {
              let mut pid = 0;
              unsafe {
                use windows::Win32::UI::WindowsAndMessaging::GetWindowThreadProcessId;
                GetWindowThreadProcessId(hwnd, Some(&mut pid));
              };
              app_icon_path = get_app_icon(thumbnail_folder.clone(), pid as i32);

              let path = generate_thumbnail_path(thumbnail_folder);
              thumbnail_path = Some(path.clone());

              let thumbnail_task = tauri::async_runtime::spawn_blocking(move || {
                create_and_save_thumbnail(path, window_id, windows_for_thumbnail);
              });

              thumbnail_tasks.push(thumbnail_task);
            }

            all_windows.push(WindowDetails {
              id: window.id,
              title: window.title.clone(),
              app_icon_path,
              thumbnail_path,
              size: LogicalSize {
                width: (rect.right - rect.left) as f64,
                height: (rect.bottom - rect.top) as f64,
              },
              position: LogicalPosition {
                x: rect.left as f64,
                y: rect.top as f64,
              },
              scale_factor: 1.0, // TODO
            });
          }
        }
      }
      Target::Display(_) => continue,
    }
  }

  let app_handle = APP_HANDLE.get().unwrap();
  if !thumbnail_tasks.is_empty() {
    tauri::async_runtime::spawn(async move {
      join_all(thumbnail_tasks).await;
      let _ = app_handle.emit(Events::WindowThumbnailsGenerated.as_ref(), ());
    });
  } else {
    let _ = app_handle.emit(Events::WindowThumbnailsGenerated.as_ref(), ());
  }

  all_windows
}

// TODO
// #[cfg(target_os = "windows")]
// fn get_window_display() -> usize

/// Fetch app icon, save to file, and return path
#[cfg(target_os = "windows")]
fn get_app_icon(dir_path: PathBuf, pid: i32) -> Option<PathBuf> {
  unsafe {
    use std::{
      ffi::OsStr,
      os::{raw::c_void, windows::ffi::OsStrExt},
    };

    use image::{ImageBuffer, Rgba};
    use windows::{
      core::PCWSTR,
      Win32::{
        Foundation::CloseHandle,
        Graphics::Gdi::{
          CreateCompatibleDC, DeleteDC, DeleteObject, GetDIBits, GetObjectW, BITMAP, BITMAPINFO,
          BITMAPINFOHEADER, BI_RGB, DIB_RGB_COLORS,
        },
        System::{
          ProcessStatus::K32GetModuleFileNameExW,
          Threading::{OpenProcess, PROCESS_QUERY_INFORMATION, PROCESS_VM_READ},
        },
        UI::{
          Shell::ExtractIconExW,
          WindowsAndMessaging::{DestroyIcon, GetIconInfo, HICON, ICONINFO},
        },
      },
    };

    // Get exe path
    let process_handle = match OpenProcess(
      PROCESS_QUERY_INFORMATION | PROCESS_VM_READ,
      false,
      pid as u32,
    ) {
      Ok(process_handle) => process_handle,
      Err(_) => {
        return None;
      }
    };

    let mut buffer: [u16; 260] = [0; 260];
    let len = K32GetModuleFileNameExW(process_handle, None, &mut buffer);
    let _ = CloseHandle(process_handle);

    if len == 0 {
      return None;
    }

    let exe_path = PathBuf::from(OsString::from_wide(&buffer[..len as usize]));
    let exe_name = exe_path.as_path().file_stem().unwrap();
    let file_name = format!("{}.png", exe_name.to_string_lossy());
    let file_path = dir_path.join(file_name);

    // Extract icon from exe
    let exe_wide: Vec<u16> = OsStr::new(&exe_path)
      .encode_wide()
      .chain(std::iter::once(0))
      .collect();

    let mut large_icon = HICON::default();
    let icons_extracted = ExtractIconExW(
      PCWSTR::from_raw(exe_wide.as_ptr()),
      0,                     // icon index
      Some(&mut large_icon), // destination
      Some(std::ptr::null_mut()),
      1, // extract icon
    );

    if icons_extracted == 0 || large_icon.0 as usize == 0 {
      return None;
    }

    // Get icon color + mask bitmaps
    let mut icon_info = ICONINFO::default();
    if GetIconInfo(large_icon, &mut icon_info).is_err() {
      return None;
    }

    let hdc = CreateCompatibleDC(None);
    if hdc.0 as usize == 0 {
      return None;
    }

    // Bitmap info
    let mut bmp: BITMAP = std::mem::zeroed();
    let size = std::mem::size_of::<BITMAP>() as i32;
    if GetObjectW(icon_info.hbmColor, size, Some(&mut bmp as *mut _ as *mut _)) == 0 {
      return None;
    }

    // Bitmap to pixels
    let mut bmi = BITMAPINFO {
      bmiHeader: BITMAPINFOHEADER {
        biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
        biWidth: bmp.bmWidth,
        biHeight: -bmp.bmHeight,
        biPlanes: 1,
        biBitCount: 32, // 32-bit color depth
        biCompression: BI_RGB.0,
        biSizeImage: 0,
        biXPelsPerMeter: 0,
        biYPelsPerMeter: 0,
        biClrUsed: 0,
        biClrImportant: 0,
      },
      bmiColors: [Default::default(); 1],
    };

    let mut pixels = vec![0u8; (bmp.bmWidth * bmp.bmHeight * 4) as usize];

    let scan_lines = GetDIBits(
      hdc,
      icon_info.hbmColor,
      0,
      bmp.bmHeight as u32,
      Some(pixels.as_mut_ptr() as *mut c_void),
      &mut bmi,
      DIB_RGB_COLORS,
    );

    if scan_lines == 0 {
      return None;
    }

    // Clean up
    let _ = DeleteObject(icon_info.hbmColor);
    let _ = DeleteObject(icon_info.hbmMask);
    let _ = DestroyIcon(large_icon);
    let _ = DeleteDC(hdc);

    // Convert BGRA -> RGBA
    for i in 0..(bmp.bmWidth * bmp.bmHeight) as usize {
      pixels.swap(i * 4, i * 4 + 2);
    }

    if let Some(img) =
      ImageBuffer::<Rgba<u8>, _>::from_raw(bmp.bmWidth as u32, bmp.bmHeight as u32, pixels)
    {
      let _ = img.save(file_path.clone());
      Some(file_path)
    } else {
      None
    }
  }
}

pub fn generate_unique_path(dir_path: &Path) -> PathBuf {
  let uuid = Uuid::new_v4();
  dir_path.join(format!("{uuid}.png"))
}

/// Save screenshot of app with `app_pid`
fn create_and_save_thumbnail(
  thumbnail_path: &PathBuf,
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
    let _ = resized.save(thumbnail_path);
  }
}

#[cfg(target_os = "macos")]
/// Return monitor names - assumes order is the same as tauri `.available_monitors`
pub fn get_monitor_names() -> Vec<String> {
  let low_level_screens = cidre::ns::Screen::screens();

  low_level_screens
    .iter()
    .map(|screen| screen.localized_name().to_string())
    .collect()
}

#[cfg(target_os = "windows")]
pub fn get_monitor_names() -> Vec<String> {
  use winreg::{enums::HKEY_LOCAL_MACHINE, RegKey};

  log::info!("Fetching monitors");

  let mut monitor_names = Vec::new();
  let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);

  if let Ok(display_key) = hklm.open_subkey("SYSTEM\\CurrentControlSet\\Enum\\DISPLAY") {
    // Manufacturer
    for manufacturer in display_key.enum_keys().flatten() {
      if let Ok(mfg_key) = display_key.open_subkey(&manufacturer) {
        // Devices
        for device in mfg_key.enum_keys().flatten() {
          if let Ok(device_key) = mfg_key.open_subkey(&device) {
            // Device keys
            for subkey_name in device_key.enum_keys().flatten() {
              if subkey_name == "Device Parameters" {
                if let Ok(params_key) = device_key.open_subkey(&subkey_name) {
                  // Keys in Device Parameters
                  for value_name in params_key.enum_values().flatten() {
                    // At EDID
                    if value_name.0 == "EDID" {
                      use std::io::Cursor;

                      let raw_edid_bytes = params_key
                        .get_raw_value("EDID")
                        .expect("Failed to read EDID")
                        .bytes;

                      let mut cursor = Cursor::new(raw_edid_bytes);
                      match edid_rs::parse(&mut cursor) {
                        Ok(edid) => {
                          // Iterate parsed EDID data searching for string data
                          let combined_name = edid
                            .descriptors
                            .0
                            .iter()
                            .filter_map(|descriptor| {
                              use edid_rs::MonitorDescriptor;

                              if let MonitorDescriptor::OtherString(s) = descriptor {
                                Some(s.trim())
                              } else {
                                None
                              }
                            })
                            .collect::<Vec<_>>()
                            .join(" ");

                          // Avoid duplicate entries, windows seems to have a registry
                          // entry per connection path, not display
                          if !monitor_names.contains(&combined_name) {
                            monitor_names.push(combined_name);
                          }
                        }
                        Err(e) => {
                          log::warn!("Failed to parse EDID: {e}");
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  monitor_names
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
