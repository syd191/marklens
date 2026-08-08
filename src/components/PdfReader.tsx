import { memo, useCallback, useEffect, useRef, useState } from "react";
import { GlobalWorkerOptions, getDocument } from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";

GlobalWorkerOptions.workerSrc = workerSrc;

type PdfReaderProps = {
  book: OpenedPdf;
  theme: "light" | "dark";
};

export const PdfReader = memo(function PdfReader({ book, theme }: PdfReaderProps) {
  const [loading, setLoading] = useState(true);
  const [numPages, setNumPages] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  const [renderTick, setRenderTick] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pdfDocRef = useRef<any>(null);

  // 加载 PDF 文档
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNumPages(0);
    setPageIndex(0);
    window.markdownBridge
      ?.readPdf(book.filePath)
      .then((data) => getDocument({ data }).promise)
      .then((doc) => {
        if (cancelled) {
          doc.destroy();
          return;
        }
        pdfDocRef.current = doc;
        setNumPages(doc.numPages);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn("Failed to load PDF", err);
        setLoading(false);
      });
    return () => {
      cancelled = true;
      pdfDocRef.current?.destroy();
      pdfDocRef.current = null;
    };
  }, [book.filePath]);

  // 容器尺寸变化时触发重绘
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setRenderTick((t) => t + 1));
    ro.observe(el);
    return () => ro.disconnect();
  }, [loading]);

  // 渲染当前页
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    const doc = pdfDocRef.current;
    if (!container || !canvas || !doc || numPages === 0 || pageIndex < 0 || pageIndex >= numPages) return;
    let renderTask: any = null;
    doc
      .getPage(pageIndex + 1)
      .then((page: any) => {
        const baseViewport = page.getViewport({ scale: 1 });
        const availW = container.clientWidth - 64; // 预留左右留白
        const availH = container.clientHeight - 64; // 预留上下留白
        const scale = Math.max(0.3, Math.min(availW / baseViewport.width, availH / baseViewport.height));
        const viewport = page.getViewport({ scale });
        const dpr = window.devicePixelRatio || 1;
        const ctx = canvas.getContext("2d")!;
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;
        renderTask = page.render({
          canvasContext: ctx,
          viewport,
          transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined
        });
        return renderTask.promise;
      })
      .catch((err: any) => console.warn("Failed to render PDF page", err));
    return () => {
      renderTask?.cancel();
    };
  }, [pageIndex, numPages, renderTick, theme, book.filePath]);

  // 键盘翻页
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") {
        e.preventDefault();
        setPageIndex((p) => (p < numPages - 1 ? p + 1 : p));
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        setPageIndex((p) => (p > 0 ? p - 1 : p));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [numPages]);

  // 鼠标滚轮翻页
  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      if (e.deltaY > 0) setPageIndex((p) => (p < numPages - 1 ? p + 1 : p));
      else setPageIndex((p) => (p > 0 ? p - 1 : p));
    },
    [numPages]
  );

  const handlePageInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const num = parseInt(e.target.value.trim(), 10);
    if (!isNaN(num) && num >= 1 && num <= numPages) setPageIndex(num - 1);
  };

  return (
    <div className={`pdf-reader theme-${theme}`}>
      {loading ? (
        <div className="epub-loading">
          <div className="epub-loading-spinner" />
        </div>
      ) : (
        <>
          <div className="pdf-canvas-wrap" ref={containerRef} onWheel={onWheel}>
            <canvas ref={canvasRef} className="pdf-canvas" />
          </div>
          <div className="epub-pagenav">
            <button
              className="chapter-nav-btn"
              disabled={pageIndex === 0}
              onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
            >
              ◀ 上一页
            </button>
            <span className="chapter-nav-info">
              <input
                type="text"
                inputMode="numeric"
                value={pageIndex + 1}
                onChange={handlePageInput}
                className="page-input"
                aria-label="跳转到页"
              />
              / {Math.max(1, numPages)} 页
            </span>
            <button
              className="chapter-nav-btn"
              disabled={pageIndex >= numPages - 1}
              onClick={() => setPageIndex((p) => Math.min(numPages - 1, p + 1))}
            >
              下一页 ▶
            </button>
          </div>
        </>
      )}
    </div>
  );
});
