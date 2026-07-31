# Changelog

All notable changes to Clipboard Pro will be documented in this file.

## [0.2.7] - 2026-07-31

### Changed

- Branded the Windows `.exe` installer and uninstaller with Clipboard Pro artwork, the app icon and Danny Maaz credits.

## [0.2.6] - 2026-07-31

### Fixed

- Repaired existing clipboard databases that could reject the Color history type and make the app exit during startup.
- Run expensive legacy image and search-index migrations only once, preventing large histories from blocking app launch.
- Keep the app available when another program already owns one of its global shortcuts.

## [0.2.1] - 2026-07-20

### Added

- Added manual primary-screen capture to the system clipboard, local image history and the user's Pictures folder.
- Added a visual global-shortcut recorder and twelve selectable accent colors.

### Fixed

- Prevented the clipboard monitor from adding a duplicate entry for an in-app screen capture.
- Updated Linux build dependencies for the cross-platform capture library.

## [0.2.0] - 2026-07-20

### Added

- Added selectable system, light and dark themes plus five local accent colors.
- Added a privacy control to pause clipboard capture without deleting saved items.
- Added configurable global shortcuts that are registered immediately on Windows, macOS and Linux.
- Added keyboard navigation for clipboard results and a visible in-app package version.
- Added an explicit confirmation before deleting clipboard items.

### Changed

- Image clipboard entries now use bounded PNG storage and compact thumbnails instead of raw RGBA payloads.
- Rebuilt search indexing during migration so image payloads are never indexed or loaded into history lists.

### Security

- Replaced the permissive webview CSP with a local-only policy.

## [0.1.10] - 2026-07-17

### Added

- Added signed in-app update checks with a direct install and restart flow.
- Added GitHub Release updater artifacts for Windows, macOS and Linux.

### Fixed

- Aligned updater packages across Rust and TypeScript for release builds.
- Added macOS-style left window controls for the custom title bar.
- Added native minimize and expand commands for the popup window.
- Hardened clipboard item deletion so collection relations and counters stay consistent.

## [0.1.8] - 2026-06-08

### Fixed

- Switched macOS Intel release automation to the current `macos-15-intel` GitHub-hosted runner label.

## [0.1.7] - 2026-06-08

### Changed

- Added a dedicated macOS Intel release job alongside Apple Silicon builds.
- Updated release automation to Node.js 24 for current GitHub Actions runners.
- Refreshed platform documentation for Windows `.exe`/`.msi`, macOS and Linux downloads.

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




