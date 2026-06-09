PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA foreign_keys = ON;
PRAGMA temp_store = MEMORY;

CREATE TABLE IF NOT EXISTS clipboard_items (
  id TEXT PRIMARY KEY,
  title TEXT,
  content TEXT NOT NULL,
  preview TEXT NOT NULL,
  thumbnail TEXT,
  kind TEXT NOT NULL CHECK (kind IN ('text', 'url', 'image', 'document')),
  is_pinned INTEGER NOT NULL DEFAULT 0,
  is_favorite INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_used_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_clipboard_items_created_at ON clipboard_items(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clipboard_items_pinned ON clipboard_items(is_pinned, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clipboard_items_favorite ON clipboard_items(is_favorite, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clipboard_items_kind ON clipboard_items(kind);

CREATE TABLE IF NOT EXISTS collections (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS collection_items (
  item_id TEXT NOT NULL,
  collection_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (item_id, collection_id),
  FOREIGN KEY (item_id) REFERENCES clipboard_items(id) ON DELETE CASCADE,
  FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_collection_items_collection ON collection_items(collection_id);
CREATE INDEX IF NOT EXISTS idx_collection_items_item ON collection_items(item_id);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE VIRTUAL TABLE IF NOT EXISTS item_search USING fts5(
  item_id UNINDEXED,
  title,
  content,
  preview,
  tokenize = 'unicode61 remove_diacritics 2'
);

CREATE TRIGGER IF NOT EXISTS clipboard_items_ai AFTER INSERT ON clipboard_items BEGIN
  INSERT INTO item_search(item_id, title, content, preview)
  VALUES (new.id, coalesce(new.title, ''), new.content, new.preview);
END;

CREATE TRIGGER IF NOT EXISTS clipboard_items_au AFTER UPDATE ON clipboard_items BEGIN
  UPDATE item_search
  SET title = coalesce(new.title, ''), content = new.content, preview = new.preview
  WHERE item_id = new.id;
END;

CREATE TRIGGER IF NOT EXISTS clipboard_items_ad AFTER DELETE ON clipboard_items BEGIN
  DELETE FROM item_search WHERE item_id = old.id;
END;

INSERT OR IGNORE INTO settings(key, value) VALUES
  ('history_limit', '50'),
  ('shortcut', 'Ctrl+Alt+V'),
  ('theme', 'system'),
  ('auto_start', 'false');
