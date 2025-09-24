use serde::{Deserialize, Serialize};

use crate::types::{FileMeta, PhotoSize};

/// This object represents a [video message] (available in Telegram apps as of
/// [v.4.0]).
///
/// [The official docs](https://core.telegram.org/bots/api#videonote).
///
/// [video message]: https://telegram.org/blog/video-messages-and-telescope
/// [v4.0]: https://telegram.org/blog/video-messages-and-telescope
#[serde_with_macros::skip_serializing_none]
#[derive(Clone, Debug, Eq, Hash, PartialEq, Serialize, Deserialize)]
pub struct VideoNote {
    /// Metadata of the video note file.
    #[serde(flatten)]
    pub file: FileMeta,

    /// Video width and height (diameter of the video message) as defined by
    /// sender.
    pub length: u32,

    /// Duration of the video in seconds as defined by sender.
    pub duration: u32,

    /// Video thumbnail.
    pub thumb: Option<PhotoSize>,
}
