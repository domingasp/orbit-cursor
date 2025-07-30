use std::{
  fs::OpenOptions,
  path::PathBuf,
  thread::JoinHandle,
  time::{Duration, Instant, SystemTime},
};

use rdev::EventType;
use serde::Serialize;

use crate::recording::models::StreamSync;

#[derive(Debug, Serialize)]
pub enum MouseEventRecord {
  Move {
    elapsed_ms: u128,
    x: f64,
    y: f64,
  },
  Down {
    elapsed_ms: u128,
    button: rdev::Button,
  },
  Up {
    elapsed_ms: u128,
    button: rdev::Button,
  },
}

/// Create and start mouse event recording thread
///
/// A single file, `mouse_events.msgpack`, is generated containing mouse events
/// (move, button down, button up).
pub fn start_mouse_event_recorder(
  file_path: PathBuf,
  synchronization: StreamSync,
  mut input_event_rx: tokio::sync::broadcast::Receiver<rdev::Event>,
) -> JoinHandle<()> {
  let mut mouse_events_file = OpenOptions::new()
    .create(true)
    .append(true)
    .open(file_path)
    .expect("Failed to open mouse position message pack file");

  std::thread::spawn(move || {
    let log_prefix = "[input events]";
    log::info!("{log_prefix} Started input event recorder");

    let movement_throttle = Duration::from_micros(16_667); // ~60 FPS
    let start_time = SystemTime::now();
    let mut last_recorded_move = Instant::now() - movement_throttle;

    let mut stop_rx = synchronization.stop_tx.subscribe();
    loop {
      if stop_rx.try_recv().is_ok() {
        log::info!("{log_prefix} Input event recorder received stop message, finishing writing");
        break;
      }

      match input_event_rx.blocking_recv() {
        Ok(event) => {
          if !synchronization
            .should_write
            .load(std::sync::atomic::Ordering::SeqCst)
          {
            continue;
          }

          let elapsed_ms = SystemTime::now()
            .duration_since(start_time)
            .unwrap_or_default()
            .as_millis();

          let mouse_event_option = match event.event_type {
            EventType::MouseMove { x, y } => {
              if last_recorded_move.elapsed() >= movement_throttle {
                last_recorded_move = Instant::now();
                Some(MouseEventRecord::Move { elapsed_ms, x, y })
              } else {
                None
              }
            }
            EventType::ButtonPress(button) => Some(MouseEventRecord::Down { elapsed_ms, button }),
            EventType::ButtonRelease(button) => Some(MouseEventRecord::Up { elapsed_ms, button }),
            _ => None,
          };

          if let Some(mouse_event) = mouse_event_option {
            if let Err(e) = rmp_serde::encode::write(&mut mouse_events_file, &mouse_event) {
              eprintln!("Failed to write mouse event: {e}");
            }
          }
        }
        Err(e) => {
          eprintln!("Failed to receive input event: {e}");
        }
      }
    }
  })
}
