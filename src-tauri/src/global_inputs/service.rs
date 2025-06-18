use rdev::Event;
use tokio::sync::broadcast;

pub fn global_input_event_handler(event: Event, tx: broadcast::Sender<Event>) {
  let _ = tx.send(event.clone());
}
