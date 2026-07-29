# Architecture

MarkLens is an Electron + React desktop app for editing and maintaining Markdown documents through a Typora-inspired WYSIWYG surface, source editing, folder navigation, and safe optional saving.

## Runtime Split

- Electron main process owns filesystem, dialogs, menus, file watching, and Windows integration.
- Preload exposes a small `window.markdownBridge` API through `contextBridge`.
- React renderer owns the WYSIWYG/source editors, outline and file drawers, preferences, theme resolution, find/replace, and view modes.

## Markdown Flow

1. Main process reads `.md`, `.markdown`, or `.txt` as UTF-8.
2. Renderer stores the current document in React state.
3. The normal editing surface parses Markdown into an editable Lexical document and serializes edits back to Markdown.
4. Source mode applies pure text transformations from `src/lib/editorCommands.ts`.
5. The read-only preview path still splits long Markdown into chunks and renders later chunks in idle batches.
6. Mermaid diagrams render only when they approach the viewport.

## Command Flow

1. Electron builds the native File, Edit, Paragraph, Format, View, Themes, and Help menus.
2. Menu clicks are sent as named commands to the focused renderer window.
3. The rich editor handles semantic block and inline operations directly.
4. Commands not representable in the rich editor fall back to source mode without discarding Markdown.
5. File, image, export, print, zoom, and window operations cross the preload bridge and are validated in the main process.

## Performance Boundaries

- File tree scanning is lazy and directory-based.
- Outline generation is deferred by default and can be preloaded through the `preloadOutline` preference.
- Large documents avoid one giant render pass.
- Images use lazy loading.
- Startup applies the saved/system theme in `index.html` before React loads, reducing light flashes in night mode.

## Security Boundaries

- Raw Markdown HTML is disabled.
- Renderer uses `contextIsolation` and Electron sandbox mode.
- The preload API exposes only specific file/dialog/theme operations.
- Auto save is off by default and checks file modification time before writing.
