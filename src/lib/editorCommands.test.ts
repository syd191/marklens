import { describe, expect, it } from "vitest";
import { applyMarkdownCommand, moveSelectedLines, stripMarkdown } from "./editorCommands";

describe("editor commands", () => {
  it("wraps and unwraps inline formatting", () => {
    const bold = applyMarkdownCommand("hello", { start: 0, end: 5 }, "bold");
    expect(bold.value).toBe("**hello**");
    const plain = applyMarkdownCommand(bold.value, { start: 2, end: 7 }, "bold");
    expect(plain.value).toBe("hello");
  });

  it("sets headings across selected lines", () => {
    const result = applyMarkdownCommand("one\n## two", { start: 0, end: 10 }, "heading-3");
    expect(result.value).toBe("### one\n### two");
  });

  it("builds ordered and task lists", () => {
    const ordered = applyMarkdownCommand("alpha\nbeta", { start: 0, end: 10 }, "ordered-list");
    expect(ordered.value).toBe("1. alpha\n2. beta");
    const tasks = applyMarkdownCommand(ordered.value, { start: 0, end: ordered.value.length }, "task-list");
    expect(tasks.value).toBe("- [ ] alpha\n- [ ] beta");
  });

  it("moves selected lines", () => {
    const up = moveSelectedLines("a\nb\nc", { start: 2, end: 3 }, -1);
    expect(up.value).toBe("b\na\nc");
    const down = moveSelectedLines(up.value, { start: 0, end: 1 }, 1);
    expect(down.value).toBe("a\nb\nc");
  });

  it("strips common Markdown syntax", () => {
    expect(stripMarkdown("# Hello **world**\n- [ ] task\n[link](https://example.com)")).toBe(
      "Hello world\ntask\nlink"
    );
  });
});
