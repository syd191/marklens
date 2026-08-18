import { describe, expect, it } from "vitest";
import {
  analyzeRichMarkdownCompatibility,
  buildOutline,
  getWordCount,
  renderMarkdownDocument,
  renderMarkdownChunk,
  parseMarkdownFrontMatter,
  slugify,
  splitMarkdownIntoChunks
} from "./markdown";

describe("markdown rendering", () => {
  it("builds an outline while ignoring headings inside fenced code", () => {
    const chunks = splitMarkdownIntoChunks("# Title\n\n```md\n# Not a heading\n```\n\n## 子标题");
    const outline = buildOutline(chunks);

    expect(outline.map((item) => item.text)).toEqual(["Title", "子标题"]);
    expect(outline.map((item) => item.level)).toEqual([1, 2]);
  });

  it("keeps front matter together and excludes YAML comments from the outline", () => {
    const chunks = splitMarkdownIntoChunks("---\ntitle: Hello\n# yaml comment\n---\n\n# Body");
    const outline = buildOutline(chunks);

    expect(chunks[0].text).toContain("# yaml comment\n---");
    expect(outline.map((item) => item.text)).toEqual(["Body"]);
  });

  it("does not mistake an unclosed leading horizontal rule for front matter", () => {
    const chunks = splitMarkdownIntoChunks("---\n\n# Body");
    expect(buildOutline(chunks).map((item) => item.text)).toEqual(["Body"]);
    const html = renderMarkdownDocument("---\n\n# Body", null);
    expect(html).toContain("<hr>");
    expect(html).toContain("Body");
  });

  it("does not hide ordinary content between thematic breaks", () => {
    const markdown = "---\n# This is a heading\nVisible body\n\n---\n\n# After";
    expect(parseMarkdownFrontMatter(markdown)).toBeNull();

    const html = renderMarkdownDocument(markdown, null);
    expect(html).toContain("This is a heading");
    expect(html).toContain("Visible body");
    expect(html).toContain("After");
    expect(html.match(/<hr>/g)).toHaveLength(2);
  });

  it("accepts only a closed non-empty YAML mapping as front matter", () => {
    expect(parseMarkdownFrontMatter("---\ntitle: Hello\ntags:\n  - docs\n---\n# Body")?.data).toMatchObject({
      title: "Hello",
      tags: ["docs"]
    });
    expect(parseMarkdownFrontMatter("---\nplain body\n---\n# Body")).toBeNull();
    expect(parseMarkdownFrontMatter("---\n# comment only\n---\n# Body")).toBeNull();
    expect(parseMarkdownFrontMatter("---\nbase: &base {x: 1}\ncopy: *base\n---\n# Body")).toBeNull();
    expect(parseMarkdownFrontMatter("---\n<<: {x: 1}\n---\n# Body")).toBeNull();
  });

  it("keeps stable heading ids for English and Chinese headings", () => {
    expect(slugify("Hello, Markdown!")).toBe("hello-markdown");
    expect(slugify("中文 标题")).toBe("中文-标题");
  });

  it("keeps chunk-specific heading ids in the progressive preview", () => {
    const html = renderMarkdownChunk({ index: 3, startLine: 10, text: "## Preview" }, null);
    expect(html).toContain('id="preview-3-0"');
  });

  it("renders math and sanitizes raw HTML", () => {
    const html = renderMarkdownDocument("<img src=x onerror=alert(1)><script>alert(2)</script>\n\nInline $E = mc^2$.", null);

    expect(html).toContain("<img");
    expect(html).not.toContain("onerror");
    expect(html).not.toContain("<script");
    expect(html).toContain("katex");
  });

  it("converts relative image paths to file URLs", () => {
    const html = renderMarkdownDocument("![diagram](<images/a b.png>)", "C:\\Docs\\Notes");

    expect(html).toContain("file:///C:/Docs/Notes/images/a%20b.png");
    expect(html).toContain('loading="lazy"');
  });

  it("counts CJK characters and Latin words", () => {
    expect(getWordCount("中文 test words")).toBe(4);
  });

  it("counts each digit character separately", () => {
    expect(getWordCount("111")).toBe(3);
    expect(getWordCount("中文 123 abc")).toBe(6);
  });

  it("resolves footnotes across document sections", () => {
    const html = renderMarkdownDocument("# A\n\nText with a note[^1].\n\n## B\n\n[^1]: Footnote body", null);
    expect(html).toMatch(/<sup[^>]*class="footnote-ref"/);
    expect(html).toContain("Footnote body");
  });

  it("replaces [TOC] placeholder with a table of contents", () => {
    const html = renderMarkdownDocument("[TOC]\n\n# One\n\n## Two", null);
    expect(html).toContain('class="table-of-contents"');
    expect(html).toContain('<a href="#one">One</a>');
    expect(html).toContain('<a href="#two">Two</a>');
    expect(html).toMatch(/<h1 id="one"[^>]*>/);
    expect(html).toMatch(/<h2 id="two"[^>]*>/);
  });

  it("strips YAML front-matter with comments and CRLF endings", () => {
    const html = renderMarkdownDocument("---\r\ntitle: Hello\r\n# yaml comment\r\n---\r\n\r\n# Body", null);
    expect(html).not.toContain("title: Hello");
    expect(html).not.toContain("yaml comment");
    expect(html).not.toContain("<hr");
    expect(html).toContain("<h1");
    expect(html).toContain("Body");
  });

  it("routes syntax unsupported by the rich editor to the complete preview", () => {
    const result = analyzeRichMarkdownCompatibility([
      "Inline $E = mc^2$.",
      "```mermaid",
      "graph TD",
      "```",
      "Text[^1]",
      "[^1]: Note",
      "[TOC]",
      "<details>content</details>"
    ].join("\n"));

    expect(result.requiresDocumentPreview).toBe(true);
    expect(result.features).toEqual(["math", "mermaid", "footnote", "toc", "raw-html"]);
  });

  it("routes valid front matter to the property-preserving preview", () => {
    expect(analyzeRichMarkdownCompatibility("---\ntitle: Hello\ntags: [docs]\n---\n\n# Body")).toEqual({
      features: ["frontmatter"],
      requiresDocumentPreview: true
    });
  });

  it("ignores advanced-looking syntax inside code", () => {
    const result = analyzeRichMarkdownCompatibility("`$not-math$`\n\n```md\n[TOC]\n[^1]\n<div>\n```");
    expect(result).toEqual({ features: [], requiresDocumentPreview: false });
  });
});
