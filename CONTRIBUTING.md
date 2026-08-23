# Contributing

## Local Checks

Before submitting changes, run:

```bash
npm run check
```

Markdown rendering changes must cover document-level behavior, including TOC links matching heading IDs, footnotes whose definitions appear in later sections, and Front Matter with CRLF line endings or YAML comments.

For UI or Electron behavior changes, also build and smoke-test a packaged app:

```bash
npm run dist
```

Open the generated portable executable with a real `.md` file and verify:

- Sidebar is hidden by default.
- The bottom-left outline button opens the Outline tab.
- Files tab opens the current Markdown file's directory when a document is open.
- Files tab does not scan unrelated folders unless a folder is opened explicitly.
- Source mode opens and edits text.
- WYSIWYG/source round trips preserve tables, task lists, links, footnotes, TOCs, and Front Matter.
- Preferences opens and auto save remains off by default.
- External file changes never replace an unsaved editor buffer; an actual modification-time conflict prompts instead of silently overwriting the disk file.
- Light, Night, and Follow System themes work.

For EPUB changes, use the official [W3C/IDPF EPUB 3 samples](https://github.com/IDPF/epub3-samples) and verify at minimum:

- A reflowable book opens with title, author, TOC, pagination, scrolling, font sizing, and restored reading position.
- A fixed-layout book remains visually intact and fits the reader without MarkLens typography overrides.
- An Arabic RTL book advances in publication order and exposes correct Previous/Next labels.
- A Japanese vertical-writing book keeps vertical glyph flow and publication progression.
- A renamed non-ZIP `.epub` displays an actionable error rather than a blank surface.

## Code Style

- Keep React components small and domain-named.
- Keep Markdown parsing/rendering logic in `src/lib/markdown.ts`.
- Keep Electron filesystem access in the main process.
- Prefer typed helpers over stringly coupled UI logic.
- Add comments only when they explain non-obvious behavior or security/performance tradeoffs.

## Security Notes

Treat Markdown and EPUB files as untrusted input. Do not enable raw HTML/publication scripts or widen preload APIs without a clear reason and tests.
