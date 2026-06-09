use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ClipboardKind {
    Text,
    Url,
    Image,
    Document,
}

impl ClipboardKind {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Text => "text",
            Self::Url => "url",
            Self::Image => "image",
            Self::Document => "document",
        }
    }
}

impl TryFrom<&str> for ClipboardKind {
    type Error = String;

    fn try_from(value: &str) -> Result<Self, Self::Error> {
        match value {
            "text" => Ok(Self::Text),
            "url" => Ok(Self::Url),
            "image" => Ok(Self::Image),
            "document" => Ok(Self::Document),
            unknown => Err(format!("Unsupported clipboard kind: {unknown}")),
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClipboardItem {
    pub id: String,
    pub title: Option<String>,
    pub content: String,
    pub preview: String,
    pub thumbnail: Option<String>,
    pub kind: ClipboardKind,
    pub is_pinned: bool,
    pub is_favorite: bool,
    pub created_at: String,
    pub updated_at: String,
    pub last_used_at: Option<String>,
    pub collections: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Collection {
    pub id: String,
    pub name: String,
    pub item_count: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub history_limit: i64,
    pub shortcut: String,
    pub theme: String,
    pub auto_start: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageClipboardContent {
    pub width: usize,
    pub height: usize,
    pub rgba_base64: String,
}
