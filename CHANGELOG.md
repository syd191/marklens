# Changelog

All notable changes to MarkLens are documented here.

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
