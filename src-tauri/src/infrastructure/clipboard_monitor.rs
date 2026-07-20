use crate::database::sqlite::Database;
use crate::domain::models::ImageClipboardContent;
use arboard::Clipboard;
use base64::{engine::general_purpose, Engine as _};
use image::codecs::png::PngEncoder;
use image::{imageops::FilterType, DynamicImage, ImageBuffer, ImageEncoder, Rgba};
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex,
};
use std::{thread, time::Duration};
use tauri::{AppHandle, Emitter};

pub const CLIPBOARD_CHANGED_EVENT: &str = "clipboard-pro://items-changed";
const BASE_POLL_INTERVAL: Duration = Duration::from_millis(900);
const MAX_IMAGE_POLL_INTERVAL: Duration = Duration::from_secs(3);
const LARGE_IMAGE_BYTES: usize = 8 * 1024 * 1024;
const MAX_IMAGE_PIXELS: u64 = 6_000_000;

pub fn spawn_clipboard_monitor(
    db: Database,
    app: AppHandle,
    capture_enabled: Arc<AtomicBool>,
    skipped_capture_image: Arc<Mutex<Option<String>>>,
) {
    let _ = thread::Builder::new()
        .name("clipboard-pro-monitor".into())
        .spawn(move || {
            let mut last_seen = String::new();
            let mut last_image_seen = String::new();
            let mut poll_interval = BASE_POLL_INTERVAL;

            loop {
                if !capture_enabled.load(Ordering::Relaxed) {
                    thread::sleep(BASE_POLL_INTERVAL);
                    continue;
                }

                if let Ok(mut clipboard) = Clipboard::new() {
                    if let Ok(text) = clipboard.get_text() {
                        let trimmed = text.trim();
                        if !trimmed.is_empty() && text != last_seen {
                            let _ = db.create_text_item(&text);
                            let _ = app.emit(CLIPBOARD_CHANGED_EVENT, ());
                            last_seen = text;
                        }
                        poll_interval = BASE_POLL_INTERVAL;
                    } else if let Ok(image) = clipboard.get_image() {
                        let fingerprint =
                            image_fingerprint(image.width, image.height, image.bytes.as_ref());

                        if fingerprint != last_image_seen {
                            let should_skip = skipped_capture_image
                                .lock()
                                .ok()
                                .map(|mut skipped| {
                                    if skipped.as_deref() == Some(fingerprint.as_str()) {
                                        skipped.take();
                                        true
                                    } else {
                                        false
                                    }
                                })
                                .unwrap_or(false);
                            if !should_skip {
                                if let Ok((content, thumbnail)) = encode_image_item(
                                    image.width,
                                    image.height,
                                    image.bytes.as_ref(),
                                ) {
                                    let _ = db.create_typed_item(
                                        "image",
                                        &content,
                                        &format!(
                                            "Imagen copiada · {}×{} px",
                                            image.width, image.height
                                        ),
                                        Some(&thumbnail),
                                    );
                                }
                            }
                            let _ = app.emit(CLIPBOARD_CHANGED_EVENT, ());
                            last_image_seen = fingerprint;
                            poll_interval = BASE_POLL_INTERVAL;
                        } else if image.bytes.len() >= LARGE_IMAGE_BYTES {
                            poll_interval = (poll_interval * 2).min(MAX_IMAGE_POLL_INTERVAL);
                        } else {
                            poll_interval = BASE_POLL_INTERVAL;
                        }
                    }
                }

                thread::sleep(poll_interval);
            }
        });
}

pub fn image_fingerprint(width: usize, height: usize, rgba: &[u8]) -> String {
    let mut hasher = DefaultHasher::new();
    rgba.hash(&mut hasher);
    format!("image:{width}x{height}:{:x}", hasher.finish())
}

fn encode_image_item(width: usize, height: usize, rgba: &[u8]) -> Result<(String, String), String> {
    let image = ImageBuffer::<Rgba<u8>, _>::from_raw(width as u32, height as u32, rgba.to_vec())
        .ok_or_else(|| "Invalid clipboard image buffer".to_string())?;
    let image = resize_for_storage(DynamicImage::ImageRgba8(image));
    let width = image.width() as usize;
    let height = image.height() as usize;
    let png = encode_png(&image)?;
    let content = ImageClipboardContent {
        width,
        height,
        png_base64: Some(general_purpose::STANDARD.encode(png)),
        rgba_base64: None,
        file_path: None,
    };
    let thumbnail = create_thumbnail_data_url(&image)?;
    let content = serde_json::to_string(&content).map_err(|error| error.to_string())?;
    Ok((content, thumbnail))
}

fn resize_for_storage(image: DynamicImage) -> DynamicImage {
    let pixels = u64::from(image.width()) * u64::from(image.height());
    if pixels <= MAX_IMAGE_PIXELS {
        return image;
    }

    let scale = (MAX_IMAGE_PIXELS as f64 / pixels as f64).sqrt();
    image.resize(
        (f64::from(image.width()) * scale).round() as u32,
        (f64::from(image.height()) * scale).round() as u32,
        FilterType::Triangle,
    )
}

fn encode_png(image: &DynamicImage) -> Result<Vec<u8>, String> {
    let rgba = image.to_rgba8();
    let mut png = Vec::new();
    PngEncoder::new(&mut png)
        .write_image(
            rgba.as_raw(),
            rgba.width(),
            rgba.height(),
            image::ExtendedColorType::Rgba8,
        )
        .map_err(|error| error.to_string())?;
    Ok(png)
}

fn create_thumbnail_data_url(image: &DynamicImage) -> Result<String, String> {
    let thumbnail = image.resize(96, 96, FilterType::Triangle);
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
