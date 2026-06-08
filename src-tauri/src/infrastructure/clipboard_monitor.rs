use crate::database::sqlite::Database;
use arboard::Clipboard;
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::{thread, time::Duration};
use tauri::{AppHandle, Emitter};

pub const CLIPBOARD_CHANGED_EVENT: &str = "clipboard-pro://items-changed";
const POLL_INTERVAL: Duration = Duration::from_millis(900);

pub fn spawn_clipboard_monitor(db: Database, app: AppHandle) {
    let _ = thread::Builder::new()
        .name("clipboard-pro-monitor".into())
        .spawn(move || {
            let mut last_seen = String::new();
            let mut last_image_seen = String::new();
            loop {
                if let Ok(mut clipboard) = Clipboard::new() {
                    if let Ok(text) = clipboard.get_text() {
                        let trimmed = text.trim();
                        if !trimmed.is_empty() && text != last_seen {
                            let _ = db.create_text_item(&text);
                            let _ = app.emit(CLIPBOARD_CHANGED_EVENT, ());
                            last_seen = text;
                        }
                    } else if let Ok(image) = clipboard.get_image() {
                        let mut hasher = DefaultHasher::new();
                        image.bytes.hash(&mut hasher);
                        let fingerprint = format!(
                            "image:{}x{}:{:x}",
                            image.width,
                            image.height,
                            hasher.finish()
                        );
                        if fingerprint != last_image_seen {
                            let _ = db.create_typed_item(
                                "image",
                                &fingerprint,
                                &format!("Imagen copiada · {}×{} px", image.width, image.height),
                            );
                            let _ = app.emit(CLIPBOARD_CHANGED_EVENT, ());
                            last_image_seen = fingerprint;
                        }
                    }
                }
                thread::sleep(POLL_INTERVAL);
            }
        });
}
