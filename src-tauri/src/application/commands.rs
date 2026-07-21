use crate::domain::models::{
    AppSettings, ClipboardItem, ClipboardKind, Collection, ImageClipboardContent,
};
use crate::infrastructure::clipboard_monitor::CLIPBOARD_CHANGED_EVENT;
use crate::infrastructure::screen_capture;
use crate::{show_capture_tool, AppState, LifecycleState};
use arboard::{Clipboard, ImageData};
use base64::{engine::general_purpose, Engine as _};
use enigo::{Direction, Enigo, Key, Keyboard, Settings};
use image::ImageReader;
use std::borrow::Cow;
use std::io::Cursor;
use std::str::FromStr;
use std::sync::atomic::Ordering;
use std::{thread, time::Duration};
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut};

#[tauri::command]
pub fn list_items(state: State<'_, AppState>) -> Result<Vec<ClipboardItem>, String> {
    state.db.list_items()
}

#[tauri::command]
pub fn list_items_page(
    state: State<'_, AppState>,
    offset: i64,
    limit: i64,
) -> Result<Vec<ClipboardItem>, String> {
    state.db.list_items_page(offset, limit)
}

#[tauri::command]
pub fn search_items(
    state: State<'_, AppState>,
    query: String,
) -> Result<Vec<ClipboardItem>, String> {
    state.db.search_items(&query)
}

#[tauri::command]
pub fn create_text_item(
    state: State<'_, AppState>,
    content: String,
) -> Result<ClipboardItem, String> {
    state.db.create_text_item(&content)
}

#[tauri::command]
pub fn copy_item(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let item = state.db.fetch_item(&id)?;
    let mut clipboard = Clipboard::new().map_err(|error| error.to_string())?;

    match item.kind {
        ClipboardKind::Image => {
            let image: ImageClipboardContent =
                serde_json::from_str(&item.content).map_err(|error| error.to_string())?;
            let (width, height, bytes) = if let Some(file_path) = image.file_path {
                let decoded = ImageReader::open(file_path)
                    .map_err(|error| error.to_string())?
                    .decode()
                    .map_err(|error| error.to_string())?
                    .to_rgba8();
                (
                    decoded.width() as usize,
                    decoded.height() as usize,
                    decoded.into_raw(),
                )
            } else if let Some(png_base64) = image.png_base64 {
                let png = general_purpose::STANDARD
                    .decode(png_base64)
                    .map_err(|error| error.to_string())?;
                let decoded = ImageReader::new(Cursor::new(png))
                    .with_guessed_format()
                    .map_err(|error| error.to_string())?
                    .decode()
                    .map_err(|error| error.to_string())?
                    .to_rgba8();
                (
                    decoded.width() as usize,
                    decoded.height() as usize,
                    decoded.into_raw(),
                )
            } else {
                let bytes = general_purpose::STANDARD
                    .decode(
                        image
                            .rgba_base64
                            .ok_or_else(|| "Invalid image clipboard item".to_string())?,
                    )
                    .map_err(|error| error.to_string())?;
                (image.width, image.height, bytes)
            };
            clipboard
                .set_image(ImageData {
                    width,
                    height,
                    bytes: Cow::Owned(bytes),
                })
                .map_err(|error| error.to_string())?;
        }
        _ => {
            clipboard
                .set_text(item.content)
                .map_err(|error| error.to_string())?;
        }
    }

    state.db.mark_used(&id)
}

#[tauri::command]
pub fn paste_item(app: AppHandle, state: State<'_, AppState>, id: String) -> Result<(), String> {
    copy_item(state, id)?;
    app.emit(CLIPBOARD_CHANGED_EVENT, ())
        .map_err(|error| error.to_string())?;

    if let Some(window) = app.get_webview_window("main") {
        window.close().map_err(|error| error.to_string())?;
    }

    thread::spawn(|| {
        thread::sleep(Duration::from_millis(120));
        let _ = paste_hotkey();
    });

    Ok(())
}

#[tauri::command]
pub fn hide_window(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window.close().map_err(|error| error.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn minimize_window(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window.minimize().map_err(|error| error.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn toggle_maximize_window(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        if window.is_maximized().map_err(|error| error.to_string())? {
            window.unmaximize().map_err(|error| error.to_string())?;
        } else {
            window.maximize().map_err(|error| error.to_string())?;
        }
    }
    Ok(())
}

#[tauri::command]
pub fn quit_app(app: AppHandle) {
    if let Some(lifecycle) = app.try_state::<LifecycleState>() {
        lifecycle.is_quitting.store(true, Ordering::SeqCst);
    }
    app.exit(0);
}

#[tauri::command]
pub fn rename_item(
    state: State<'_, AppState>,
    id: String,
    title: String,
) -> Result<ClipboardItem, String> {
    state.db.rename_item(&id, &title)
}

#[tauri::command]
pub fn edit_text_item(
    state: State<'_, AppState>,
    id: String,
    content: String,
) -> Result<ClipboardItem, String> {
    state.db.edit_text_item(&id, &content)
}

#[tauri::command]
pub fn delete_item(state: State<'_, AppState>, id: String) -> Result<(), String> {
    state.db.delete_item(&id)
}

#[tauri::command]
pub fn get_platform() -> String {
    std::env::consts::OS.to_string()
}

#[tauri::command]
pub fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[tauri::command]
pub fn take_screenshot(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<ClipboardItem, String> {
    let item =
        screen_capture::capture_primary_screen(&app, &state.db, &state.skipped_capture_image)?;
    app.emit(CLIPBOARD_CHANGED_EVENT, ())
        .map_err(|error| error.to_string())?;
    Ok(item)
}

#[tauri::command]
pub fn open_capture_tool(app: AppHandle, tool: String) -> Result<(), String> {
    match tool.as_str() {
        "capture" | "color" => show_capture_tool(&app, &tool),
        _ => Err("Herramienta no vÃ¡lida".into()),
    }
}

#[tauri::command]
pub fn get_capture_preview(
    state: State<'_, AppState>,
) -> Result<screen_capture::CapturePreview, String> {
    let image = state
        .capture_image
        .lock()
        .map_err(|error| error.to_string())?
        .clone()
        .ok_or_else(|| "No hay una captura activa".to_string())?;
    screen_capture::preview(&image)
}

#[tauri::command]
pub fn list_capture_windows() -> Result<Vec<screen_capture::CaptureWindow>, String> {
    screen_capture::list_windows()
}

#[tauri::command]
pub fn save_capture_region(
    app: AppHandle,
    state: State<'_, AppState>,
    x: u32,
    y: u32,
    width: u32,
    height: u32,
) -> Result<ClipboardItem, String> {
    let image = state
        .capture_image
        .lock()
        .map_err(|error| error.to_string())?
        .clone()
        .ok_or_else(|| "No hay una captura activa".to_string())?;
    let item = screen_capture::persist_capture(
        &app,
        &state.db,
        &state.skipped_capture_image,
        screen_capture::crop(&image, x, y, width, height)?,
    )?;
    app.emit(CLIPBOARD_CHANGED_EVENT, ())
        .map_err(|error| error.to_string())?;
    Ok(item)
}

#[tauri::command]
pub fn save_capture_window(
    app: AppHandle,
    state: State<'_, AppState>,
    id: u32,
) -> Result<ClipboardItem, String> {
    let item = screen_capture::persist_capture(
        &app,
        &state.db,
        &state.skipped_capture_image,
        screen_capture::capture_window(id)?,
    )?;
    app.emit(CLIPBOARD_CHANGED_EVENT, ())
        .map_err(|error| error.to_string())?;
    Ok(item)
}

#[tauri::command]
pub fn preview_capture_color(state: State<'_, AppState>, x: u32, y: u32) -> Result<String, String> {
    let image = state
        .capture_image
        .lock()
        .map_err(|error| error.to_string())?;
    let image = image
        .as_ref()
        .ok_or_else(|| "No hay una captura activa".to_string())?;
    screen_capture::color_at(image, x, y)
}

#[tauri::command]
pub fn pick_capture_color(
    app: AppHandle,
    state: State<'_, AppState>,
    x: u32,
    y: u32,
) -> Result<String, String> {
    let image = state
        .capture_image
        .lock()
        .map_err(|error| error.to_string())?;
    let image = image
        .as_ref()
        .ok_or_else(|| "No hay una captura activa".to_string())?;
    let color = screen_capture::color_at(&image, x, y)?;
    Clipboard::new()
        .map_err(|error| error.to_string())?
        .set_text(&color)
        .map_err(|error| error.to_string())?;
    state.db.create_text_item(&color)?;
    app.emit(CLIPBOARD_CHANGED_EVENT, ())
        .map_err(|error| error.to_string())?;
    Ok(color)
}

#[tauri::command]
pub fn close_capture_tool(app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    *state
        .capture_image
        .lock()
        .map_err(|error| error.to_string())? = None;
    if let Some(window) = app.get_webview_window("capture") {
        window.close().map_err(|error| error.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn get_screenshot_directory(app: AppHandle) -> Result<String, String> {
    Ok(screen_capture::screenshot_directory(&app)?
        .display()
        .to_string())
}

#[tauri::command]
pub fn toggle_pin(state: State<'_, AppState>, id: String) -> Result<ClipboardItem, String> {
    state.db.toggle_pin(&id)
}

#[tauri::command]
pub fn toggle_favorite(state: State<'_, AppState>, id: String) -> Result<ClipboardItem, String> {
    state.db.toggle_favorite(&id)
}

#[tauri::command]
pub fn list_collections(state: State<'_, AppState>) -> Result<Vec<Collection>, String> {
    state.db.list_collections()
}

#[tauri::command]
pub fn create_collection(state: State<'_, AppState>, name: String) -> Result<Collection, String> {
    state.db.create_collection(&name)
}

#[tauri::command]
pub fn rename_collection(
    state: State<'_, AppState>,
    id: String,
    name: String,
) -> Result<Collection, String> {
    state.db.rename_collection(&id, &name)
}

#[tauri::command]
pub fn delete_collection(state: State<'_, AppState>, id: String) -> Result<(), String> {
    state.db.delete_collection(&id)
}

#[tauri::command]
pub fn add_to_collection(
    state: State<'_, AppState>,
    item_id: String,
    collection_id: String,
) -> Result<ClipboardItem, String> {
    state.db.add_to_collection(&item_id, &collection_id)
}

#[tauri::command]
pub fn remove_from_collection(
    state: State<'_, AppState>,
    item_id: String,
    collection_id: String,
) -> Result<ClipboardItem, String> {
    state.db.remove_from_collection(&item_id, &collection_id)
}

#[tauri::command]
pub fn get_settings(state: State<'_, AppState>) -> Result<AppSettings, String> {
    state.db.get_settings()
}

#[tauri::command]
pub fn update_history_limit(
    state: State<'_, AppState>,
    history_limit: i64,
) -> Result<AppSettings, String> {
    state.db.update_history_limit(history_limit)
}

#[tauri::command]
pub fn update_auto_start(
    app: AppHandle,
    state: State<'_, AppState>,
    auto_start: bool,
) -> Result<AppSettings, String> {
    use tauri_plugin_autostart::ManagerExt;

    if auto_start {
        app.autolaunch()
            .enable()
            .map_err(|error| error.to_string())?;
    } else {
        app.autolaunch()
            .disable()
            .map_err(|error| error.to_string())?;
    }

    state.db.update_auto_start(auto_start)
}

#[tauri::command]
pub fn update_theme(state: State<'_, AppState>, theme: String) -> Result<AppSettings, String> {
    state.db.update_theme(&theme)
}

#[tauri::command]
pub fn update_accent(state: State<'_, AppState>, accent: String) -> Result<AppSettings, String> {
    state.db.update_accent(&accent)
}

#[tauri::command]
pub fn update_capture_enabled(
    state: State<'_, AppState>,
    capture_enabled: bool,
) -> Result<AppSettings, String> {
    state
        .capture_enabled
        .store(capture_enabled, Ordering::Relaxed);
    state.db.update_capture_enabled(capture_enabled)
}

#[tauri::command]
pub fn update_shortcut(
    app: AppHandle,
    state: State<'_, AppState>,
    shortcut: String,
) -> Result<AppSettings, String> {
    let next = Shortcut::from_str(&shortcut).map_err(|error| format!("Atajo inválido: {error}"))?;
    let current = state
        .shortcut
        .read()
        .map_err(|error| error.to_string())?
        .clone();
    if current == next {
        return state.db.update_shortcut(&next.to_string());
    }

    app.global_shortcut()
        .unregister(current.clone())
        .map_err(|error| error.to_string())?;
    if let Err(error) = app.global_shortcut().register(next.clone()) {
        let _ = app.global_shortcut().register(current);
        return Err(format!("No se pudo registrar el atajo: {error}"));
    }

    *state.shortcut.write().map_err(|error| error.to_string())? = next.clone();
    state.db.update_shortcut(&next.to_string())
}

#[tauri::command]
pub fn update_screenshot_shortcut(
    app: AppHandle,
    state: State<'_, AppState>,
    shortcut: String,
) -> Result<AppSettings, String> {
    update_tool_shortcut(
        &app,
        &state,
        shortcut,
        &state.screenshot_shortcut,
        |db, value| db.update_screenshot_shortcut(value),
    )
}

#[tauri::command]
pub fn update_color_picker_shortcut(
    app: AppHandle,
    state: State<'_, AppState>,
    shortcut: String,
) -> Result<AppSettings, String> {
    update_tool_shortcut(
        &app,
        &state,
        shortcut,
        &state.color_picker_shortcut,
        |db, value| db.update_color_picker_shortcut(value),
    )
}

fn update_tool_shortcut<F>(
    app: &AppHandle,
    state: &AppState,
    shortcut: String,
    slot: &std::sync::Arc<std::sync::RwLock<Shortcut>>,
    save: F,
) -> Result<AppSettings, String>
where
    F: FnOnce(&crate::database::sqlite::Database, &str) -> Result<AppSettings, String>,
{
    let next =
        Shortcut::from_str(&shortcut).map_err(|error| format!("Atajo invÃ¡lido: {error}"))?;
    let current = slot.read().map_err(|error| error.to_string())?.clone();
    if current == next {
        return save(&state.db, &next.to_string());
    }
    app.global_shortcut()
        .unregister(current.clone())
        .map_err(|error| error.to_string())?;
    if let Err(error) = app.global_shortcut().register(next.clone()) {
        let _ = app.global_shortcut().register(current);
        return Err(format!("No se pudo registrar el atajo: {error}"));
    }
    *slot.write().map_err(|error| error.to_string())? = next.clone();
    save(&state.db, &next.to_string())
}

fn paste_hotkey() -> Result<(), String> {
    let mut enigo = Enigo::new(&Settings::default()).map_err(|error| error.to_string())?;
    let modifier = if cfg!(target_os = "macos") {
        Key::Meta
    } else {
        Key::Control
    };

    enigo
        .key(modifier, Direction::Press)
        .map_err(|error| error.to_string())?;
    enigo
        .key(Key::Unicode('v'), Direction::Click)
        .map_err(|error| error.to_string())?;
    enigo
        .key(modifier, Direction::Release)
        .map_err(|error| error.to_string())?;
    Ok(())
}
