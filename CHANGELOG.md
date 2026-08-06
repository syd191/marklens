# Changelog

All notable changes to MarkLens are documented here.

## 0.2.3 - 2026-08-06

### Added

- Add a custom HTML menu bar that follows the active theme (including menu colors), replacing the native menu while preserving all shortcuts.
- Add Traditional Chinese (`zh-TW`) interface support; the language follows the system by default and can be changed in Preferences.
- Make the title bar overlay and window background match the active theme.

### Changed

- Default to source (edit) mode so the caret is visible immediately on startup.
- Improve startup and typing performance: lazy-load the rich-text editor, reduce word-count scans, compute the outline/word count only when needed, and stabilize editor component props.
- Make Zoom In / Zoom Out actually scale the window instead of only updating the status-bar percentage.

### Fixed

- Zoom In / Zoom Out now take effect on the actual window scale.
- Switching themes no longer steals focus from an open modal dialog (Preferences / About / word count / find & replace).
- Word count no longer includes digits or CJK characters inside code blocks, URLs, or HTML tags.
- Prevent an unnecessary "save on close" prompt when the content has not changed.

## 0.2.2 - 2026-08-02

### Added

- Add a polished in-app About panel with the MarkLens project identity, GitHub repository link, and a high-correction QR code decorated with the GitHub mark.

### Changed

- Rewrite the About copy around Markdown writing, reading, organization, and maintainability.

## 0.2.1 - 2026-08-01

### Fixed

- Render document-level TOCs, cross-section footnotes, and YAML Front Matter correctly during HTML export and copy.
- Keep TOC links and generated heading IDs aligned while preserving chunk-specific IDs in progressive previews.
- Prevent late save completions and automatic external refreshes from replacing newer editor content.
- Restore strict modification-time conflict detection so recent external edits are not silently overwritten.
- Calculate source-editor cursor and typewriter positions from the textarea's current value.

### Changed

- Keep Electron IPC subscriptions stable while dispatching commands through the latest React handlers.
- Expand Chinese and English project documentation for the WYSIWYG workflow, current Markdown support, performance boundaries, and Windows artifacts.

## 0.2.0

- Added the Typora-inspired WYSIWYG editing surface, complete desktop menus, file workflows, themes, source-mode commands, and performance improvements.
