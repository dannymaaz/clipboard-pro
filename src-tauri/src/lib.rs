mod application;
mod database;
mod domain;
mod infrastructure;

use application::commands;
use database::sqlite::Database;
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

pub struct AppState {
    pub db: Database,
}

pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, pressed_shortcut, event| {
                    let shortcut =
                        Shortcut::new(Some(Modifiers::CONTROL | Modifiers::ALT), Code::KeyV);
                    if pressed_shortcut == &shortcut && event.state() == ShortcutState::Pressed {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        } else {
                            let _ = WebviewWindowBuilder::new(
                                app,
                                "main",
                                WebviewUrl::App("index.html".into()),
                            )
                            .title("Clipboard Pro")
                            .inner_size(420.0, 620.0)
                            .resizable(false)
                            .decorations(false)
                            .transparent(true)
                            .always_on_top(true)
                            .skip_taskbar(true)
                            .build();
                        }
                    }
                })
                .build(),
        )
        .setup(|app| {
            let shortcut = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::ALT), Code::KeyV);
            app.global_shortcut().register(shortcut)?;

            let database = Database::new(app.handle())?;
            infrastructure::clipboard_monitor::spawn_clipboard_monitor(database.clone());
            app.manage(AppState { db: database });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::list_items,
            commands::search_items,
            commands::create_text_item,
            commands::copy_item,
            commands::rename_item,
            commands::edit_text_item,
            commands::delete_item,
            commands::toggle_pin,
            commands::toggle_favorite,
            commands::list_collections,
            commands::create_collection,
            commands::rename_collection,
            commands::delete_collection,
            commands::add_to_collection,
            commands::remove_from_collection,
            commands::get_settings,
            commands::update_history_limit
        ])
        .run(tauri::generate_context!())
        .expect("error while running Clipboard Pro");
}
