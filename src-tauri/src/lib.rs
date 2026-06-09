mod application;
mod database;
mod domain;
mod infrastructure;

use application::commands;
use database::sqlite::Database;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, WebviewUrl, WebviewWindowBuilder,
};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};
use tauri_plugin_autostart::ManagerExt;
use std::sync::atomic::{AtomicBool, Ordering};

pub struct AppState {
    pub db: Database,
}

pub struct LifecycleState {
    pub is_quitting: AtomicBool,
}

const WINDOW_WIDTH: f64 = 380.0;
const WINDOW_HEIGHT: f64 = 540.0;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_autostart::Builder::new().build())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, pressed_shortcut, event| {
                    let shortcut =
                        Shortcut::new(Some(Modifiers::CONTROL | Modifiers::ALT), Code::KeyV);
                    if pressed_shortcut == &shortcut && event.state() == ShortcutState::Pressed {
                        let _ = show_main_window(app);
                    }
                })
                .build(),
        )
        .setup(|app| {
            app.manage(LifecycleState {
                is_quitting: AtomicBool::new(false),
            });
            let shortcut = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::ALT), Code::KeyV);
            app.global_shortcut().register(shortcut)?;

            let database = Database::new(app.handle())?;
            infrastructure::clipboard_monitor::spawn_clipboard_monitor(database.clone(), app.handle().clone());
            let settings = database.get_settings()?;
            if settings.auto_start {
                let _ = app.autolaunch().enable();
            } else {
                let _ = app.autolaunch().disable();
            }
            app.manage(AppState { db: database });
            build_tray(app.handle())?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::list_items,
            commands::search_items,
            commands::create_text_item,
            commands::copy_item,
            commands::paste_item,
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
            commands::update_history_limit,
            commands::update_auto_start,
            commands::hide_window,
            commands::minimize_window,
            commands::quit_app
        ])
        .build(tauri::generate_context!())
        .expect("error while building Clipboard Pro")
        .run(|app, event| {
            if let tauri::RunEvent::ExitRequested { api, .. } = event {
                let lifecycle = app.state::<LifecycleState>();
                if !lifecycle.is_quitting.load(Ordering::SeqCst) {
                    api.prevent_exit();
                }
            }
        });
}

fn show_main_window(app: &AppHandle) -> tauri::Result<()> {
    let window = if let Some(window) = app.get_webview_window("main") {
        window
    } else {
        WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
            .title("Clipboard Pro")
            .inner_size(WINDOW_WIDTH, WINDOW_HEIGHT)
            .min_inner_size(WINDOW_WIDTH, WINDOW_HEIGHT)
            .resizable(false)
            .decorations(false)
            .transparent(true)
            .always_on_top(true)
            .skip_taskbar(true)
            .visible(false)
            .center()
            .build()?
    };

    window.show()?;
    window.unminimize()?;
    window.set_focus()?;
    Ok(())
}

fn build_tray(app: &AppHandle) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "show", "Show Clipboard Pro", true, None::<&str>)?;
    let hide = MenuItem::with_id(app, "hide", "Hide", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit Clipboard Pro", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &hide, &quit])?;
    let icon = app.default_window_icon().cloned();

    let mut tray = TrayIconBuilder::new()
        .tooltip("Clipboard Pro")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "show" => {
                let _ = show_main_window(app);
            }
            "hide" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.hide();
                }
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let _ = show_main_window(tray.app_handle());
            }
        });

    if let Some(icon) = icon {
        tray = tray.icon(icon);
    }

    tray.build(app)?;
    Ok(())
}
