# Changelog

All notable changes to Clipboard Pro will be documented in this file.

## [0.1.6] - 2026-06-08

### Added

- Added official GitHub screenshots for history, item menu, preferences and collections.

### Changed

- Moved preferences into a dedicated in-window view that keeps search and navigation available.
- Improved tab sizing and native text selection behavior for the compact popup.

### Fixed

- Fixed item action menus so they render opaque and receive clicks instead of passing clicks through to list items.

## [0.1.5] - 2026-06-08

### Added

- Added persisted image clipboard entries with real thumbnails in the list.
- Added image paste support when selecting copied image entries.
- Added a settings toggle to enable or disable launch at system startup.

### Changed

- Removed the hidden startup webview so idle mode only keeps the native tray/background process alive.
- Close the popup webview after selection to reduce memory usage while idle.
- Configured Windows release builds as GUI apps so no console window opens.
## [0.1.4] - 2026-06-08

### Added

- Added system tray actions, startup launch and native paste-on-select behavior.
- Added automatic UI refresh when clipboard changes are detected.
- Added drag and drop from clipboard items into collections.

### Changed

- Compact popup window to avoid clipping and better match native clipboard UX.
- Reworked collections as an in-window category browser for many collections.
- Replaced runtime animation dependency with lightweight CSS animation.
## [0.1.3] - 2026-06-08

### Fixed

- Fixed CI dependency resolution by pinning `ts-interface-checker` to a published npm version.
## [0.1.2] - 2026-06-08

### Changed

- Added macOS Intel release build alongside Apple Silicon.
- Publish release assets directly from GitHub Actions.
## [0.1.1] - 2026-06-08

### Fixed

- Fixed SQLite collection query lifetime issue found by release builds.
- Updated Tauri bundle identifier for macOS compatibility.

## [0.1.0] - 2026-06-08

### Added

- Initial Tauri v2 + React + TypeScript + Rust project structure.
- Compact Clipboard Pro interface.
- Zustand store and Tauri command service.
- SQLite schema with FTS5 search.
- Clipboard item, collection and settings models.
- Commands for copy, search, pin, favorite, rename, edit, delete and collections.
- Open source documentation and community files.




