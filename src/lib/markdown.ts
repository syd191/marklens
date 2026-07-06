import MarkdownIt from "markdown-it";
import { katex as markdownItKatex } from "@mdit/plugin-katex";
import markdownItAnchor from "markdown-it-anchor";
import markdownItTaskLists from "markdown-it-task-lists";
import hljs from "highlight.js";
import type { MarkdownChunk, OutlineItem } from "../types";

const HEADING_RE = /^(#{1,6})\s+(.+?)\s*#*\s*$/;
const FENCE_RE = /^(```|~~~)/;
const markdownUtils = new MarkdownIt();
type RenderRule = NonNullable<MarkdownIt["renderer"]["rules"][string]>;

function encodeFileUrlPath(value: string) {
  // markdown-it normalizes spaces to %20 before renderer rules run; decode
  // first so local image paths are not double-encoded to %2520.
  try {
    return encodeURI(decodeURI(value));
  } catch {
    return encodeURI(value);
  }
}

export function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[`*_~[\](){}<>]/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function headingId(text: string, chunkIndex: number, headingIndex: number): string {
  return `${slugify(text) || "heading"}-${chunkIndex}-${headingIndex}`;
}

export function splitMarkdownIntoChunks(markdown: string): MarkdownChunk[] {
  const lines = markdown.split(/\r?\n/);
  const chunks: MarkdownChunk[] = [];
  let buffer: string[] = [];
  let bufferChars = 0;
  let startLine = 0;
  let inFence = false;
  const maxLines = 140;
  const maxChars = 12000;

  const flush = () => {
    if (!buffer.length) return;
    chunks.push({ index: chunks.length, startLine, text: buffer.join("\n") });
    buffer = [];
    bufferChars = 0;
  };

  lines.forEach((line, lineIndex) => {
    const isFence = FENCE_RE.test(line.trim());
    if (isFence) inFence = !inFence;

    const startsHeading = !inFence && HEADING_RE.test(line);
    const shouldSplit =
      buffer.length > 0 &&
      (startsHeading || buffer.length >= maxLines || bufferChars >= maxChars);

    if (shouldSplit) {
      flush();
      startLine = lineIndex;
    }

    buffer.push(line);
    bufferChars += line.length + 1;
  });

  flush();
  return chunks.length ? chunks : [{ index: 0, startLine: 0, text: "" }];
}

export function buildOutline(chunks: MarkdownChunk[]): OutlineItem[] {
  const items: OutlineItem[] = [];

  chunks.forEach((chunk) => {
    let inFence = false;
    let localHeadingIndex = 0;
    chunk.text.split(/\r?\n/).forEach((line, offset) => {
      if (FENCE_RE.test(line.trim())) {
        inFence = !inFence;
        return;
      }
      if (inFence) return;

      const match = line.match(HEADING_RE);
      if (!match) return;

      const text = match[2].replace(/[#*_`~]/g, "").trim();
      items.push({
        id: headingId(text, chunk.index, localHeadingIndex),
        text,
        level: match[1].length,
        line: chunk.startLine + offset + 1
      });
      localHeadingIndex += 1;
    });
  });

  return items;
}

export function createMarkdownRenderer(baseDirectory: string | null) {
  const md: MarkdownIt = new MarkdownIt({
    // Markdown files are treated as untrusted input; plugin-rendered math and
    // diagrams are allowed, but raw HTML is escaped by default.
    html: false,
    linkify: true,
    typographer: true,
    highlight(code: string, lang: string): string {
      if (lang && hljs.getLanguage(lang)) {
        try {
          return `<pre class="hljs"><code>${hljs.highlight(code, { language: lang, ignoreIllegals: true }).value}</code></pre>`;
        } catch {
          // Fall through to escaped plaintext.
        }
      }
      return `<pre class="hljs"><code>${markdownUtils.utils.escapeHtml(code)}</code></pre>`;
    }
  });

  md.use(markdownItTaskLists, { enabled: true, label: true, labelAfter: true });
  md.use(markdownItKatex);
  md.use(markdownItAnchor, { permalink: false, slugify });

  const defaultFence = md.renderer.rules.fence as RenderRule;
  md.renderer.rules.fence = ((tokens, idx, options, env, self) => {
    const token = tokens[idx];
    const lang = token.info.trim().split(/\s+/)[0].toLowerCase();
    if (lang === "mermaid") {
      const encoded = encodeURIComponent(token.content);
      return `<div class="mermaid-shell"><pre class="mermaid mermaid-pending" data-mermaid="${encoded}">Loading diagram...</pre></div>`;
    }
    return defaultFence(tokens, idx, options, env, self);
  }) as RenderRule;

  const defaultHeadingOpen =
    md.renderer.rules.heading_open ??
    (((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options)) as RenderRule);
  md.renderer.rules.heading_open = ((tokens, idx, options, env: { chunkIndex?: number; headingIndex?: number }, self) => {
    const inline = tokens[idx + 1];
    const text = inline?.content ?? "heading";
    const localIndex = env.headingIndex ?? 0;
    tokens[idx].attrSet("id", headingId(text, env.chunkIndex ?? 0, localIndex));
    env.headingIndex = localIndex + 1;
    return defaultHeadingOpen(tokens, idx, options, env, self);
  }) as RenderRule;

  const defaultImage =
    md.renderer.rules.image ??
    (((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options)) as RenderRule);
  md.renderer.rules.image = ((tokens, idx, options, env, self) => {
    const src = tokens[idx].attrGet("src");
    if (src && baseDirectory && !/^(https?:|file:|data:|#)/i.test(src)) {
      const normalized = `${baseDirectory.replace(/\\/g, "/").replace(/\/$/, "")}/${src.replace(/^\.\//, "")}`;
      tokens[idx].attrSet("src", `file:///${encodeFileUrlPath(normalized)}`);
    }
    tokens[idx].attrSet("loading", "lazy");
    return defaultImage(tokens, idx, options, env, self);
  }) as RenderRule;

  return md;
}

export function renderMarkdownChunk(
  chunk: MarkdownChunk,
  baseDirectory: string | null,
  md = createMarkdownRenderer(baseDirectory)
): string {
  return md.render(chunk.text, { chunkIndex: chunk.index, headingIndex: 0 });
}

export function renderMarkdownChunks(chunks: MarkdownChunk[], baseDirectory: string | null) {
  const md = createMarkdownRenderer(baseDirectory);
  return chunks.map((chunk) => ({ ...chunk, html: renderMarkdownChunk(chunk, baseDirectory, md) }));
}

export function renderMarkdownDocument(markdown: string, baseDirectory: string | null): string {
  return renderMarkdownChunks(splitMarkdownIntoChunks(markdown), baseDirectory)
    .map((chunk) => chunk.html)
    .join("\n");
}

export function getWordCount(markdown: string): number {
  const cjk = markdown.match(/[\u4e00-\u9fff]/g)?.length ?? 0;
  const words = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[\u4e00-\u9fff]/g, " ")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  return cjk + words;
}
