use crate::domain::models::{AppSettings, ClipboardItem, ClipboardKind, Collection};
use chrono::Utc;
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
        let data_dir = app.path().app_data_dir().map_err(|error| error.to_string())?;
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
        let conn = self.conn.lock().map_err(|error| error.to_string())?;
        let mut stmt = conn
            .prepare(
                "SELECT id, title, content, preview, thumbnail, kind, is_pinned, is_favorite, created_at, updated_at, last_used_at
                 FROM clipboard_items
                 ORDER BY is_pinned DESC, created_at DESC",
            )
            .map_err(|error| error.to_string())?;
        let raw_items = stmt
            .query_map([], map_raw_item)
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
                "SELECT ci.id, ci.title, ci.content, ci.preview, ci.thumbnail, ci.kind, ci.is_pinned, ci.is_favorite,
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
        self.create_typed_item(detect_kind(content).as_str(), content, &make_preview(content), None)
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
             WHERE id = ?5 AND kind IN ('text', 'url')",
            params![content, make_preview(content), kind.as_str(), now(), id],
        )
        .map_err(|error| error.to_string())?;
        self.fetch_item_locked(&conn, id)
    }

    pub fn delete_item(&self, id: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|error| error.to_string())?;
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
                "SELECT c.id, c.name, COUNT(ci.item_id) AS item_count, c.created_at, c.updated_at
                 FROM collections c
                 LEFT JOIN collection_items ci ON ci.collection_id = c.id
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
        conn.execute("DELETE FROM collections WHERE id = ?1", params![id])
            .map_err(|error| error.to_string())?;
        Ok(())
    }

    pub fn add_to_collection(&self, item_id: &str, collection_id: &str) -> Result<ClipboardItem, String> {
        let conn = self.conn.lock().map_err(|error| error.to_string())?;
        let now = now();
        conn.execute(
            "INSERT OR IGNORE INTO collection_items(item_id, collection_id, created_at) VALUES (?1, ?2, ?3)",
            params![item_id, collection_id, now],
        )
        .map_err(|error| error.to_string())?;
        self.fetch_item_locked(&conn, item_id)
    }

    pub fn remove_from_collection(&self, item_id: &str, collection_id: &str) -> Result<ClipboardItem, String> {
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
            shortcut: self.get_setting_locked(&conn, "shortcut", "Ctrl+Alt+V")?,
            theme: self.get_setting_locked(&conn, "theme", "system")?,
            auto_start: self.get_setting_bool_locked(&conn, "auto_start", false)?,
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
        let conn = self.conn.lock().map_err(|error| error.to_string())?;
        conn.execute(
            "INSERT INTO settings(key, value) VALUES ('auto_start', ?1)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            params![auto_start.to_string()],
        )
        .map_err(|error| error.to_string())?;
        drop(conn);
        self.get_settings()
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

    fn hydrate_item(&self, conn: &Connection, raw: RawItem, include_content: bool) -> Result<ClipboardItem, String> {
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
            "SELECT c.id, c.name, COUNT(ci.item_id) AS item_count, c.created_at, c.updated_at
             FROM collections c
             LEFT JOIN collection_items ci ON ci.collection_id = c.id
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

    fn get_setting_locked(&self, conn: &Connection, key: &str, fallback: &str) -> Result<String, String> {
        conn.query_row("SELECT value FROM settings WHERE key = ?1", params![key], |row| row.get(0))
            .optional()
            .map_err(|error| error.to_string())
            .map(|value| value.unwrap_or_else(|| fallback.to_string()))
    }

    fn get_setting_i64_locked(&self, conn: &Connection, key: &str, fallback: i64) -> Result<i64, String> {
        let value = self.get_setting_locked(conn, key, &fallback.to_string())?;
        Ok(value.parse::<i64>().unwrap_or(fallback))
    }

    fn get_setting_bool_locked(&self, conn: &Connection, key: &str, fallback: bool) -> Result<bool, String> {
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
    let _ = conn.execute("ALTER TABLE clipboard_items ADD COLUMN thumbnail TEXT", []);
    conn.execute(
        "INSERT OR IGNORE INTO settings(key, value) VALUES ('auto_start', 'false')",
        [],
    )
    .map_err(|error| error.to_string())?;
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
