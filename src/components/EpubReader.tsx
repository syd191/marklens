import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { EpubBook } from "../types";

type EpubReaderProps = {
  book: EpubBook;
  spineIndex: number;
  theme: "light" | "dark";
  onSpineChange: (index: number) => void;
  onScrollProgress: (progress: number) => void;
};

// 分页用的块级标签
const BLOCK_TAGS = new Set(["DIV", "P", "H1", "H2", "H3", "H4", "H5", "H6", "IMG", "FIGURE", "TABLE", "UL", "OL", "BLOCKQUOTE", "HR", "PRE", "SECTION", "ARTICLE"]);

/**
 * 将 EPUB 书内 CSS 限定到 .epub-content 作用域，避免泄漏到可见页。
 * 处理：@media/@supports（包裹整体）、@font-face/@keyframes（原样保留）、
 * 普通规则（给每个选择器加 .epub-content 前缀）。
 * 跳过 @import（EPUB 内联 CSS 不应含外部引用）。
 */
function scopeEpubCss(css: string): string {
  const out: string[] = [];
  let i = 0;
  const len = css.length;
  while (i < len) {
    // 跳过注释
    if (css[i] === "/" && css[i + 1] === "*") {
      const end = css.indexOf("*/", i + 2);
      i = end < 0 ? len : end + 2;
      continue;
    }
    // 读取 at-rule 或普通规则
    if (css[i] === "@") {
      // 读取 at-key
      const nameStart = i + 1;
      let j = nameStart;
      while (j < len && /[a-zA-Z-]/.test(css[j])) j++;
      const atName = css.slice(nameStart, j).toLowerCase();
      if (atName === "font-face" || atName === "keyframes" || atName === "-webkit-keyframes") {
        // 原样保留整块（到匹配的 }）
        const braceStart = css.indexOf("{", j);
        if (braceStart < 0) { i = len; break; }
        let depth = 1;
        let k = braceStart + 1;
        while (k < len && depth > 0) {
          if (css[k] === "{") depth++;
          else if (css[k] === "}") depth--;
          k++;
        }
        out.push(css.slice(i, k));
        i = k;
      } else if (atName === "media" || atName === "supports" || atName === "document") {
        // 包裹整体：@media (...) { <scoped rules> }
        const braceStart = css.indexOf("{", j);
        if (braceStart < 0) { i = len; break; }
        const prelude = css.slice(i, braceStart + 1);
        let depth = 1;
        let k = braceStart + 1;
        while (k < len && depth > 0) {
          if (css[k] === "{") depth++;
          else if (css[k] === "}") depth--;
          k++;
        }
        const inner = css.slice(braceStart + 1, k - 1);
        out.push(prelude + scopeEpubCss(inner) + "}");
        i = k;
      } else {
        // 其他 at-rule（如 @page、@charset）：原样保留到 ; 或 }
        let k = i;
        while (k < len && css[k] !== ";" && css[k] !== "{") k++;
        if (css[k] === "{") {
          let depth = 1;
          k++;
          while (k < len && depth > 0) {
            if (css[k] === "{") depth++;
            else if (css[k] === "}") depth--;
            k++;
          }
        } else {
          k++; // 含 ;
        }
        out.push(css.slice(i, k));
        i = k;
      }
    } else {
      // 普通规则：selector { ... }
      let braceStart = css.indexOf("{", i);
      if (braceStart < 0) { i = len; break; }
      let depth = 1;
      let k = braceStart + 1;
      while (k < len && depth > 0) {
        if (css[k] === "{") depth++;
        else if (css[k] === "}") depth--;
        k++;
      }
      const selectorText = css.slice(i, braceStart);
      const bodyText = css.slice(braceStart, k);
      // 给每个逗号分隔的选择器加前缀
      const scoped = selectorText
        .split(",")
        .map((sel) => {
          const s = sel.trim();
          if (!s) return s;
          // 已有前缀或 :root 不重复加
          if (s.startsWith(".epub-content")) return s;
          if (s === "html" || s === "body" || s === ":root") return ".epub-content";
          return ".epub-content " + s;
        })
        .join(", ");
      out.push(scoped + " " + bodyText);
      i = k;
    }
    // 跳过空白
    while (i < len && /\s/.test(css[i])) i++;
  }
  return out.join("\n");
}

export const EpubReader = memo(function EpubReader({
  book,
  spineIndex,
  theme,
  onSpineChange,
  onScrollProgress,
}: EpubReaderProps) {
  const [chapterHtml, setChapterHtml] = useState("");
  const [loading, setLoading] = useState(true);
  const [pages, setPages] = useState<HTMLElement[]>([]);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState({ width: 0, height: 0 });

  const readerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const pagesRef = useRef<HTMLDivElement>(null);

  // 加载章节内容
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setChapterHtml("");
    setPages([]);
    setPageIndex(0);
    window.markdownBridge?.readEpubSpine(book.filePath, spineIndex)
      .then((content) => {
        if (cancelled) return;
        setChapterHtml(content);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn("Failed to read EPUB spine", err);
        setChapterHtml("<html><body><p>章节加载失败</p></body></html>");
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [book.filePath, spineIndex]);

  // 监听容器尺寸
  useEffect(() => {
    const el = readerRef.current;
    if (!el) return;
    const update = () => {
      setPageSize({ width: el.clientWidth, height: el.clientHeight });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [loading]);

  // 构建完整 HTML 字符串（含样式）
  // 书内 CSS 经 scopeEpubCss 限定到 .epub-content，不泄漏到可见页（.epub-page-view）
  const { scopedStylesText, contentHtml } = useMemo(() => {
    if (!chapterHtml) return { scopedStylesText: "", contentHtml: "" };
    const bookCss: string[] = [];
    const styleRe = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
    let sm: RegExpExecArray | null;
    while ((sm = styleRe.exec(chapterHtml)) !== null) {
      bookCss.push(sm[1]);
    }
    const bodyMatch = /<body[^>]*>([\s\S]*?)<\/body>/i.exec(chapterHtml);
    const body = bodyMatch ? bodyMatch[1] : chapterHtml;
    const themeCss = theme === "dark"
      ? `.epub-content{background:#1f1f1f;color:#eee;} .epub-content a{color:#8ab4f8;}`
      : `.epub-content{background:#fff;color:#333;} .epub-content a{color:#2f6fbd;}`;
    const baseCss = `
      ${themeCss}
      .epub-content { font-family:"Segoe UI",-apple-system,sans-serif; font-size:17px; line-height:1.8; word-wrap:break-word; overflow-wrap:break-word; }
      .epub-content img { max-width:100%; width:auto; height:auto; object-fit:contain; box-sizing:border-box; }
      .epub-content svg { max-width:100%; width:auto; height:auto; }
      .epub-content table { border-collapse:collapse; width:100%; }
      .epub-content th,.epub-content td { border:1px solid ${theme === "dark" ? "#4a4a4a" : "#d9d9d9"}; padding:6px 12px; }
    `;
    const scoped = bookCss.map((c) => scopeEpubCss(c)).join("\n") + "\n" + baseCss;
    return {
      scopedStylesText: scoped,
      contentHtml: body,
    };
  }, [chapterHtml, theme]);

  // 将内容切割为页
  useEffect(() => {
    const measure = measureRef.current;
    if (!measure || !pageSize.height || !chapterHtml) return;
    const container = measure.querySelector<HTMLElement>(".epub-content");
    if (!container) return;

    // 封面/纯图页检测：无文本内容（图片可有多个或带包装）
    const imgs = Array.from(container.querySelectorAll("img"));
    if (imgs.length > 0 && container.innerText.trim().length === 0) {
      // 单独一页，等比适配工作区居中（参考 Freda）
      const page = document.createElement("div");
      page.className = "epub-page epub-cover-page";
      page.innerHTML = container.innerHTML;
      // 清除图片的内联 style 和 width/height 属性，否则内联样式优先级高于 CSS，封面无法等比缩放
      page.querySelectorAll("img").forEach((img) => {
        img.removeAttribute("style");
        img.removeAttribute("width");
        img.removeAttribute("height");
      });
      setPages([page]);
      setPageIndex(0);
      return;
    }

    // 页视口的真实内容尺寸（单页模式）：
    //  - 左右：8% 边距 + 页面 32px*2 内边距
    //  - 上下：页容器底部 60px 留白 + 页面 48px 顶部 + 40px 底部内边距
    const contentW = pageSize.width * 0.84 - 64;
    const contentH = pageSize.height - 148;
    const pagesOut: HTMLElement[] = [];
    let current = document.createElement("div");
    current.className = "epub-page";
    let used = 0;

    // 通过一次性隐藏测量容器获得每个块的真实高度
    // 给 tmp 加 epub-content 类 + 注入 scoped 样式，使测量与真实排版一致
    const tmp = document.createElement("div");
    tmp.className = "epub-content";
    tmp.style.cssText = "position:absolute;visibility:hidden;left:-99999px;top:0;width:" + contentW + "px;";
    tmp.innerHTML = container.innerHTML;
    document.body.appendChild(tmp);
    // 注入 scoped 样式到测量容器上下文（style 全局生效，但选择器已限定 .epub-content）
    const measureStyle = document.createElement("style");
    measureStyle.textContent = scopedStylesText;
    document.body.appendChild(measureStyle);
    const tmpChildren = Array.from(tmp.children).filter((el) => BLOCK_TAGS.has(el.tagName));
    if (tmpChildren.length === 0) {
      // 没有可切分的块级子元素（如内容被单个容器包裹或仅有文本）：整章作为一页
      const page = document.createElement("div");
      page.className = "epub-page";
      page.innerHTML = container.innerHTML;
      pagesOut.push(page);
    } else {
      for (const el of tmpChildren) {
        const h = (el as HTMLElement).offsetHeight || 0;
        if (used + h > contentH && used > 0) {
          pagesOut.push(current);
          current = document.createElement("div");
          current.className = "epub-page";
          used = 0;
        }
        current.appendChild(document.importNode(el, true));
        used += h;
      }
      if (current.children.length > 0) pagesOut.push(current);
    }
    tmp.remove();
    measureStyle.remove();
    setPages(pagesOut);
    setPageIndex(0);
  }, [chapterHtml, pageSize, theme, scopedStylesText]);

  // 翻页
  const totalPages = pages.length;
  const turnPage = useCallback((delta: number) => {
    setPageIndex((prev) => {
      const next = prev + delta;
      if (next < 0) {
        // 回到上一章
        return prev;
      }
      if (next >= totalPages) {
        // 进入下一章
        return prev;
      }
      return next;
    });
  }, [totalPages]);

  // 键盘翻页
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") {
        e.preventDefault();
        // 下一页
        if (pageIndex < totalPages - 1) setPageIndex(pageIndex + 1);
        else if (spineIndex < book.spine.length - 1) onSpineChange(spineIndex + 1);
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        if (pageIndex > 0) setPageIndex(pageIndex - 1);
        else if (spineIndex > 0) onSpineChange(spineIndex - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pageIndex, totalPages, spineIndex, book.spine.length, onSpineChange]);

  // 鼠标滚轮翻页
  useEffect(() => {
    const reader = readerRef.current;
    if (!reader) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.deltaY > 0) {
        // 向下滚动 -> 下一页
        if (pageIndex < totalPages - 1) setPageIndex(pageIndex + 1);
        else if (spineIndex < book.spine.length - 1) onSpineChange(spineIndex + 1);
      } else {
        // 向上滚动 -> 上一页
        if (pageIndex > 0) setPageIndex(pageIndex - 1);
        else if (spineIndex > 0) onSpineChange(spineIndex - 1);
      }
    };
    reader.addEventListener("wheel", onWheel, { passive: false });
    return () => reader.removeEventListener("wheel", onWheel);
  }, [pageIndex, totalPages, spineIndex, book.spine.length, onSpineChange]);

  // 页码输入跳转
  const handlePageInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value.trim();
    const num = parseInt(input, 10);
    if (!isNaN(num) && num >= 1 && num <= totalPages) {
      setPageIndex(num - 1);
    }
  };

  // 进度
  useEffect(() => {
    const spineProgress = spineIndex / Math.max(1, book.spine.length);
    const pageProgress = totalPages > 0 ? pageIndex / totalPages : 0;
    onScrollProgress(Math.min(1, (spineProgress * totalPages + pageIndex) / Math.max(1, book.spine.length)));
  }, [pageIndex, totalPages, spineIndex, book.spine.length, onScrollProgress]);

  // 鼠标点击左右区域翻页
  const handleClick = (e: React.MouseEvent) => {
    const rect = readerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const clickArea = rect.width / 3;
    if (x > rect.width - clickArea) {
      if (pageIndex < totalPages - 1) setPageIndex(pageIndex + 1);
      else if (spineIndex < book.spine.length - 1) onSpineChange(spineIndex + 1);
    } else if (x < clickArea) {
      if (pageIndex > 0) setPageIndex(pageIndex - 1);
      else if (spineIndex > 0) onSpineChange(spineIndex - 1);
    }
  };

  const currentPage = pages[pageIndex];

  return (
    <div className="epub-reader" ref={readerRef} onClick={handleClick}>
      {loading ? (
        <div className="epub-loading">
          <div className="epub-loading-spinner" />
        </div>
      ) : (
        <>
          {/* 隐藏测量容器：scoped 样式只作用于 .epub-content，不泄漏到可见页 */}
          <div className="epub-measure" ref={measureRef}>
            <style dangerouslySetInnerHTML={{ __html: scopedStylesText }} />
            <div className="epub-content" style={{ width: pageSize.width - 40 }} dangerouslySetInnerHTML={{ __html: contentHtml }} />
          </div>

          <div className="epub-pages" ref={pagesRef}>
            {currentPage && (
              <div className={`epub-page-view${currentPage.classList.contains("epub-cover-page") ? " epub-cover-page" : ""}`} dangerouslySetInnerHTML={{ __html: currentPage.innerHTML }} />
            )}
          </div>

          <div className="epub-pagenav">
            <button
              className="chapter-nav-btn"
              disabled={pageIndex === 0 && spineIndex === 0}
              onClick={(e) => { e.stopPropagation(); if (pageIndex > 0) setPageIndex(pageIndex - 1); else if (spineIndex > 0) onSpineChange(spineIndex - 1); }}
            >
              ◀ 上一页
            </button>
            <span className="chapter-nav-info">
              <input
                type="text"
                inputMode="numeric"
                value={pageIndex + 1}
                onChange={handlePageInput}
                onClick={(e) => e.stopPropagation()}
                className="page-input"
                aria-label="跳转到页"
              />
              / {Math.max(1, totalPages)} 页 · 第 {spineIndex + 1}/{book.spine.length} 章
            </span>
            <button
              className="chapter-nav-btn"
              disabled={pageIndex >= totalPages - 1 && spineIndex >= book.spine.length - 1}
              onClick={(e) => { e.stopPropagation(); if (pageIndex < totalPages - 1) setPageIndex(pageIndex + 1); else if (spineIndex < book.spine.length - 1) onSpineChange(spineIndex + 1); }}
            >
              下一页 ▶
            </button>
          </div>
        </>
      )}
    </div>
  );
});
