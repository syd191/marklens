import { describe, expect, it } from "vitest";
import {
  buildOutline,
  getWordCount,
  renderMarkdownDocument,
  renderMarkdownChunk,
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
  });

  it("keeps stable heading ids for English and Chinese headings", () => {
    expect(slugify("Hello, Markdown!")).toBe("hello-markdown");
    expect(slugify("中文 标题")).toBe("中文-标题");
  });

  it("keeps chunk-specific heading ids in the progressive preview", () => {
    const html = renderMarkdownChunk({ index: 3, startLine: 10, text: "## Preview" }, null);
    expect(html).toContain('id="preview-3-0"');
  });

  it("renders math but escapes raw HTML by default", () => {
    const html = renderMarkdownDocument("<img src=x onerror=alert(1)>\n\nInline $E = mc^2$.", null);

    expect(html).toContain("&lt;img");
    expect(html).not.toContain("<img src=x");
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
});
