use crate::domain::models::{
    AppSettings, ClipboardItem, ClipboardKind, Collection, ImageClipboardContent,
};
use base64::{engine::general_purpose, Engine as _};
use chrono::Utc;
use image::{DynamicImage, ImageBuffer, ImageEncoder, Rgba};
use rusqlite::{params, Connection, OptionalExtension};
use std::fs;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Manager};
use uuid::Uuid;

#[derive(Clone)]
pub struct Database {
    conn: Arc<Mutex<Connection>>,
}

struct RawItem {
    id: String,
    title: Option<String>,
    content: String,
    preview: String,
    thumbnail: Option<String>,
    kind: ClipboardKind,
    is_pinned: bool,
    is_favorite: bool,
    created_at: String,
    updated_at: String,
    last_used_at: Option<String>,
}

impl Database {
    pub fn new(app: &AppHandle) -> Result<Self, String> {
        let data_dir = app
            .path()
            .app_data_dir()
            .map_err(|error| error.to_string())?;
        fs::create_dir_all(&data_dir).map_err(|error| error.to_string())?;
        let db_path = data_dir.join("clipboard-pro.sqlite3");
        let conn = Connection::open(db_path).map_err(|error| error.to_string())?;
        conn.execute_batch(include_str!("../../database/schema.sql"))
            .map_err(|error| error.to_string())?;
        migrate(&conn)?;
        Ok(Self {
            conn: Arc::new(Mutex::new(conn)),
        })
    }

    pub fn list_items(&self) -> Result<Vec<ClipboardItem>, String> {
        self.list_items_page(0, 100)
    }

    pub fn list_items_page(&self, offset: i64, limit: i64) -> Result<Vec<ClipboardItem>, String> {
        if offset < 0 || !(1..=100).contains(&limit) {
            return Err("Invalid history page".into());
        }
        let conn = self.conn.lock().map_err(|error| error.to_string())?;
        let mut stmt = conn
            .prepare(
                "SELECT id, title, CASE WHEN kind = 'image' THEN '' ELSE content END, preview, thumbnail, kind, is_pinned, is_favorite, created_at, updated_at, last_used_at
                 FROM clipboard_items
                 ORDER BY is_pinned DESC, created_at DESC
                 LIMIT ?1 OFFSET ?2",
            )
            .map_err(|error| error.to_string())?;
        let raw_items = stmt
            .query_map(params![limit, offset], map_raw_item)
            .map_err(|error| error.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| error.to_string())?;

        raw_items
            .into_iter()
            .map(|raw| self.hydrate_item(&conn, raw, false))
            .collect()
    }

    pub fn search_items(&self, query: &str) -> Result<Vec<ClipboardItem>, String> {
        let sanitized = query
            .split_whitespace()
            .map(|part| format!("{part}*"))
            .collect::<Vec<_>>()
            .join(" ");

        if sanitized.trim().is_empty() {
            return self.list_items();
        }

        let conn = self.conn.lock().map_err(|error| error.to_string())?;
        let mut stmt = conn
            .prepare(
                "SELECT ci.id, ci.title, CASE WHEN ci.kind = 'image' THEN '' ELSE ci.content END, ci.preview, ci.thumbnail, ci.kind, ci.is_pinned, ci.is_favorite,
                        ci.created_at, ci.updated_at, ci.last_used_at
                 FROM item_search s
                 JOIN clipboard_items ci ON ci.id = s.item_id
                 WHERE item_search MATCH ?1
                 ORDER BY rank, ci.is_pinned DESC, ci.created_at DESC
                 LIMIT 500",
            )
            .map_err(|error| error.to_string())?;
        let raw_items = stmt
            .query_map(params![sanitized], map_raw_item)
            .map_err(|error| error.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| error.to_string())?;

        raw_items
            .into_iter()
            .map(|raw| self.hydrate_item(&conn, raw, false))
            .collect()
    }

    pub fn create_text_item(&self, content: &str) -> Result<ClipboardItem, String> {
        self.create_typed_item(
            detect_kind(content).as_str(),
            content,
            &make_preview(content),
            None,
        )
    }

    pub fn create_typed_item(
        &self,
        kind: &str,
        content: &str,
        preview: &str,
        thumbnail: Option<&str>,
    ) -> Result<ClipboardItem, String> {
        let conn = self.conn.lock().map_err(|error| error.to_string())?;
        if let Some(existing_id) = conn
            .query_row(
                "SELECT id FROM clipboard_items WHERE content = ?1 ORDER BY created_at DESC LIMIT 1",
                params![content],
                |row| row.get::<_, String>(0),
            )
            .optional()
            .map_err(|error| error.to_string())?
        {
            conn.execute(
                "UPDATE clipboard_items SET created_at = ?1, updated_at = ?1 WHERE id = ?2",
                params![now(), existing_id.as_str()],
            )
            .map_err(|error| error.to_string())?;
            return self.fetch_item_locked(&conn, &existing_id);
        }

        let id = Uuid::new_v4().to_string();
        let now = now();
        conn.execute(
            "INSERT INTO clipboard_items(id, title, content, preview, thumbnail, kind, created_at, updated_at)
             VALUES (?1, NULL, ?2, ?3, ?4, ?5, ?6, ?6)",
            params![id, content, preview, thumbnail, kind, now],
        )
        .map_err(|error| error.to_string())?;
        self.prune_history_locked(&conn)?;
        self.fetch_item_locked(&conn, &id)
    }

    pub fn fetch_item(&self, id: &str) -> Result<ClipboardItem, String> {
        let conn = self.conn.lock().map_err(|error| error.to_string())?;
        self.fetch_item_locked(&conn, id)
    }

    pub fn mark_used(&self, id: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|error| error.to_string())?;
        conn.execute(
            "UPDATE clipboard_items SET last_used_at = ?1, updated_at = ?1 WHERE id = ?2",
            params![now(), id],
        )
        .map_err(|error| error.to_string())?;
        Ok(())
    }

    pub fn rename_item(&self, id: &str, title: &str) -> Result<ClipboardItem, String> {
        let conn = self.conn.lock().map_err(|error| error.to_string())?;
        conn.execute(
            "UPDATE clipboard_items SET title = ?1, updated_at = ?2 WHERE id = ?3",
            params![title, now(), id],
        )
        .map_err(|error| error.to_string())?;
        self.fetch_item_locked(&conn, id)
    }

    pub fn edit_text_item(&self, id: &str, content: &str) -> Result<ClipboardItem, String> {
        let conn = self.conn.lock().map_err(|error| error.to_string())?;
        let kind = detect_kind(content);
        conn.execute(
            "UPDATE clipboard_items SET content = ?1, preview = ?2, kind = ?3, updated_at = ?4
             WHERE id = ?5 AND kind IN ('text', 'color', 'url')",
            params![content, make_preview(content), kind.as_str(), now(), id],
        )
        .map_err(|error| error.to_string())?;
        self.fetch_item_locked(&conn, id)
    }

    pub fn delete_item(&self, id: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|error| error.to_string())?;
        conn.execute(
            "DELETE FROM collection_items WHERE item_id = ?1",
            params![id],
        )
        .map_err(|error| error.to_string())?;
        conn.execute("DELETE FROM clipboard_items WHERE id = ?1", params![id])
            .map_err(|error| error.to_string())?;
        Ok(())
    }

    pub fn toggle_pin(&self, id: &str) -> Result<ClipboardItem, String> {
        let conn = self.conn.lock().map_err(|error| error.to_string())?;
        conn.execute(
            "UPDATE clipboard_items SET is_pinned = CASE is_pinned WHEN 1 THEN 0 ELSE 1 END, updated_at = ?1 WHERE id = ?2",
            params![now(), id],
        )
        .map_err(|error| error.to_string())?;
        self.fetch_item_locked(&conn, id)
    }

    pub fn toggle_favorite(&self, id: &str) -> Result<ClipboardItem, String> {
        let conn = self.conn.lock().map_err(|error| error.to_string())?;
        conn.execute(
            "UPDATE clipboard_items SET is_favorite = CASE is_favorite WHEN 1 THEN 0 ELSE 1 END, updated_at = ?1 WHERE id = ?2",
            params![now(), id],
        )
        .map_err(|error| error.to_string())?;
        self.fetch_item_locked(&conn, id)
    }

    pub fn list_collections(&self) -> Result<Vec<Collection>, String> {
        let conn = self.conn.lock().map_err(|error| error.to_string())?;
        let mut stmt = conn
            .prepare(
                "SELECT c.id, c.name, COUNT(item.id) AS item_count, c.created_at, c.updated_at
                 FROM collections c
                 LEFT JOIN collection_items ci ON ci.collection_id = c.id
                 LEFT JOIN clipboard_items item ON item.id = ci.item_id
                 GROUP BY c.id
                 ORDER BY c.updated_at DESC",
            )
            .map_err(|error| error.to_string())?;
        let collections = stmt
            .query_map([], |row| {
                Ok(Collection {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    item_count: row.get(2)?,
                    created_at: row.get(3)?,
                    updated_at: row.get(4)?,
                })
            })
            .map_err(|error| error.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| error.to_string())?;

        Ok(collections)
    }

    pub fn create_collection(&self, name: &str) -> Result<Collection, String> {
        let conn = self.conn.lock().map_err(|error| error.to_string())?;
        let id = Uuid::new_v4().to_string();
        let now = now();
        conn.execute(
            "INSERT INTO collections(id, name, created_at, updated_at) VALUES (?1, ?2, ?3, ?3)",
            params![id, name, now],
        )
        .map_err(|error| error.to_string())?;
        self.fetch_collection_locked(&conn, &id)
    }

    pub fn rename_collection(&self, id: &str, name: &str) -> Result<Collection, String> {
        let conn = self.conn.lock().map_err(|error| error.to_string())?;
        conn.execute(
            "UPDATE collections SET name = ?1, updated_at = ?2 WHERE id = ?3",
            params![name, now(), id],
        )
        .map_err(|error| error.to_string())?;
        self.fetch_collection_locked(&conn, id)
    }

    pub fn delete_collection(&self, id: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|error| error.to_string())?;
        conn.execute(
            "DELETE FROM collection_items WHERE collection_id = ?1",
            params![id],
        )
        .map_err(|error| error.to_string())?;
        conn.execute("DELETE FROM collections WHERE id = ?1", params![id])
            .map_err(|error| error.to_string())?;
        Ok(())
    }

    pub fn add_to_collection(
        &self,
        item_id: &str,
        collection_id: &str,
    ) -> Result<ClipboardItem, String> {
        let conn = self.conn.lock().map_err(|error| error.to_string())?;
        let now = now();
        conn.execute(
            "INSERT OR IGNORE INTO collection_items(item_id, collection_id, created_at) VALUES (?1, ?2, ?3)",
            params![item_id, collection_id, now],
        )
        .map_err(|error| error.to_string())?;
        self.fetch_item_locked(&conn, item_id)
    }

    pub fn remove_from_collection(
        &self,
        item_id: &str,
        collection_id: &str,
    ) -> Result<ClipboardItem, String> {
        let conn = self.conn.lock().map_err(|error| error.to_string())?;
        conn.execute(
            "DELETE FROM collection_items WHERE item_id = ?1 AND collection_id = ?2",
            params![item_id, collection_id],
        )
        .map_err(|error| error.to_string())?;
        self.fetch_item_locked(&conn, item_id)
    }

    pub fn get_settings(&self) -> Result<AppSettings, String> {
        let conn = self.conn.lock().map_err(|error| error.to_string())?;
        Ok(AppSettings {
            history_limit: self.get_setting_i64_locked(&conn, "history_limit", 50)?,
            shortcut: self.get_setting_locked(&conn, "shortcut", default_shortcut_value())?,
            screenshot_shortcut: self.get_setting_locked(
                &conn,
                "screenshot_shortcut",
                default_screenshot_shortcut_value(),
            )?,
            color_picker_shortcut: self.get_setting_locked(
                &conn,
                "color_picker_shortcut",
                default_color_picker_shortcut_value(),
            )?,
            theme: self.get_setting_locked(&conn, "theme", "system")?,
            accent: self.get_setting_locked(&conn, "accent", "blue")?,
            auto_start: self.get_setting_bool_locked(&conn, "auto_start", false)?,
            capture_enabled: self.get_setting_bool_locked(&conn, "capture_enabled", true)?,
        })
    }

    pub fn update_history_limit(&self, limit: i64) -> Result<AppSettings, String> {
        if ![50, 100, 250, 500].contains(&limit) {
            return Err("History limit must be 50, 100, 250 or 500".into());
        }
        let conn = self.conn.lock().map_err(|error| error.to_string())?;
        conn.execute(
            "INSERT INTO settings(key, value) VALUES ('history_limit', ?1)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            params![limit.to_string()],
        )
        .map_err(|error| error.to_string())?;
        self.prune_history_locked(&conn)?;
        drop(conn);
        self.get_settings()
    }

    pub fn update_auto_start(&self, auto_start: bool) -> Result<AppSettings, String> {
        self.update_setting("auto_start", &auto_start.to_string())
    }

    pub fn update_theme(&self, theme: &str) -> Result<AppSettings, String> {
        if !["system", "light", "dark"].contains(&theme) {
            return Err("Theme must be system, light or dark".into());
        }
        self.update_setting("theme", theme)
    }

    pub fn update_accent(&self, accent: &str) -> Result<AppSettings, String> {
        if ![
            "blue", "indigo", "violet", "fuchsia", "rose", "red", "orange", "amber", "green",
            "emerald", "teal", "cyan",
        ]
        .contains(&accent)
        {
            return Err("Unsupported accent color".into());
        }
        self.update_setting("accent", accent)
    }

    pub fn update_shortcut(&self, shortcut: &str) -> Result<AppSettings, String> {
        if shortcut.trim().is_empty() || shortcut.len() > 80 {
            return Err("Shortcut must not be empty".into());
        }
        self.update_setting("shortcut", shortcut)
    }

    pub fn update_screenshot_shortcut(&self, shortcut: &str) -> Result<AppSettings, String> {
        if shortcut.trim().is_empty() || shortcut.len() > 80 {
            return Err("Shortcut must not be empty".into());
        }
        self.update_setting("screenshot_shortcut", shortcut)
    }

    pub fn update_color_picker_shortcut(&self, shortcut: &str) -> Result<AppSettings, String> {
        if shortcut.trim().is_empty() || shortcut.len() > 80 {
            return Err("Shortcut must not be empty".into());
        }
        self.update_setting("color_picker_shortcut", shortcut)
    }

    pub fn update_capture_enabled(&self, capture_enabled: bool) -> Result<AppSettings, String> {
        self.update_setting("capture_enabled", &capture_enabled.to_string())
    }

    fn fetch_item_locked(&self, conn: &Connection, id: &str) -> Result<ClipboardItem, String> {
        let raw = conn
            .query_row(
                "SELECT id, title, content, preview, thumbnail, kind, is_pinned, is_favorite, created_at, updated_at, last_used_at
                 FROM clipboard_items WHERE id = ?1",
                params![id],
                map_raw_item,
            )
            .optional()
            .map_err(|error| error.to_string())?
            .ok_or_else(|| "Clipboard item not found".to_string())?;
        self.hydrate_item(conn, raw, true)
    }

    fn hydrate_item(
        &self,
        conn: &Connection,
        raw: RawItem,
        include_content: bool,
    ) -> Result<ClipboardItem, String> {
        let mut stmt = conn
            .prepare(
                "SELECT collection_id FROM collection_items WHERE item_id = ?1 ORDER BY created_at DESC",
            )
            .map_err(|error| error.to_string())?;
        let collections = stmt
            .query_map(params![raw.id.as_str()], |row| row.get::<_, String>(0))
            .map_err(|error| error.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| error.to_string())?;

        let content = if include_content || !matches!(raw.kind, ClipboardKind::Image) {
            raw.content
        } else {
            String::new()
        };

        Ok(ClipboardItem {
            id: raw.id,
            title: raw.title,
            content,
            preview: raw.preview,
            thumbnail: raw.thumbnail,
            kind: raw.kind,
            is_pinned: raw.is_pinned,
            is_favorite: raw.is_favorite,
            created_at: raw.created_at,
            updated_at: raw.updated_at,
            last_used_at: raw.last_used_at,
            collections,
        })
    }

    fn fetch_collection_locked(&self, conn: &Connection, id: &str) -> Result<Collection, String> {
        conn.query_row(
            "SELECT c.id, c.name, COUNT(item.id) AS item_count, c.created_at, c.updated_at
             FROM collections c
             LEFT JOIN collection_items ci ON ci.collection_id = c.id
             LEFT JOIN clipboard_items item ON item.id = ci.item_id
             WHERE c.id = ?1
             GROUP BY c.id",
            params![id],
            |row| {
                Ok(Collection {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    item_count: row.get(2)?,
                    created_at: row.get(3)?,
                    updated_at: row.get(4)?,
                })
            },
        )
        .map_err(|error| error.to_string())
    }

    fn prune_history_locked(&self, conn: &Connection) -> Result<(), String> {
        let limit = self.get_setting_i64_locked(conn, "history_limit", 50)?;
        conn.execute(
            "DELETE FROM clipboard_items
             WHERE id IN (
               SELECT ci.id
               FROM clipboard_items ci
               WHERE ci.is_pinned = 0
                 AND ci.is_favorite = 0
                 AND NOT EXISTS (
                   SELECT 1 FROM collection_items x WHERE x.item_id = ci.id
                 )
               ORDER BY ci.created_at DESC
               LIMIT -1 OFFSET ?1
             )",
            params![limit],
        )
        .map_err(|error| error.to_string())?;
        Ok(())
    }

    fn get_setting_locked(
        &self,
        conn: &Connection,
        key: &str,
        fallback: &str,
    ) -> Result<String, String> {
        conn.query_row(
            "SELECT value FROM settings WHERE key = ?1",
            params![key],
            |row| row.get(0),
        )
        .optional()
        .map_err(|error| error.to_string())
        .map(|value| value.unwrap_or_else(|| fallback.to_string()))
    }

    fn update_setting(&self, key: &str, value: &str) -> Result<AppSettings, String> {
        let conn = self.conn.lock().map_err(|error| error.to_string())?;
        conn.execute(
            "INSERT INTO settings(key, value) VALUES (?1, ?2)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            params![key, value],
        )
        .map_err(|error| error.to_string())?;
        drop(conn);
        self.get_settings()
    }

    fn get_setting_i64_locked(
        &self,
        conn: &Connection,
        key: &str,
        fallback: i64,
    ) -> Result<i64, String> {
        let value = self.get_setting_locked(conn, key, &fallback.to_string())?;
        Ok(value.parse::<i64>().unwrap_or(fallback))
    }

    fn get_setting_bool_locked(
        &self,
        conn: &Connection,
        key: &str,
        fallback: bool,
    ) -> Result<bool, String> {
        let value = self.get_setting_locked(conn, key, if fallback { "true" } else { "false" })?;
        Ok(matches!(value.as_str(), "true" | "1" | "yes"))
    }
}

fn map_raw_item(row: &rusqlite::Row<'_>) -> rusqlite::Result<RawItem> {
    let kind: String = row.get(5)?;
    Ok(RawItem {
        id: row.get(0)?,
        title: row.get(1)?,
        content: row.get(2)?,
        preview: row.get(3)?,
        thumbnail: row.get(4)?,
        kind: ClipboardKind::try_from(kind.as_str()).unwrap_or(ClipboardKind::Text),
        is_pinned: row.get::<_, i64>(6)? == 1,
        is_favorite: row.get::<_, i64>(7)? == 1,
        created_at: row.get(8)?,
        updated_at: row.get(9)?,
        last_used_at: row.get(10)?,
    })
}

fn migrate(conn: &Connection) -> Result<(), String> {
    // These data migrations can require reading every saved clipboard image.
    // Running them during every startup makes a large history look like the
    // application never opened, so record their successful completion.
    let completed = conn
        .query_row(
            "SELECT value FROM settings WHERE key = 'data_migration_v2_complete'",
            [],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .map_err(|error| error.to_string())?
        .as_deref()
        == Some("true");

    let _ = conn.execute("ALTER TABLE clipboard_items ADD COLUMN thumbnail TEXT", []);
    ensure_color_kind(conn)?;
    migrate_standard_shortcuts(conn)?;
    // Ctrl+Alt+G is the intended default for the color picker. Only replace
    // the previous shipped default so custom user shortcuts remain untouched.
    conn.execute(
        "UPDATE settings SET value = 'Ctrl+Alt+G'
         WHERE key = 'color_picker_shortcut'
           AND value IN ('Ctrl+Alt+C', 'CTRL+ALT+KeyC', 'control+alt+KeyC')",
        [],
    )
    .map_err(|error| error.to_string())?;
    if completed {
        return Ok(());
    }
    conn.execute(
        "UPDATE clipboard_items SET kind = 'color'
         WHERE kind = 'text'
           AND trim(content) GLOB '#[0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f]'",
        [],
    )
    .map_err(|error| error.to_string())?;
    conn.execute(
        "DELETE FROM collection_items
         WHERE item_id NOT IN (SELECT id FROM clipboard_items)
            OR collection_id NOT IN (SELECT id FROM collections)",
        [],
    )
    .map_err(|error| error.to_string())?;
    conn.execute_batch(
        "DROP TRIGGER IF EXISTS clipboard_items_ai;
         DROP TRIGGER IF EXISTS clipboard_items_au;
         DROP TRIGGER IF EXISTS clipboard_items_ad;
         CREATE TRIGGER clipboard_items_ai AFTER INSERT ON clipboard_items BEGIN
           INSERT INTO item_search(item_id, title, content, preview)
           VALUES (new.id, coalesce(new.title, ''), CASE WHEN new.kind = 'image' THEN '' ELSE new.content END, new.preview);
         END;
         CREATE TRIGGER clipboard_items_au AFTER UPDATE ON clipboard_items BEGIN
           UPDATE item_search
           SET title = coalesce(new.title, ''), content = CASE WHEN new.kind = 'image' THEN '' ELSE new.content END, preview = new.preview
           WHERE item_id = new.id;
         END;
         CREATE TRIGGER clipboard_items_ad AFTER DELETE ON clipboard_items BEGIN
           DELETE FROM item_search WHERE item_id = old.id;
         END;",
    )
    .map_err(|error| error.to_string())?;
    migrate_legacy_images(conn)?;
    conn.execute("DELETE FROM item_search", [])
        .map_err(|error| error.to_string())?;
    conn.execute(
        "INSERT INTO item_search(item_id, title, content, preview)
         SELECT id, coalesce(title, ''), CASE WHEN kind = 'image' THEN '' ELSE content END, preview FROM clipboard_items",
        [],
    )
    .map_err(|error| error.to_string())?;
    conn.execute(
        "INSERT OR IGNORE INTO settings(key, value) VALUES ('auto_start', 'false')",
        [],
    )
    .map_err(|error| error.to_string())?;
    conn.execute(
        "INSERT OR IGNORE INTO settings(key, value) VALUES ('accent', 'blue'), ('capture_enabled', 'true')",
        [],
    )
    .map_err(|error| error.to_string())?;
    conn.execute(
        "INSERT OR IGNORE INTO settings(key, value) VALUES ('screenshot_shortcut', 'Ctrl+Alt+S'), ('color_picker_shortcut', 'Ctrl+Alt+G')",
        [],
    )
    .map_err(|error| error.to_string())?;
    conn.execute(
        "INSERT INTO settings(key, value) VALUES ('data_migration_v2_complete', 'true')
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        [],
    )
    .map_err(|error| error.to_string())?;
    Ok(())
}

fn migrate_standard_shortcuts(conn: &Connection) -> Result<(), String> {
    for (key, replacement, current_values) in [
        (
            "shortcut",
            default_shortcut_value(),
            ["Ctrl+Alt+V", "CTRL+ALT+KeyV", "control+alt+KeyV", ""],
        ),
        (
            "screenshot_shortcut",
            default_screenshot_shortcut_value(),
            ["Ctrl+Alt+S", "CTRL+ALT+KeyS", "control+alt+KeyS", ""],
        ),
        (
            "color_picker_shortcut",
            default_color_picker_shortcut_value(),
            ["Ctrl+Alt+C", "CTRL+ALT+KeyC", "Ctrl+Alt+G", "CTRL+ALT+KeyG"],
        ),
    ] {
        conn.execute(
            "UPDATE settings SET value = ?1
             WHERE key = ?2 AND value IN (?3, ?4, ?5, ?6)",
            params![
                replacement,
                key,
                current_values[0],
                current_values[1],
                current_values[2],
                current_values[3]
            ],
        )
        .map_err(|error| error.to_string())?;
    }
    Ok(())
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

fn ensure_color_kind(conn: &Connection) -> Result<(), String> {
    let table_sql: Option<String> = conn
        .query_row(
            "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'clipboard_items'",
            [],
            |row| row.get(0),
        )
        .optional()
        .map_err(|error| error.to_string())?;
    if table_sql
        .as_deref()
        .is_some_and(|sql| sql.contains("'color'"))
    {
        return Ok(());
    }

    conn.execute_batch("PRAGMA foreign_keys = OFF; BEGIN IMMEDIATE;")
        .map_err(|error| error.to_string())?;
    let result = conn.execute_batch(
        "CREATE TABLE clipboard_items_repaired (
           id TEXT PRIMARY KEY,
           title TEXT,
           content TEXT NOT NULL,
           preview TEXT NOT NULL,
           thumbnail TEXT,
           kind TEXT NOT NULL CHECK (kind IN ('text', 'url', 'image', 'document', 'color')),
           is_pinned INTEGER NOT NULL DEFAULT 0,
           is_favorite INTEGER NOT NULL DEFAULT 0,
           created_at TEXT NOT NULL,
           updated_at TEXT NOT NULL,
           last_used_at TEXT
         );
         INSERT INTO clipboard_items_repaired
           (id, title, content, preview, thumbnail, kind, is_pinned, is_favorite, created_at, updated_at, last_used_at)
         SELECT id, title, content, preview, thumbnail, kind, is_pinned, is_favorite, created_at, updated_at, last_used_at
         FROM clipboard_items;
         DROP TABLE clipboard_items;
         ALTER TABLE clipboard_items_repaired RENAME TO clipboard_items;
         CREATE INDEX idx_clipboard_items_created_at ON clipboard_items(created_at DESC);
         CREATE INDEX idx_clipboard_items_pinned ON clipboard_items(is_pinned, created_at DESC);
         CREATE INDEX idx_clipboard_items_favorite ON clipboard_items(is_favorite, created_at DESC);
         CREATE INDEX idx_clipboard_items_kind ON clipboard_items(kind);
         COMMIT;",
    );
    if result.is_err() {
        let _ = conn.execute_batch("ROLLBACK;");
    }
    let foreign_keys = conn.execute_batch("PRAGMA foreign_keys = ON;");
    result.and(foreign_keys).map_err(|error| error.to_string())
}

fn migrate_legacy_images(conn: &Connection) -> Result<(), String> {
    let mut statement = conn
        .prepare("SELECT id, content FROM clipboard_items WHERE kind = 'image'")
        .map_err(|error| error.to_string())?;
    let images = statement
        .query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;

    for (id, content) in images {
        let Ok(image) = serde_json::from_str::<ImageClipboardContent>(&content) else {
            continue;
        };
        if image.png_base64.is_some() {
            continue;
        }
        let Some(rgba_base64) = image.rgba_base64 else {
            continue;
        };
        let Ok(rgba) = general_purpose::STANDARD.decode(rgba_base64) else {
            continue;
        };
        let Some(raw) =
            ImageBuffer::<Rgba<u8>, _>::from_raw(image.width as u32, image.height as u32, rgba)
        else {
            continue;
        };
        let image = DynamicImage::ImageRgba8(raw).to_rgba8();
        let mut png = Vec::new();
        if image::codecs::png::PngEncoder::new(&mut png)
            .write_image(
                image.as_raw(),
                image.width(),
                image.height(),
                image::ExtendedColorType::Rgba8,
            )
            .is_err()
        {
            continue;
        }
        let migrated = ImageClipboardContent {
            width: image.width() as usize,
            height: image.height() as usize,
            png_base64: Some(general_purpose::STANDARD.encode(png)),
            rgba_base64: None,
            file_path: None,
        };
        let content = serde_json::to_string(&migrated).map_err(|error| error.to_string())?;
        conn.execute(
            "UPDATE clipboard_items SET content = ?1, updated_at = ?2 WHERE id = ?3",
            params![content, now(), id],
        )
        .map_err(|error| error.to_string())?;
    }
    Ok(())
}

fn now() -> String {
    Utc::now().to_rfc3339()
}

fn make_preview(content: &str) -> String {
    let compact = content.split_whitespace().collect::<Vec<_>>().join(" ");
    compact.chars().take(140).collect()
}

fn detect_kind(content: &str) -> ClipboardKind {
    let trimmed = content.trim();
    let lower = trimmed.to_ascii_lowercase();
    if is_hex_color(trimmed) {
        return ClipboardKind::Color;
    }
    if lower.starts_with("http://") || lower.starts_with("https://") {
        return ClipboardKind::Url;
    }
    if lower.ends_with(".pdf")
        || lower.ends_with(".doc")
        || lower.ends_with(".docx")
        || lower.ends_with(".xls")
        || lower.ends_with(".xlsx")
        || lower.ends_with(".ppt")
        || lower.ends_with(".pptx")
    {
        return ClipboardKind::Document;
    }
    ClipboardKind::Text
}

fn is_hex_color(value: &str) -> bool {
    value.len() == 7
        && value.starts_with('#')
        && value.as_bytes()[1..].iter().all(u8::is_ascii_hexdigit)
}
