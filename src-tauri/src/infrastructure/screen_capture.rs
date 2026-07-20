use crate::database::sqlite::Database;
use crate::domain::models::{ClipboardItem, ImageClipboardContent};
use arboard::{Clipboard, ImageData};
use base64::{engine::general_purpose, Engine as _};
use chrono::Utc;
use image::codecs::png::PngEncoder;
use image::{imageops::FilterType, ImageEncoder, RgbaImage};
use std::borrow::Cow;
use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Manager};
use uuid::Uuid;
use xcap::Monitor;

pub fn capture_primary_screen(
    app: &AppHandle,
    db: &Database,
    skipped_capture_image: &Arc<Mutex<Option<String>>>,
) -> Result<ClipboardItem, String> {
    let monitor = Monitor::all()
        .map_err(|error| error.to_string())?
        .into_iter()
        .find(|monitor| monitor.is_primary().unwrap_or(false))
        .ok_or_else(|| "No se encontró una pantalla disponible".to_string())?;
    persist_capture(
        app,
        db,
        skipped_capture_image,
        monitor.capture_image().map_err(|error| error.to_string())?,
    )
}

pub fn screenshot_directory(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app
        .path()
        .picture_dir()
        .map_err(|error| error.to_string())?
        .join("Clipboard Pro Screenshots"))
}

fn persist_capture(
    app: &AppHandle,
    db: &Database,
    skipped_capture_image: &Arc<Mutex<Option<String>>>,
    image: RgbaImage,
) -> Result<ClipboardItem, String> {
    let directory = screenshot_directory(app)?;
    fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
    let file_path = directory.join(format!(
        "Clipboard Pro {} {}.png",
        Utc::now().format("%Y-%m-%d %H-%M-%S"),
        Uuid::new_v4()
    ));
    image.save(&file_path).map_err(|error| error.to_string())?;
    let png = encode_png(&image)?;
    let thumbnail = thumbnail(&image)?;
    let content = serde_json::to_string(&ImageClipboardContent {
        width: image.width() as usize,
        height: image.height() as usize,
        png_base64: Some(general_purpose::STANDARD.encode(&png)),
        rgba_base64: None,
    })
    .map_err(|error| error.to_string())?;
    let fingerprint = super::clipboard_monitor::image_fingerprint(
        image.width() as usize,
        image.height() as usize,
        image.as_raw(),
    );
    *skipped_capture_image
        .lock()
        .map_err(|error| error.to_string())? = Some(fingerprint);
    if let Err(error) = Clipboard::new()
        .map_err(|error| error.to_string())?
        .set_image(ImageData {
            width: image.width() as usize,
            height: image.height() as usize,
            bytes: Cow::Owned(image.clone().into_raw()),
        })
    {
        let _ = skipped_capture_image
            .lock()
            .map(|mut skipped| skipped.take());
        return Err(error.to_string());
    }
    db.create_typed_item(
        "image",
        &content,
        &format!("Captura de pantalla · {}", file_path.display()),
        Some(&thumbnail),
    )
}

fn encode_png(image: &RgbaImage) -> Result<Vec<u8>, String> {
    let mut png = Vec::new();
    PngEncoder::new(&mut png)
        .write_image(
            image.as_raw(),
            image.width(),
            image.height(),
            image::ExtendedColorType::Rgba8,
        )
        .map_err(|error| error.to_string())?;
    Ok(png)
}

fn thumbnail(image: &RgbaImage) -> Result<String, String> {
    let image = image::DynamicImage::ImageRgba8(image.clone())
        .resize(96, 96, FilterType::Triangle)
        .to_rgba8();
    Ok(format!(
        "data:image/png;base64,{}",
        general_purpose::STANDARD.encode(encode_png(&image)?)
    ))
}
