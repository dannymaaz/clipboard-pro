use crate::database::sqlite::Database;
use arboard::Clipboard;
use std::{thread, time::Duration};

const POLL_INTERVAL: Duration = Duration::from_millis(1200);

pub fn spawn_clipboard_monitor(db: Database) {
    let _ = thread::Builder::new()
        .name("clipboard-pro-monitor".into())
        .spawn(move || {
            let mut last_seen = String::new();
            loop {
                if let Ok(mut clipboard) = Clipboard::new() {
                    if let Ok(text) = clipboard.get_text() {
                        let trimmed = text.trim();
                        if !trimmed.is_empty() && text != last_seen {
                            let _ = db.create_text_item(&text);
                            last_seen = text;
                        }
                    }
                }
                thread::sleep(POLL_INTERVAL);
            }
        });
}
