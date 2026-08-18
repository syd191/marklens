import MarkdownIt from "markdown-it";
import { katex as markdownItKatex } from "@mdit/plugin-katex";
import markdownItAnchor from "markdown-it-anchor";
import markdownItTaskLists from "markdown-it-task-lists";
import markdownItFootnote from "markdown-it-footnote";
import markdownItTocDoneRight from "markdown-it-toc-done-right";
import DOMPurify from "dompurify";
import { parse as parseYaml } from "yaml";
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
type MarkdownRenderEnv = {
  chunkIndex?: number;
  headingIndex?: number;
  documentMode?: boolean;
};

const SAFE_URI_RE = /^(?:(?:https?|mailto|tel|file):|[^a-z]|[a-z+.-]+(?:[^a-z+.-:]|$))/i;

function sanitizeRenderedHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true, mathMl: true, svg: true },
    ALLOWED_URI_REGEXP: SAFE_URI_RE
  });
}

export type MarkdownFrontMatter = {
  content: string;
  data: Record<string, unknown>;
  endLine: number;
};

export type RichMarkdownFeature = "frontmatter" | "math" | "mermaid" | "footnote" | "toc" | "raw-html";

export type RichMarkdownCompatibility = {
  features: RichMarkdownFeature[];
  requiresDocumentPreview: boolean;
};

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * Front matter is an extension rather than CommonMark syntax, so `---` is
 * ambiguous with a thematic break. Only treat a closed block as front matter
 * when its contents parse to a non-empty YAML mapping. This mirrors document
 * property editors and prevents ordinary horizontal rules from hiding text.
 */
export function parseMarkdownFrontMatter(markdown: string): MarkdownFrontMatter | null {
  const lines = markdown.split(/\r?\n/);
  if (lines[0]?.trim() !== "---") return null;

  const endLine = lines.findIndex((line, index) => index > 0 && /^(---|\.\.\.)\s*$/.test(line));
  if (endLine < 0) return null;

  const content = lines.slice(1, endLine).join("\n");
  if (!content.trim() || content.length > 64 * 1024) return null;
  // The embedded rich editor currently depends on js-yaml. Reject merge keys,
  // aliases and explicit complex tags before that parser sees the block; a
  // document-properties panel only needs a plain mapping.
  if (/^\s*<<\s*:/m.test(content) || /(?:^|\s)[&*][\w-]+/.test(content) || /!!(?:omap|pairs|set)\b/.test(content)) {
    return null;
  }

  try {
    const data = parseYaml(content);
    if (!isPlainRecord(data) || Object.keys(data).length === 0) return null;
    return { content, data, endLine };
  } catch {
    return null;
  }
}

function strictFrontMatterPlugin(md: MarkdownIt) {
  md.block.ruler.before("table", "front_matter", (state, startLine, _endLine, silent) => {
    if (startLine !== 0) return false;
    const frontMatter = parseMarkdownFrontMatter(state.src);
    if (!frontMatter) return false;
    if (silent) return true;

    const token = state.push("front_matter", "", 0);
    token.block = true;
    token.hidden = true;
    token.map = [0, frontMatter.endLine + 1];
    token.markup = "---";
    token.content = frontMatter.content;
    token.meta = frontMatter.data;
    state.line = frontMatter.endLine + 1;
    return true;
  }, { alt: ["paragraph", "reference", "blockquote", "list"] });

  md.renderer.rules.front_matter = () => "";
}

/**
 * MDXEditor does not render these extensions faithfully. Detect them outside
 * fenced/inline code so the app can use the complete document renderer instead
 * of silently hiding content or showing an incorrect approximation.
 */
export function analyzeRichMarkdownCompatibility(markdown: string): RichMarkdownCompatibility {
  const features = new Set<RichMarkdownFeature>();
  const lines = markdown.split(/\r?\n/);
  const frontMatter = parseMarkdownFrontMatter(markdown);
  if (frontMatter) features.add("frontmatter");
  let inFence = false;
  let fenceMarker = "";

  lines.forEach((line, index) => {
    if (frontMatter && index <= frontMatter.endLine) return;

    const fence = line.match(/^\s*(`{3,}|~{3,})\s*([^\s]*)/);
    if (fence) {
      const marker = fence[1][0];
      if (!inFence) {
        inFence = true;
        fenceMarker = marker;
        if (fence[2].toLowerCase() === "mermaid") features.add("mermaid");
      } else if (marker === fenceMarker) {
        inFence = false;
        fenceMarker = "";
      }
      return;
    }
    if (inFence) return;

    const visible = line.replace(/`[^`]*`/g, "");
    if (/\$\$|(^|[^\\])\$(?!\s)(?:[^$]|\\\$)+\$/.test(visible)) features.add("math");
    if (/\[\^[^\]]+\]|^\s*\[\^[^\]]+\]:/.test(visible)) features.add("footnote");
    if (/^\s*(\[TOC\]|\[\[toc\]\])\s*$/i.test(visible)) features.add("toc");
    if (/<\/?[A-Za-z][^>]*>/.test(visible)) features.add("raw-html");
  });

  return { features: Array.from(features), requiresDocumentPreview: features.size > 0 };
}

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
  const frontMatter = parseMarkdownFrontMatter(markdown);
  const chunks: MarkdownChunk[] = [];
  let buffer: string[] = [];
  let bufferChars = 0;
  let startLine = 0;
  let inFence = false;
  let inFrontMatter = frontMatter !== null;
  const maxLines = 140;
  const maxChars = 12000;

  const flush = () => {
    if (!buffer.length) return;
    chunks.push({ index: chunks.length, startLine, text: buffer.join("\n") });
    buffer = [];
    bufferChars = 0;
  };

  lines.forEach((line, lineIndex) => {
    const isFrontMatterLine = inFrontMatter;
    if (inFrontMatter && lineIndex === frontMatter?.endLine) {
      inFrontMatter = false;
    }
    const isFence = !isFrontMatterLine && FENCE_RE.test(line.trim());
    if (isFence) inFence = !inFence;

    const startsHeading = !inFence && !isFrontMatterLine && HEADING_RE.test(line);
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
    const lines = chunk.text.split(/\r?\n/);
    const frontMatter = chunk.index === 0 ? parseMarkdownFrontMatter(chunk.text) : null;
    let inFrontMatter = frontMatter !== null;
    lines.forEach((line, offset) => {
      if (inFrontMatter) {
        if (offset === frontMatter?.endLine) inFrontMatter = false;
        return;
      }
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
    // Parse raw HTML for Markdown compatibility, then sanitize the complete
    // rendered document before it reaches the DOM.
    html: true,
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
  md.use(strictFrontMatterPlugin);

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
  md.renderer.rules.heading_open = ((tokens, idx, options, env: MarkdownRenderEnv, self) => {
    // 分块预览需要包含块索引的稳定 ID；整篇文档渲染则保留 anchor
    // 插件生成的 slug，确保 TOC 链接与标题 ID 一致。
    if (env.documentMode) return defaultHeadingOpen(tokens, idx, options, env, self);
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
  return sanitizeRenderedHtml(md.render(chunk.text, { chunkIndex: chunk.index, headingIndex: 0 }));
}

export function renderMarkdownChunks(chunks: MarkdownChunk[], baseDirectory: string | null) {
  const md = createMarkdownRenderer(baseDirectory);
  return chunks.map((chunk) => ({ ...chunk, html: renderMarkdownChunk(chunk, baseDirectory, md) }));
}

export function renderMarkdownDocument(markdown: string, baseDirectory: string | null): string {
  // TOC、脚注和 front matter 都具有文档级语义，必须在同一次 MarkdownIt
  // 解析中处理；分块只用于交互式只读预览的渐进渲染。
  return sanitizeRenderedHtml(createMarkdownRenderer(baseDirectory).render(markdown, { documentMode: true }));
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

const WORD_COUNT_CJK_RE = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu;
// 数字：每个数字字符单独计 1（如 "111" 计 3，而不是当一个整词计 1）
const WORD_COUNT_DIGIT_RE = /\p{N}/gu;
// 单次扫描移除：围栏代码块、行内代码、URL、HTML 标签（用 | 合并，减少全量扫描次数）
const WORD_COUNT_STRIP_RE = /```[\s\S]*?```|`[^`]*`|https?:\/\/\S+|<[^>]+>/g;
const WORD_COUNT_NON_WORD_RE = /[^\p{L}\s-]/gu;

export function getWordCount(markdown: string): number {
  // 先剥离围栏代码块/行内代码/URL/HTML 标签，统一在剥离后的文本上统计，
  // 保证代码/URL/HTML 内部的字符不会被计入（与词数统计口径一致）
  const stripped = markdown.replace(WORD_COUNT_STRIP_RE, " ");
  // CJK 字符数（汉字/日文假名/韩文），每个字符算一个字
  const cjk = stripped.match(WORD_COUNT_CJK_RE)?.length ?? 0;
  // 数字字符数：每个数字（含全角）算一个字
  const digits = stripped.match(WORD_COUNT_DIGIT_RE)?.length ?? 0;
  // 拉丁词数：再移除 CJK、数字与符号，按空白拆分
  const words = stripped
    .replace(WORD_COUNT_CJK_RE, " ")
    .replace(WORD_COUNT_DIGIT_RE, " ")
    .replace(WORD_COUNT_NON_WORD_RE, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  return cjk + digits + words;
}
