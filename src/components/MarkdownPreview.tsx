import { useEffect, useMemo, useRef, useState } from "react";
import type { MarkdownChunk } from "../types";
import { createMarkdownRenderer, renderMarkdownChunk } from "../lib/markdown";

type MarkdownPreviewProps = {
  chunks: MarkdownChunk[];
  baseDirectory: string | null;
  fontSize: number;
};

const INITIAL_CHUNK_LIMIT = 8;
const CHUNK_BATCH_SIZE = 12;

type RenderedMarkdownChunk = MarkdownChunk & { html: string };

function getContentKey(chunks: MarkdownChunk[]) {
  const first = chunks[0];
  const last = chunks[chunks.length - 1];
  return `${chunks.length}:${first?.text.slice(0, 64) ?? ""}:${last?.text.slice(-64) ?? ""}`;
}

function getChunkCacheKey(chunk: MarkdownChunk) {
  return `${chunk.index}:${chunk.startLine}:${chunk.text.length}:${chunk.text.slice(0, 80)}:${chunk.text.slice(-80)}`;
}

export function MarkdownPreview({ chunks, baseDirectory, fontSize }: MarkdownPreviewProps) {
  const previewRef = useRef<HTMLDivElement | null>(null);
  const renderCacheRef = useRef<{ key: string; chunks: Map<string, RenderedMarkdownChunk> }>({
    key: "",
    chunks: new Map()
  });
  const contentKey = useMemo(() => getContentKey(chunks), [chunks]);
  const [renderState, setRenderState] = useState(() => ({
    key: contentKey,
    limit: Math.min(INITIAL_CHUNK_LIMIT, chunks.length)
  }));
  const renderLimit = renderState.key === contentKey ? renderState.limit : Math.min(INITIAL_CHUNK_LIMIT, chunks.length);
  const renderer = useMemo(() => createMarkdownRenderer(baseDirectory), [baseDirectory, contentKey]);
  const renderedChunks = useMemo(
    () => {
      const cacheKey = `${contentKey}\u0000${baseDirectory ?? ""}`;
      if (renderCacheRef.current.key !== cacheKey) {
        renderCacheRef.current = { key: cacheKey, chunks: new Map() };
      }

      return chunks.slice(0, renderLimit).map((chunk) => {
        const chunkCacheKey = getChunkCacheKey(chunk);
        const cached = renderCacheRef.current.chunks.get(chunkCacheKey);
        if (cached) return cached;

        const rendered = { ...chunk, html: renderMarkdownChunk(chunk, baseDirectory, renderer) };
        renderCacheRef.current.chunks.set(chunkCacheKey, rendered);
        return rendered;
      });
    },
    [chunks, baseDirectory, contentKey, renderLimit, renderer]
  );

  useEffect(() => {
    setRenderState({ key: contentKey, limit: Math.min(INITIAL_CHUNK_LIMIT, chunks.length) });
  }, [chunks.length, contentKey]);

  useEffect(() => {
    if (renderState.key !== contentKey || renderState.limit >= chunks.length) return;

    // Render long documents in idle batches so the first screen appears before
    // expensive math, code, and diagram-heavy sections finish processing.
    const schedule = window.requestIdleCallback ?? ((callback: IdleRequestCallback) => window.setTimeout(() => callback({ didTimeout: false, timeRemaining: () => 0 }), 16));
    const cancel = window.cancelIdleCallback ?? window.clearTimeout;
    const handle = schedule(() => {
      setRenderState((current) => {
        if (current.key !== contentKey) return current;
        return { key: contentKey, limit: Math.min(chunks.length, current.limit + CHUNK_BATCH_SIZE) };
      });
    });

    return () => cancel(handle);
  }, [chunks.length, contentKey, renderState.key, renderState.limit]);

  useEffect(() => {
    const root = previewRef.current;
    if (!root) return;

    let cancelled = false;
    const nodes = Array.from(root.querySelectorAll<HTMLElement>(".mermaid-pending"));
    if (!nodes.length) return;

    const observer = new IntersectionObserver(
      async (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .map((entry) => entry.target as HTMLElement)
          .filter((node) => node.classList.contains("mermaid-pending"));

        if (!visible.length || cancelled) return;
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({ startOnLoad: false, theme: document.documentElement.dataset.theme === "night" ? "dark" : "default" });

        visible.forEach((node) => {
          const source = node.dataset.mermaid ? decodeURIComponent(node.dataset.mermaid) : "";
          node.textContent = source;
          node.classList.remove("mermaid-pending");
          observer.unobserve(node);
        });

        if (!cancelled) {
          try {
            await mermaid.run({ nodes: visible });
          } catch {
            visible.forEach((node) => {
              node.textContent = "Diagram failed to render.";
            });
          }
        }
      },
      { rootMargin: "560px 0px" }
    );

    nodes.forEach((node) => observer.observe(node));
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [renderedChunks]);

  return (
    <main className="preview-scroll" ref={previewRef}>
      <article className="markdown-body" style={{ fontSize: `${fontSize}px` }}>
        {renderedChunks.map((chunk) => (
          <section
            key={`${chunk.index}-${chunk.startLine}`}
            className="markdown-chunk"
            data-start-line={chunk.startLine}
            dangerouslySetInnerHTML={{ __html: chunk.html }}
          />
        ))}
      </article>
    </main>
  );
}
