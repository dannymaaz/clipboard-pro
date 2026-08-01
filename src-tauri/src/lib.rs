mod application;
mod database;
mod domain;
mod infrastructure;

use application::commands;
use database::sqlite::Database;
use image::RgbaImage;
use std::{
    str::FromStr,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex, RwLock,
    },
};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, WebviewUrl, WebviewWindowBuilder,
};
use tauri_plugin_autostart::ManagerExt;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

pub struct AppState {
    pub db: Database,
    pub capture_enabled: Arc<AtomicBool>,
    pub skipped_capture_image: Arc<Mutex<Option<String>>>,
    pub shortcut: Arc<RwLock<Shortcut>>,
    pub screenshot_shortcut: Arc<RwLock<Shortcut>>,
    pub color_picker_shortcut: Arc<RwLock<Shortcut>>,
    pub capture_image: Arc<Mutex<Option<RgbaImage>>>,
}

pub struct LifecycleState {
    pub is_quitting: AtomicBool,
}

const WINDOW_WIDTH: f64 = 380.0;
const WINDOW_HEIGHT: f64 = 540.0;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_autostart::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, pressed_shortcut, event| {
                    let shortcut = app.try_state::<AppState>().and_then(|state| {
                        state.shortcut.read().ok().map(|shortcut| shortcut.clone())
                    });
                    if shortcut.as_ref() == Some(pressed_shortcut)
                        && event.state() == ShortcutState::Pressed
                    {
                        let _ = show_main_window(app);
                    }
                    let screenshot_shortcut = app.try_state::<AppState>().and_then(|state| {
                        state
                            .screenshot_shortcut
                            .read()
                            .ok()
                            .map(|shortcut| shortcut.clone())
                    });
                    if screenshot_shortcut.as_ref() == Some(pressed_shortcut)
                        && event.state() == ShortcutState::Pressed
                    {
                        let _ = show_capture_tool(app, "capture");
                    }
                    let color_picker_shortcut = app.try_state::<AppState>().and_then(|state| {
                        state
                            .color_picker_shortcut
                            .read()
                            .ok()
                            .map(|shortcut| shortcut.clone())
                    });
                    if color_picker_shortcut.as_ref() == Some(pressed_shortcut)
                        && event.state() == ShortcutState::Pressed
                    {
                        let _ = show_capture_tool(app, "color");
                    }
                })
                .build(),
        )
        .setup(|app| {
            app.manage(LifecycleState {
                is_quitting: AtomicBool::new(false),
            });
            let database = Database::new(app.handle())?;
            let settings = database.get_settings()?;
            let shortcut =
                Shortcut::from_str(&settings.shortcut).unwrap_or_else(|_| default_shortcut());
            let screenshot_shortcut = Shortcut::from_str(&settings.screenshot_shortcut)
                .unwrap_or_else(|_| default_screenshot_shortcut());
            let color_picker_shortcut = Shortcut::from_str(&settings.color_picker_shortcut)
                .unwrap_or_else(|_| default_color_picker_shortcut());
            // A shortcut may already belong to another application. That
            // should only disable that shortcut, never prevent Clipboard Pro
            // from opening.
            for shortcut in [&shortcut, &screenshot_shortcut, &color_picker_shortcut] {
                if let Err(error) = app.global_shortcut().register(shortcut.clone()) {
                    eprintln!("Could not register global shortcut {shortcut}: {error}");
                }
            }
            let capture_enabled = Arc::new(AtomicBool::new(settings.capture_enabled));
            let skipped_capture_image = Arc::new(Mutex::new(None));

            infrastructure::clipboard_monitor::spawn_clipboard_monitor(
                database.clone(),
                app.handle().clone(),
                capture_enabled.clone(),
                skipped_capture_image.clone(),
            );
            if settings.auto_start {
                let _ = app.autolaunch().enable();
            } else {
                let _ = app.autolaunch().disable();
            }
            app.manage(AppState {
                db: database,
                capture_enabled,
                skipped_capture_image,
                shortcut: Arc::new(RwLock::new(shortcut)),
                screenshot_shortcut: Arc::new(RwLock::new(screenshot_shortcut)),
                color_picker_shortcut: Arc::new(RwLock::new(color_picker_shortcut)),
                capture_image: Arc::new(Mutex::new(None)),
            });
            build_tray(app.handle())?;
            show_main_window(app.handle())?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::list_items,
            commands::list_items_page,
            commands::search_items,
            commands::create_text_item,
            commands::copy_item,
            commands::paste_item,
            commands::rename_item,
            commands::edit_text_item,
            commands::delete_item,
            commands::get_platform,
            commands::get_app_version,
            commands::take_screenshot,
            commands::open_capture_tool,
            commands::get_capture_preview,
            commands::list_capture_windows,
            commands::save_capture_region,
            commands::save_capture_window,
            commands::preview_capture_color,
            commands::pick_capture_color,
            commands::close_capture_tool,
            commands::get_screenshot_directory,
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
            commands::update_theme,
            commands::update_accent,
            commands::update_capture_enabled,
            commands::update_shortcut,
            commands::update_screenshot_shortcut,
            commands::update_color_picker_shortcut,
            commands::hide_window,
            commands::minimize_window,
            commands::toggle_maximize_window,
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

fn default_shortcut() -> Shortcut {
    Shortcut::from_str(default_shortcut_value()).expect("default shortcut must be valid")
}

fn default_screenshot_shortcut() -> Shortcut {
    Shortcut::from_str(default_screenshot_shortcut_value())
        .expect("default screenshot shortcut must be valid")
}

fn default_color_picker_shortcut() -> Shortcut {
    Shortcut::from_str(default_color_picker_shortcut_value())
        .expect("default color picker shortcut must be valid")
}

#[cfg(target_os = "macos")]
fn default_shortcut_value() -> &'static str {
    "Command+Alt+V"
}

#[cfg(not(target_os = "macos"))]
fn default_shortcut_value() -> &'static str {
    "Ctrl+Alt+V"
}

#[cfg(target_os = "macos")]
fn default_screenshot_shortcut_value() -> &'static str {
    "Command+Alt+S"
}

#[cfg(not(target_os = "macos"))]
fn default_screenshot_shortcut_value() -> &'static str {
    "Ctrl+Alt+S"
}

#[cfg(target_os = "macos")]
fn default_color_picker_shortcut_value() -> &'static str {
    "Command+Alt+G"
}

#[cfg(not(target_os = "macos"))]
fn default_color_picker_shortcut_value() -> &'static str {
    "Ctrl+Alt+G"
}

fn show_main_window(app: &AppHandle) -> tauri::Result<()> {
    let window = if let Some(window) = app.get_webview_window("main") {
        window
    } else {
        WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
            .title("Clipboard Pro")
            .inner_size(WINDOW_WIDTH, WINDOW_HEIGHT)
            .min_inner_size(WINDOW_WIDTH, WINDOW_HEIGHT)
            .resizable(true)
            .maximizable(true)
            .decorations(false)
            .transparent(true)
            .always_on_top(true)
            .skip_taskbar(false)
            .visible(false)
            .center()
            .build()?
    };

    window.show()?;
    window.unminimize()?;
    window.set_focus()?;
    Ok(())
}

pub fn show_capture_tool(app: &AppHandle, tool: &str) -> Result<(), String> {
    if let Some(main) = app.get_webview_window("main") {
        let _ = main.hide();
    }
    std::thread::sleep(std::time::Duration::from_millis(140));
    let image = infrastructure::screen_capture::capture_primary_image()?;
    *app.state::<AppState>()
        .capture_image
        .lock()
        .map_err(|error| error.to_string())? = Some(image);

    if let Some(window) = app.get_webview_window("capture") {
        let _ = window.close();
    }
    WebviewWindowBuilder::new(
        app,
        "capture",
        WebviewUrl::App(format!("index.html?tool={tool}").into()),
    )
    .title("Clipboard Pro Tools")
    .decorations(false)
    .fullscreen(true)
    .always_on_top(true)
    .skip_taskbar(true)
    .build()
    .map_err(|error| error.to_string())?;
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
