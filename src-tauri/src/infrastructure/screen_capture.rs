use crate::database::sqlite::Database;
use crate::domain::models::{ClipboardItem, ImageClipboardContent};
use arboard::{Clipboard, ImageData};
use base64::{engine::general_purpose, Engine as _};
use chrono::Utc;
use image::codecs::png::PngEncoder;
use image::{imageops::FilterType, ImageEncoder, RgbaImage};
use serde::Serialize;
use std::borrow::Cow;
use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Manager};
use uuid::Uuid;
use xcap::{Monitor, Window};

const SCREENSHOT_FALLBACK_PIXELS: u64 = 1_000_000;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CapturePreview {
    pub data_url: String,
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CaptureWindow {
    pub id: u32,
    pub title: String,
    pub app_name: String,
}

pub fn capture_primary_screen(
    app: &AppHandle,
    db: &Database,
    skipped_capture_image: &Arc<Mutex<Option<String>>>,
) -> Result<ClipboardItem, String> {
    persist_capture(app, db, skipped_capture_image, capture_primary_image()?)
}

pub fn capture_primary_image() -> Result<RgbaImage, String> {
    let monitor = Monitor::all()
        .map_err(|error| error.to_string())?
        .into_iter()
        .find(|monitor| monitor.is_primary().unwrap_or(false))
        .ok_or_else(|| "No se encontró una pantalla disponible".to_string())?;
    monitor.capture_image().map_err(|error| error.to_string())
}

pub fn preview(image: &RgbaImage) -> Result<CapturePreview, String> {
    Ok(CapturePreview {
        data_url: format!(
            "data:image/png;base64,{}",
            general_purpose::STANDARD.encode(encode_png(image)?)
        ),
        width: image.width(),
        height: image.height(),
    })
}

pub fn list_windows() -> Result<Vec<CaptureWindow>, String> {
    let windows = Window::all()
        .map_err(|error| error.to_string())?
        .into_iter()
        .filter_map(|window| {
            let title = window.title().ok()?.trim().to_string();
            if title.is_empty() || window.is_minimized().ok()? {
                return None;
            }
            Some(CaptureWindow {
                id: window.id().ok()?,
                title,
                app_name: window.app_name().unwrap_or_default(),
            })
        })
        .take(40)
        .collect::<Vec<_>>();
    Ok(windows)
}

pub fn capture_window(id: u32) -> Result<RgbaImage, String> {
    let window = Window::all()
        .map_err(|error| error.to_string())?
        .into_iter()
        .find(|window| window.id().ok() == Some(id))
        .ok_or_else(|| "La ventana ya no estÃ¡ disponible".to_string())?;
    window.capture_image().map_err(|error| error.to_string())
}

pub fn crop(
    image: &RgbaImage,
    x: u32,
    y: u32,
    width: u32,
    height: u32,
) -> Result<RgbaImage, String> {
    if width == 0 || height == 0 || x >= image.width() || y >= image.height() {
        return Err("Selecciona un Ã¡rea vÃ¡lida".into());
    }
    let width = width.min(image.width() - x);
    let height = height.min(image.height() - y);
    Ok(image::imageops::crop_imm(image, x, y, width, height).to_image())
}

pub fn color_at(image: &RgbaImage, x: u32, y: u32) -> Result<String, String> {
    if x >= image.width() || y >= image.height() {
        return Err("El color seleccionado estÃ¡ fuera de la pantalla".into());
    }
    let pixel = image.get_pixel(x, y).0;
    Ok(format!("#{:02X}{:02X}{:02X}", pixel[0], pixel[1], pixel[2]))
}

pub fn screenshot_directory(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app
        .path()
        .picture_dir()
        .map_err(|error| error.to_string())?
        .join("Clipboard Pro Screenshots"))
}

pub fn persist_capture(
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
    let thumbnail = thumbnail(&image)?;
    let fallback = storage_fallback(&image)?;
    let content = serde_json::to_string(&ImageClipboardContent {
        width: image.width() as usize,
        height: image.height() as usize,
        png_base64: Some(general_purpose::STANDARD.encode(fallback)),
        rgba_base64: None,
        file_path: Some(file_path.display().to_string()),
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

fn storage_fallback(image: &RgbaImage) -> Result<Vec<u8>, String> {
    let pixel_count = u64::from(image.width()) * u64::from(image.height());
    let image = if pixel_count > SCREENSHOT_FALLBACK_PIXELS {
        let scale = (SCREENSHOT_FALLBACK_PIXELS as f64 / pixel_count as f64).sqrt();
        let width = ((image.width() as f64 * scale).round() as u32).max(1);
        let height = ((image.height() as f64 * scale).round() as u32).max(1);
        image::DynamicImage::ImageRgba8(image.clone())
            .resize(width, height, FilterType::Triangle)
            .to_rgba8()
    } else {
        image.clone()
    };
    encode_png(&image)
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
