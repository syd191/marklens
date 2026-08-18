import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MarkdownPreview } from "./MarkdownPreview";

describe("MarkdownPreview", () => {
  it("shows document properties and advanced syntax without executing raw HTML", () => {
    const onEditSource = vi.fn();
    const { container } = render(
      <MarkdownPreview
        markdown={[
          "---",
          "title: Preview",
          "tags: [markdown, test]",
          "---",
          "",
          "# Body",
          "",
          "Inline $E = mc^2$ and a note[^1].",
          "",
          "[^1]: Footnote body.",
          "",
          "[TOC]",
          "",
          '<u class="safe-html">render safely</u><img src="x" onerror="alert(1)">'
        ].join("\n")}
        baseDirectory={null}
        fontSize={16}
        theme="night"
        notice="Complete preview"
        editLabel="Edit source"
        frontMatterLabel="Document properties"
        onEditSource={onEditSource}
      />
    );

    expect(screen.getByRole("region", { name: "Document properties" })).toHaveTextContent("Preview");
    expect(container.querySelector(".katex")).toBeInTheDocument();
    expect(container.querySelector(".footnote-ref")).toBeInTheDocument();
    expect(container.querySelector(".table-of-contents")).toBeInTheDocument();
    expect(screen.getByText(/render safely/)).toBeInTheDocument();
    expect(container.querySelector(".safe-html")).toBeInTheDocument();
    expect(container.querySelector("img")?.hasAttribute("onerror")).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Edit source" }));
    expect(onEditSource).toHaveBeenCalledOnce();
  });
});
