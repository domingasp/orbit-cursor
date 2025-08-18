use std::{
  fs::{self},
  io::{self},
  path::{Path, PathBuf},
  sync::Arc,
};

use parking_lot::Mutex;
#[cfg(target_os = "windows")]
use windows::Win32::Foundation::HWND;

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
use tauri::{Emitter, LogicalPosition, LogicalSize};
use uuid::Uuid;
use xcap::Window;

use crate::recording_sources::commands::WindowMetadata;
use crate::{constants::Events, APP_HANDLE};
#[cfg(target_os = "macos")]
use tauri::Monitor;

use super::commands::WindowDetails;

/// Return data for visible windows.
///
/// Icons and preview thumbnails are saved under `{app_temp_dir}/window-selector`.
/// If no dir provided no thumbnails will be generated. Emits `WindowThumbnailsGenerated`
/// with window data.
pub fn get_visible_windows(
  #[cfg(target_os = "macos")] monitors: Vec<Monitor>,
  app_temp_dir: Option<PathBuf>,
) {
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

  #[cfg(target_os = "macos")]
  let os_windows = get_os_visible_windows(&monitors);
  #[cfg(target_os = "windows")]
  let os_windows = get_os_visible_windows();

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

        app_icon_path = get_app_icon(folder.clone(), window_pid);
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
        pid: window.owning_app().unwrap().process_id(),
      });
    }
  }

  visible_windows
}

#[cfg(target_os = "windows")]
pub fn get_os_visible_windows() -> Vec<WindowMetadata> {
  use windows::Win32::Foundation::RECT;
  use windows::Win32::Graphics::Dwm::{DwmGetWindowAttribute, DWMWA_CLOAKED};
  use windows::Win32::UI::WindowsAndMessaging::{
    GetWindowRect, GetWindowThreadProcessId, IsIconic, IsWindowVisible,
  };

  let mut visible_windows = Vec::new();
  let targets = get_all_targets();

  for target in targets {
    match target {
      Target::Window(window) => {
        if window.title.is_empty() {
          continue;
        }

        let hwnd = window.raw_handle.get_handle();
        if unsafe { !IsWindowVisible(hwnd).as_bool() } || unsafe { IsIconic(hwnd).as_bool() } {
          continue;
        }

        let mut cloaked: u32 = 0;
        if unsafe {
          DwmGetWindowAttribute(
            hwnd,
            DWMWA_CLOAKED,
            &mut cloaked as *mut _ as *mut _,
            std::mem::size_of::<u32>() as u32,
          )
        }
        .is_err()
        {
          continue;
        }

        if cloaked != 0 {
          continue;
        }

        let mut rect = RECT::default();
        if unsafe { GetWindowRect(hwnd, &mut rect) }.is_err() {
          continue;
        }

        let mut pid = 0;
        unsafe {
          GetWindowThreadProcessId(hwnd, Some(&mut pid));
        };

        visible_windows.push(WindowMetadata {
          id: window.id,
          title: window.title.clone(),
          size: LogicalSize {
            width: (rect.right - rect.left) as f64,
            height: (rect.bottom - rect.top) as f64,
          },
          position: LogicalPosition {
            x: rect.left as f64,
            y: rect.top as f64,
          },
          scale_factor: get_window_display_scale_factor(hwnd),
          pid: pid as i32,
        });
      }
      Target::Display(_) => continue,
    };
  }

  visible_windows
}

#[cfg(target_os = "windows")]
fn get_window_display_scale_factor(hwnd: HWND) -> f64 {
  use windows::Win32::Graphics::Gdi::MonitorFromWindow;

  unsafe {
    use windows::Win32::{
      Graphics::Gdi::MONITOR_DEFAULTTONEAREST,
      UI::HiDpi::{GetDpiForMonitor, MDT_EFFECTIVE_DPI},
    };

    let monitor = MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST);
    if monitor.0 as i32 == 0 {
      return 1.0;
    }

    let mut dpi_x = 0;
    let mut dpi_y = 0;
    if GetDpiForMonitor(monitor, MDT_EFFECTIVE_DPI, &mut dpi_x, &mut dpi_y).is_err() {
      return 1.0;
    }

    dpi_x as f64 / 96.0 // DPI scale 96 = 100%
  }
}

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

    let mut icon = HICON::default();
    let icons_extracted = ExtractIconExW(
      PCWSTR::from_raw(exe_wide.as_ptr()),
      0,               // icon index
      Some(&mut icon), // destination
      Some(std::ptr::null_mut()),
      1, // extract icon
    );

    if icons_extracted == 0 || icon.0 as usize == 0 {
      return None;
    }

    // Get icon color + mask bitmaps
    let mut icon_info = ICONINFO::default();
    if GetIconInfo(icon, &mut icon_info).is_err() {
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
    let _ = DestroyIcon(icon);
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
    if let Ok(thumbnail) = window_for_thumbnail.capture_image() {
      let (width, height) = thumbnail.dimensions();

      let dyn_image = DynamicImage::ImageRgba8(thumbnail);
      let resized = dyn_image.resize(width / 5, height / 5, image::imageops::FilterType::Nearest);
      let _ = resized.save(thumbnail_path);
    }
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

#[cfg(target_os = "windows")]
pub fn find_window_by_pid_and_title(
  pid: i32,
  title: &str,
) -> Option<(windows::Win32::Foundation::HWND, String, f64)> {
  use rapidfuzz::fuzz::ratio;
  use scap::{get_all_targets, Target};
  use windows::Win32::Foundation::HWND;
  use windows::Win32::UI::WindowsAndMessaging::GetWindowThreadProcessId;

  let mut best_hwnd: Option<HWND> = None;
  let mut best_score: f64 = -1.0;
  let mut best_title: Option<String> = None;

  for target in get_all_targets() {
    if let Target::Window(win) = target {
      let hwnd = win.raw_handle.get_handle();

      let mut window_pid: u32 = 0;
      unsafe { GetWindowThreadProcessId(hwnd, Some(&mut window_pid)) };
      if window_pid as i32 != pid {
        continue;
      }

      if win.title.is_empty() {
        continue;
      }

      let score = ratio(win.title.chars(), title.chars());
      if score > best_score {
        best_score = score;
        best_hwnd = Some(hwnd);
        best_title = Some(win.title);
      }
    }
  }

  best_hwnd.map(|hwnd| (hwnd, best_title.unwrap_or_default(), best_score))
}

#[cfg(target_os = "macos")]
pub fn find_ax_window_by_pid_and_title(pid: i32, title: &str) -> Option<(usize, String, f64)> {
  use rapidfuzz::fuzz::ratio;

  let app = cidre::ax::UiElement::with_app_pid(pid);
  let app_windows = match app.children() {
    Ok(c) => c,
    Err(e) => {
      log::error!("Failed to get children for app with pid {pid}: {e}");
      return None;
    }
  };

  let mut best_idx: Option<usize> = None;
  let mut best_score: f64 = -1.0;
  let mut best_title: Option<String> = None;

  for (idx, app_window) in app_windows.iter().enumerate() {
    let role = app_window
      .role()
      .ok()
      .map(|r| r.to_string())
      .unwrap_or_else(|| "???".into());

    if role != "AXWindow" {
      continue;
    }

    let Ok(window_title) = app_window.attr_value(cidre::ax::attr::title()) else {
      continue;
    };

    let title_cf_string: cidre::arc::Retained<cidre::cf::String> =
      unsafe { cidre::cf::Type::retain(&window_title) };
    let current_title = title_cf_string.to_string();

    let score = ratio(current_title.chars(), title.chars());

    if score > best_score {
      best_score = score;
      best_idx = Some(idx);
      best_title = Some(current_title);
    }
  }

  best_idx.map(|idx| (idx, best_title.unwrap_or_default(), best_score))
}
