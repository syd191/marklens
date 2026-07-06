# MarkLens

MarkLens is a free, open-source Markdown maintenance tool for Windows. It is designed for people who read, organize, review, and lightly update `.md` files without turning the whole screen into an editor.

MarkLens keeps the document first: the sidebar is hidden by default, the outline is the primary navigation surface, and the file tree appears only when it is useful.

## Screenshots

Document-first reading view:

![MarkLens reading view](docs/screenshots/reading-night.png)

Outline-first navigation:

![MarkLens outline view](docs/screenshots/outline-night.png)

Current-folder file browsing:

![MarkLens files view](docs/screenshots/files-night.png)

## What It Does

- Opens `.md`, `.markdown`, and `.txt` files.
- Shows a clean Markdown preview by default.
- Generates a document outline and lets you jump between headings.
- Shows the current file's folder in the Files tab and selects the open file.
- Supports source mode for light edits.
- Keeps auto save off by default; users must enable it explicitly.
- Exports the current document to HTML.
- Supports Light, Night, and Follow System themes.
- Follows the system language by default, with Simplified Chinese and English UI.

## Markdown Support

- GFM tables and task lists
- Code highlighting
- Local and remote images
- Links
- KaTeX math
- Mermaid diagrams

## Performance Approach

MarkLens is built to make opening and browsing Markdown feel immediate:

- The window waits until the first UI is ready before showing.
- The initial HTML shell applies the saved/system theme before React loads to reduce white flashes.
- Long Markdown files are split into chunks.
- The first chunks render first; remaining chunks render during idle time.
- Outline generation is deferred by default and runs when needed.
- Mermaid diagrams render near the viewport instead of during the first paint.
- The file tree scans lazily by directory.

## Safety Defaults

- Raw HTML inside Markdown is escaped.
- Electron context isolation and sandbox mode are enabled.
- File access is limited to Markdown-like text files.
- Auto save is opt-in and checks the file modification time before writing.

## Development

Requirements:

- Windows
- Node.js 22 or newer

Install dependencies:

```bash
npm install
```

Run locally:

```bash
npm run dev
```

Run checks:

```bash
npm run check
```

Build Windows installer and portable executable:

```bash
npm run dist
```

Build artifacts are written to `../../outputs` from this project folder.

## Project Structure

- `electron/`: Electron main process and preload bridge.
- `src/components/`: React UI components.
- `src/lib/markdown.ts`: Markdown chunking, outline extraction, and rendering.
- `src/lib/i18n.ts`: Chinese / English UI strings and language resolution.
- `assets/`: App icon source files.
- `docs/`: Architecture and maintenance notes.

## License

MIT.
