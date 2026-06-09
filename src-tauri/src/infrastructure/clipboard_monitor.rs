use crate::database::sqlite::Database;
use crate::domain::models::ImageClipboardContent;
use arboard::Clipboard;
use base64::{engine::general_purpose, Engine as _};
use image::codecs::png::PngEncoder;
use image::{imageops::FilterType, DynamicImage, ImageBuffer, ImageEncoder, Rgba};
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
                            if let Ok((content, thumbnail)) =
                                encode_image_item(image.width, image.height, image.bytes.as_ref())
                            {
                                let _ = db.create_typed_item(
                                    "image",
                                    &content,
                                    &format!("Imagen copiada · {}×{} px", image.width, image.height),
                                    Some(&thumbnail),
                                );
                            }
                            let _ = app.emit(CLIPBOARD_CHANGED_EVENT, ());
                            last_image_seen = fingerprint;
                        }
                    }
                }

                thread::sleep(POLL_INTERVAL);
            }
        });
}

fn encode_image_item(width: usize, height: usize, rgba: &[u8]) -> Result<(String, String), String> {
    let content = ImageClipboardContent {
        width,
        height,
        rgba_base64: general_purpose::STANDARD.encode(rgba),
    };
    let thumbnail = create_thumbnail_data_url(width, height, rgba)?;
    let content = serde_json::to_string(&content).map_err(|error| error.to_string())?;
    Ok((content, thumbnail))
}

fn create_thumbnail_data_url(width: usize, height: usize, rgba: &[u8]) -> Result<String, String> {
    let image = ImageBuffer::<Rgba<u8>, _>::from_raw(width as u32, height as u32, rgba.to_vec())
        .ok_or_else(|| "Invalid clipboard image buffer".to_string())?;
    let thumbnail = DynamicImage::ImageRgba8(image).resize(96, 96, FilterType::Triangle);
    let rgba = thumbnail.to_rgba8();
    let mut png = Vec::new();

    PngEncoder::new(&mut png)
        .write_image(
            rgba.as_raw(),
            rgba.width(),
            rgba.height(),
            image::ExtendedColorType::Rgba8,
        )
        .map_err(|error| error.to_string())?;

    Ok(format!(
        "data:image/png;base64,{}",
        general_purpose::STANDARD.encode(png)
    ))
}
