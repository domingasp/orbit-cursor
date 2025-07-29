use std::{
  fs::OpenOptions,
  path::PathBuf,
  time::{Duration, Instant, SystemTime},
};

use rdev::EventType;
use serde::Serialize;

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

// TODO use

/// Create and start mouse event recording thread
///
/// A single file, `mouse_events.msgpack`, is generated containing mouse events
/// (move, button down, button up).
///
/// * `origin` - Recording origin, screens and windows have different origins.
pub fn spawn_mouse_event_recorder(
  file_path: PathBuf,
  mut input_event_rx: tokio::sync::broadcast::Receiver<rdev::Event>,
) {
  let mut mouse_events_file = OpenOptions::new()
    .create(true)
    .append(true)
    .open(file_path)
    .expect("Failed to open mouse position message pack file");

  std::thread::spawn(move || {
    let movement_throttle_ms = Duration::from_millis(16); // ~60 FPS
    let start_time = SystemTime::now();
    let mut last_recorded_move = Instant::now() - movement_throttle_ms;

    loop {
      // TODO add stop
      // TODO add synchronized writing start

      match input_event_rx.blocking_recv() {
        Ok(event) => {
          let elapsed_ms = SystemTime::now()
            .duration_since(start_time)
            .unwrap_or_default()
            .as_millis();

          let mouse_event_option = match event.event_type {
            EventType::MouseMove { x, y } => {
              if last_recorded_move.elapsed() >= movement_throttle_ms {
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
  });
}
