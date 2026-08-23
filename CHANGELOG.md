# Changelog

All notable changes to MarkLens are documented here.

## 0.3.1 - 2026-08-24

### Added

- Add mouse-wheel and trackpad page turns to paginated and fixed-layout EPUB reading.

### Changed

- Accumulate small wheel deltas and apply a navigation cooldown so high-resolution trackpads and inertial scrolling do not skip several pages.
- Keep continuous EPUB scrolling native while wheel pagination follows the publication's logical reading order, including RTL books.

### Tested

- Cover pixel, line, and page wheel-delta modes with automated tests, plus forward/backward pagination and continuous scrolling in the desktop reader.

## 0.3.0 - 2026-08-24

### Added

- Add read-only EPUB 2/3 support using a pinned foliate-js engine behind a MarkLens adapter.
- Add polished paginated and scrolling reading modes with table of contents, font controls, chapter navigation, progress seeking, and per-book location persistence.
- Support fixed-layout publications, right-to-left progression, vertical writing, localized metadata, drag-and-drop, recent books, command-line opening, and Windows `.epub` file association.
- Add actionable errors for empty, oversized, corrupt, malformed, encrypted, and DRM-protected publications.

### Changed

- Lazy-load the EPUB reader and engine so Markdown startup and editing bundles remain unchanged.
- Apply MarkLens themes only to reflowable EPUB content while preserving fixed-layout geometry and publication-defined writing modes.
- Harden renderer navigation and EPUB frames with validated external URLs and a strict content security policy that blocks publication scripts.

### Tested

- Validate against official W3C/IDPF samples for reflowable English, fixed-layout comics, Arabic RTL progression, and Japanese vertical writing.

## 0.2.4 - 2026-08-19

### Added

- Add a normal ZIP distribution for managed enterprise deployment and an optional per-machine MSI build (`npm run dist:enterprise`).
- Add post-build validation with SHA-256 hashes, required runtime-file checks, signature reporting, and a machine-readable build manifest.
- Add local startup diagnostics for page-load, renderer, GPU child-process, and unresponsive-window failures.

### Changed

- Make the default NSIS installer one-click per-user, stop auto-launching after install, use normal compression, and force the compatible BCJ executable filter.
- Preserve SwiftShader/Vulkan software-rendering files and Traditional Chinese Electron locale resources for heterogeneous enterprise PCs.

### Fixed

- Prevent ordinary or unclosed `---` thematic breaks from being misclassified as YAML front matter and hiding document content.
- Restore readable rich-editor text colors when the MDXEditor stylesheet is loaded lazily in dark themes.
- Render math, Mermaid, footnotes, table of contents, and raw HTML safely through the complete document preview instead of silently dropping or approximating them in rich mode.
- Show valid YAML front matter as visible document properties with a source-edit path rather than an empty rich-text block.

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
