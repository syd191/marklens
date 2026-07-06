# Architecture

MarkLens is an Electron + React desktop app for maintaining Markdown documents through fast reading, folder navigation, light source edits, and safe optional saving.

## Runtime Split

- Electron main process owns filesystem, dialogs, menus, file watching, and Windows integration.
- Preload exposes a small `window.markdownBridge` API through `contextBridge`.
- React renderer owns the reading UI, outline drawer, preferences, theme resolution, and source mode.

## Markdown Flow

1. Main process reads `.md`, `.markdown`, or `.txt` as UTF-8.
2. Renderer stores the current document in React state.
3. Markdown is split into chunks before rendering.
4. The first chunks render immediately.
5. Remaining chunks render in idle batches to keep the first screen responsive.
6. Mermaid diagrams render only when they approach the viewport.

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
