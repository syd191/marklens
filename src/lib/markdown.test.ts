import { describe, expect, it } from "vitest";
import {
  buildOutline,
  getWordCount,
  renderMarkdownDocument,
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

  it("keeps stable heading ids for English and Chinese headings", () => {
    expect(slugify("Hello, Markdown!")).toBe("hello-markdown");
    expect(slugify("中文 标题")).toBe("中文-标题");
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

  it("renders footnotes into a footnote list", () => {
    const html = renderMarkdownDocument("Text with a note[^1].\n\n[^1]: Footnote body", null);
    expect(html).toMatch(/<sup[^>]*class="footnote-ref"/);
    expect(html).toContain("Footnote body");
  });

  it("replaces [TOC] placeholder with a table of contents", () => {
    const html = renderMarkdownDocument("[TOC]\n\n# One\n\n## Two", null);
    expect(html).toContain('class="table-of-contents"');
    expect(html).toContain(">One<");
    expect(html).toContain(">Two<");
  });

  it("strips YAML front-matter before rendering", () => {
    const html = renderMarkdownDocument("---\ntitle: Hello\n---\n\n# Body", null);
    expect(html).not.toContain("title: Hello");
    expect(html).not.toContain("<hr");
    expect(html).toContain("<h1");
    expect(html).toContain("Body");
  });
});
