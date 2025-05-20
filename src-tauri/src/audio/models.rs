use serde::{ Deserialize, Serialize };
use strum_macros::Display;

#[derive(Debug, Clone, Serialize, Deserialize, Display, PartialEq, Eq, Hash)]
#[serde(rename_all = "lowercase")]
#[strum(serialize_all = "lowercase")]
pub enum AudioStream {
  System,
}
