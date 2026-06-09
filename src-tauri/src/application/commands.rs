use crate::domain::models::{AppSettings, ClipboardItem, ClipboardKind, Collection, ImageClipboardContent};
use crate::infrastructure::clipboard_monitor::CLIPBOARD_CHANGED_EVENT;
use crate::{AppState, LifecycleState};
use arboard::{Clipboard, ImageData};
use base64::{engine::general_purpose, Engine as _};
use enigo::{Direction, Enigo, Key, Keyboard, Settings};
use std::borrow::Cow;
use std::sync::atomic::Ordering;
use std::{thread, time::Duration};
use tauri::{AppHandle, Emitter, Manager, State};

#[tauri::command]
pub fn list_items(state: State<'_, AppState>) -> Result<Vec<ClipboardItem>, String> {
    state.db.list_items()
}

#[tauri::command]
pub fn search_items(state: State<'_, AppState>, query: String) -> Result<Vec<ClipboardItem>, String> {
    state.db.search_items(&query)
}

#[tauri::command]
pub fn create_text_item(state: State<'_, AppState>, content: String) -> Result<ClipboardItem, String> {
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
            let bytes = general_purpose::STANDARD
                .decode(image.rgba_base64)
                .map_err(|error| error.to_string())?;
            clipboard
                .set_image(ImageData {
                    width: image.width,
                    height: image.height,
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
pub fn quit_app(app: AppHandle) {
    if let Some(lifecycle) = app.try_state::<LifecycleState>() {
        lifecycle.is_quitting.store(true, Ordering::SeqCst);
    }
    app.exit(0);
}

#[tauri::command]
pub fn rename_item(state: State<'_, AppState>, id: String, title: String) -> Result<ClipboardItem, String> {
    state.db.rename_item(&id, &title)
}

#[tauri::command]
pub fn edit_text_item(state: State<'_, AppState>, id: String, content: String) -> Result<ClipboardItem, String> {
    state.db.edit_text_item(&id, &content)
}

#[tauri::command]
pub fn delete_item(state: State<'_, AppState>, id: String) -> Result<(), String> {
    state.db.delete_item(&id)
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
pub fn rename_collection(state: State<'_, AppState>, id: String, name: String) -> Result<Collection, String> {
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
pub fn update_history_limit(state: State<'_, AppState>, history_limit: i64) -> Result<AppSettings, String> {
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
        app.autolaunch().enable().map_err(|error| error.to_string())?;
    } else {
        app.autolaunch().disable().map_err(|error| error.to_string())?;
    }

    state.db.update_auto_start(auto_start)
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
