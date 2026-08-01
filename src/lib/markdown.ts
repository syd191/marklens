import MarkdownIt from "markdown-it";
import { katex as markdownItKatex } from "@mdit/plugin-katex";
import markdownItAnchor from "markdown-it-anchor";
import markdownItTaskLists from "markdown-it-task-lists";
import markdownItFootnote from "markdown-it-footnote";
import markdownItTocDoneRight from "markdown-it-toc-done-right";
import hljs from "highlight.js/lib/core";
// 按需注册常用语言，避免全量导入 ~1MB（180+ 语言）。主路径 MDXEditor 用 CodeMirror 高亮，
// hljs 仅服务于导出 HTML / 复制 HTML，常用语言覆盖足够，未注册的语言回退为纯文本。
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import css from "highlight.js/lib/languages/css";
import json from "highlight.js/lib/languages/json";
import bash from "highlight.js/lib/languages/bash";
import shell from "highlight.js/lib/languages/shell";
import python from "highlight.js/lib/languages/python";
import sql from "highlight.js/lib/languages/sql";
import markdown from "highlight.js/lib/languages/markdown";
import type { MarkdownChunk, OutlineItem } from "../types";

hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("js", javascript);
hljs.registerLanguage("jsx", javascript);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("ts", typescript);
hljs.registerLanguage("tsx", typescript);
hljs.registerLanguage("xml", xml);
hljs.registerLanguage("html", xml);
hljs.registerLanguage("css", css);
hljs.registerLanguage("json", json);
hljs.registerLanguage("bash", bash);
hljs.registerLanguage("sh", bash);
hljs.registerLanguage("shell", shell);
hljs.registerLanguage("powershell", shell);
hljs.registerLanguage("python", python);
hljs.registerLanguage("py", python);
hljs.registerLanguage("sql", sql);
hljs.registerLanguage("markdown", markdown);
hljs.registerLanguage("md", markdown);

const HEADING_RE = /^(#{1,6})\s+(.+?)\s*#*\s*$/;
const FENCE_RE = /^(```|~~~)/;
const markdownUtils = new MarkdownIt();
type RenderRule = NonNullable<MarkdownIt["renderer"]["rules"][string]>;

export function encodeFileUrlPath(value: string) {
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
  // 脚注渲染：将 [^1] 转换为可点击的脚注引用与文末列表
  md.use(markdownItFootnote);
  // 目录渲染：将 [TOC] / [[toc]] 替换为实际目录，标题锚点复用项目 slugify 保持一致
  md.use(markdownItTocDoneRight, {
    placeholder: "(\\[TOC\\]|\\[\\[toc\\]\\])",
    slugify,
    listType: "ul"
  });

  // front-matter 处理：渲染前剥离 YAML front-matter 块，避免它被当作分隔线/正文显示。
  // 通过 core 规则在 block 解析前移除首部 --- 闭合块。
  md.core.ruler.before("normalize", "strip_front_matter", (state) => {
    const src = state.src;
    if (!src.startsWith("---\n")) return false;
    const end = src.indexOf("\n---", 4);
    if (end === -1) return false;
    // 跳过结束标记后的换行
    const after = src.indexOf("\n", end + 4);
    state.src = after === -1 ? "" : src.slice(after + 1);
    return false;
  });

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

/**
 * 将渲染后 HTML 中的 mermaid 占位符（<pre class="mermaid-pending" data-mermaid="...">）
 * 预渲染为 SVG 字符串，使导出的 HTML 文件自包含、可离线查看。
 * 在渲染进程调用（mermaid 通过动态 import 加载）。
 */
export async function renderMermaidDiagrams(html: string, isDark: boolean): Promise<string> {
  if (!html.includes("mermaid-pending")) return html;
  const mermaid = (await import("mermaid")).default;
  mermaid.initialize({ startOnLoad: false, theme: isDark ? "dark" : "default", securityLevel: "strict" });

  const placeholder = /<pre class="mermaid mermaid-pending" data-mermaid="([^"]*)">[^<]*<\/pre>/g;
  const matches = Array.from(html.matchAll(placeholder));
  if (!matches.length) return html;

  const replacements: { original: string; svg: string }[] = [];
  for (const match of matches) {
    const original = match[0];
    const source = decodeURIComponent(match[1]);
    try {
      const id = `mermaid-export-${replacements.length}`;
      const { svg } = await mermaid.render(id, source);
      replacements.push({ original, svg: `<div class="mermaid-shell">${svg}</div>` });
    } catch {
      replacements.push({ original, svg: `<div class="mermaid-shell"><pre>Diagram failed to render.</pre></div>` });
    }
  }
  let result = html;
  for (const { original, svg } of replacements) {
    result = result.replace(original, svg);
  }
  return result;
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
