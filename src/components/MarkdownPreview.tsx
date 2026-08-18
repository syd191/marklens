import { useEffect, useMemo, useRef } from "react";
import { parseMarkdownFrontMatter, renderMarkdownDocument } from "../lib/markdown";
import type { ResolvedTheme } from "../types";

type MarkdownPreviewProps = {
  markdown: string;
  baseDirectory: string | null;
  fontSize: number;
  theme: ResolvedTheme;
  notice: string;
  editLabel: string;
  frontMatterLabel: string;
  onEditSource: () => void;
};

function formatFrontMatterValue(value: unknown): string {
  if (Array.isArray(value)) return value.map(String).join(", ");
  if (value && typeof value === "object") return JSON.stringify(value);
  return String(value ?? "");
}

export function MarkdownPreview({
  markdown,
  baseDirectory,
  fontSize,
  theme,
  notice,
  editLabel,
  frontMatterLabel,
  onEditSource
}: MarkdownPreviewProps) {
  const previewRef = useRef<HTMLDivElement | null>(null);
  // Footnotes, TOC and front matter have document-wide semantics. Mature
  // editors parse them as one document tree; rendering independent chunks can
  // break references that cross a chunk boundary.
  const html = useMemo(() => renderMarkdownDocument(markdown, baseDirectory), [baseDirectory, markdown]);
  const frontMatter = useMemo(() => parseMarkdownFrontMatter(markdown), [markdown]);

  useEffect(() => {
    const root = previewRef.current;
    if (!root) return;

    let cancelled = false;
    const nodes = Array.from(root.querySelectorAll<HTMLElement>(".mermaid-pending"));
    if (!nodes.length) return;

    const render = async () => {
      const mermaid = (await import("mermaid")).default;
      mermaid.initialize({
        startOnLoad: false,
        theme: theme === "night" ? "dark" : "default",
        securityLevel: "strict"
      });

      for (const [index, node] of nodes.entries()) {
        if (cancelled) return;
        const source = node.dataset.mermaid ? decodeURIComponent(node.dataset.mermaid) : "";
        try {
          const id = `mermaid-preview-${Date.now()}-${index}`;
          const { svg, bindFunctions } = await mermaid.render(id, source);
          if (cancelled) return;
          const container = document.createElement("div");
          container.className = "mermaid mermaid-rendered";
          container.innerHTML = svg;
          node.closest(".mermaid-shell")?.replaceChildren(container);
          bindFunctions?.(container);
        } catch {
          node.textContent = "Diagram failed to render.";
          node.classList.remove("mermaid-pending");
        }
      }
    };

    void render();
    return () => {
      cancelled = true;
    };
  }, [html, theme]);

  return (
    <main className="preview-scroll" ref={previewRef}>
      <div className="advanced-preview-notice" role="status">
        <span>{notice}</span>
        <button type="button" onClick={onEditSource}>{editLabel}</button>
      </div>
      <article className="markdown-body" style={{ fontSize: `${fontSize}px` }}>
        {frontMatter ? (
          <section className="frontmatter-preview" aria-label={frontMatterLabel}>
            <strong>{frontMatterLabel}</strong>
            <dl>
              {Object.entries(frontMatter.data).map(([key, value]) => (
                <div key={key}>
                  <dt>{key}</dt>
                  <dd>{formatFrontMatterValue(value)}</dd>
                </div>
              ))}
            </dl>
          </section>
        ) : null}
        <div className="markdown-rendered-content" dangerouslySetInnerHTML={{ __html: html }} />
      </article>
    </main>
  );
}
