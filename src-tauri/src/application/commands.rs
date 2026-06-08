use crate::domain::models::{AppSettings, ClipboardItem, Collection};
use crate::AppState;
use arboard::Clipboard;
use tauri::State;

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
    Clipboard::new()
        .map_err(|error| error.to_string())?
        .set_text(item.content)
        .map_err(|error| error.to_string())?;
    state.db.mark_used(&id)
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
