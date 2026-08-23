import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BookOpenText,
  ChevronLeft,
  ChevronRight,
  Columns2,
  FolderOpen,
  ListTree,
  LoaderCircle,
  Minus,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Rows3
} from "lucide-react";
import type { FoliateBook, FoliateRelocateDetail, FoliateTocItem, View } from "foliate-js/view.js";
import {
  buildEpubDocumentStyles,
  clampFontSize,
  flattenToc,
  formatEpubPercent,
  getEpubErrorMessage,
  getEpubReadingKey,
  getEpubWheelTurn,
  languagePreferences,
  loadEpubReadingState,
  normalizeEpubWheelDelta,
  normalizeLocalizedValue,
  saveEpubReadingState,
  type EpubFlow,
  type EpubReadingState
} from "../lib/epub";
import type { AppLanguage, ResolvedTheme } from "../types";

type EpubReaderProps = {
  epub: OpenedEpub;
  language: AppLanguage;
  theme: ResolvedTheme;
  onOpenAnother: () => void;
};

type ReaderDocument = Document & { fonts?: FontFaceSet };
type FoliateRenderer = HTMLElement & {
  getContents?: () => Array<{ doc: ReaderDocument; index: number }>;
};

const labels = {
  "zh-CN": {
    toc: "目录",
    noToc: "此电子书没有提供目录",
    previous: "上一页",
    next: "下一页",
    paginated: "分页阅读",
    scrolled: "滚动阅读",
    decreaseFont: "减小字号",
    increaseFont: "增大字号",
    openAnother: "打开其他电子书",
    loading: "正在解析电子书…",
    loadHint: "首次打开大型电子书可能需要一点时间",
    errorTitle: "无法打开这本电子书",
    errorHint: "你可以重新下载文件，或先用 EPUBCheck / Calibre 检查并修复。",
    fixedLayout: "固定版式",
    untitled: "未命名电子书",
    unknownAuthor: "作者未知",
    readingProgress: "阅读进度"
  },
  "zh-TW": {
    toc: "目錄",
    noToc: "此電子書沒有提供目錄",
    previous: "上一頁",
    next: "下一頁",
    paginated: "分頁閱讀",
    scrolled: "捲動閱讀",
    decreaseFont: "縮小字級",
    increaseFont: "放大字級",
    openAnother: "開啟其他電子書",
    loading: "正在解析電子書…",
    loadHint: "首次開啟大型電子書可能需要一點時間",
    errorTitle: "無法開啟這本電子書",
    errorHint: "你可以重新下載檔案，或先用 EPUBCheck / Calibre 檢查並修復。",
    fixedLayout: "固定版式",
    untitled: "未命名電子書",
    unknownAuthor: "作者未知",
    readingProgress: "閱讀進度"
  },
  "en-US": {
    toc: "Contents",
    noToc: "This book does not include a table of contents",
    previous: "Previous page",
    next: "Next page",
    paginated: "Paginated",
    scrolled: "Scrolling",
    decreaseFont: "Decrease font size",
    increaseFont: "Increase font size",
    openAnother: "Open another book",
    loading: "Opening book…",
    loadHint: "Large books can take a moment on first open",
    errorTitle: "This book could not be opened",
    errorHint: "Try downloading it again, or validate and repair it with EPUBCheck or Calibre.",
    fixedLayout: "Fixed layout",
    untitled: "Untitled book",
    unknownAuthor: "Unknown author",
    readingProgress: "Reading progress"
  }
} as const;

function EpubReaderComponent({ epub, language, theme, onOpenAnother }: EpubReaderProps) {
  const t = labels[language];
  const readingKey = useMemo(
    () => getEpubReadingKey(epub.filePath, epub.size, epub.mtimeMs),
    [epub.filePath, epub.mtimeMs, epub.size]
  );
  const initialState = useMemo(() => loadEpubReadingState(readingKey), [readingKey]);
  const [flow, setFlow] = useState<EpubFlow>(initialState.flow);
  const [fontSize, setFontSize] = useState(initialState.fontSize);
  const [tocOpen, setTocOpen] = useState(initialState.tocOpen);
  const [book, setBook] = useState<FoliateBook | null>(null);
  const [progress, setProgress] = useState(0);
  const [locationCfi, setLocationCfi] = useState(initialState.cfi);
  const [sectionLabel, setSectionLabel] = useState("");
  const [fixedLayout, setFixedLayout] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLElement>(null);
  const viewRef = useRef<View | null>(null);
  const attachDocumentWheelRef = useRef<(doc: ReaderDocument) => void>(() => undefined);
  const themeRef = useRef(theme);
  const fontSizeRef = useRef(fontSize);
  themeRef.current = theme;
  fontSizeRef.current = fontSize;

  const preferredLanguages = useMemo(
    () => languagePreferences(language, book?.metadata?.language),
    [book?.metadata?.language, language]
  );
  const title = normalizeLocalizedValue(book?.metadata?.title, preferredLanguages) || epub.name.replace(/\.epub$/i, "") || t.untitled;
  const author = normalizeLocalizedValue(book?.metadata?.author, preferredLanguages) || t.unknownAuthor;
  const tocItems = useMemo(() => flattenToc(book?.toc), [book?.toc]);
  const rightToLeft = book?.dir === "rtl";

  const injectDocumentTheme = useCallback((doc: ReaderDocument) => {
    if (viewRef.current?.isFixedLayout) return;
    let style = doc.getElementById("marklens-epub-style") as HTMLStyleElement | null;
    if (!style) {
      style = doc.createElement("style");
      style.id = "marklens-epub-style";
      doc.head?.append(style);
    }
    style.textContent = buildEpubDocumentStyles(themeRef.current, fontSizeRef.current);
  }, []);

  const refreshLoadedDocuments = useCallback(() => {
    const renderer = viewRef.current?.renderer as FoliateRenderer | undefined;
    for (const content of renderer?.getContents?.() ?? []) injectDocumentTheme(content.doc);
  }, [injectDocumentTheme]);

  useEffect(() => {
    let cancelled = false;
    let createdView: View | null = null;
    const host = hostRef.current;
    setLoading(true);
    setError(null);
    setBook(null);
    setProgress(0);
    setSectionLabel("");
    setFlow(initialState.flow);
    setFontSize(initialState.fontSize);
    setTocOpen(initialState.tocOpen);
    setLocationCfi(initialState.cfi);

    const open = async () => {
      try {
        if (epub.openError) throw new Error(epub.openError);
        const { View: FoliateView } = await import("foliate-js/view.js");
        if (cancelled || !host) return;
        const view = new FoliateView();
        createdView = view;
        viewRef.current = view;
        view.className = "epub-foliate-view";
        host.replaceChildren(view);

        view.addEventListener("load", ((event: CustomEvent<{ doc: ReaderDocument }>) => {
          injectDocumentTheme(event.detail.doc);
          // Publication wheel events stay inside foliate's isolated iframe, so
          // each newly loaded content document needs the active page handler.
          attachDocumentWheelRef.current(event.detail.doc);
        }) as EventListener);
        view.addEventListener("relocate", ((event: CustomEvent<FoliateRelocateDetail>) => {
          const detail = event.detail;
          if (typeof detail.fraction === "number") setProgress(Math.max(0, Math.min(1, detail.fraction)));
          if (typeof detail.cfi === "string") setLocationCfi(detail.cfi);
          setSectionLabel(detail.tocItem?.label?.trim() ?? detail.pageItem?.label?.trim() ?? "");
        }) as EventListener);
        view.addEventListener("external-link", ((event: CustomEvent<{ href_: string }>) => {
          event.preventDefault();
          const url = event.detail.href_;
          if (/^https?:\/\//i.test(url)) void window.markdownBridge?.openExternalUrl(url);
        }) as EventListener);

        const file = new File([epub.data], epub.name, { type: "application/epub+zip", lastModified: epub.mtimeMs });
        await view.open(file);
        if (cancelled) return;
        setBook(view.book);
        setFixedLayout(view.isFixedLayout);

        const renderer = view.renderer;
        if (view.isFixedLayout) {
          renderer?.setAttribute("zoom", "fit-page");
        } else {
          renderer?.setAttribute("flow", initialState.flow);
          renderer?.setAttribute("gap", "6%");
          renderer?.setAttribute("margin", "46px");
          renderer?.setAttribute("max-inline-size", "760px");
          renderer?.setAttribute("max-block-size", "1600px");
          renderer?.setAttribute("max-column-count", "2");
          renderer?.setAttribute("animated", "");
        }

        try {
          await view.init({ lastLocation: initialState.cfi, showTextStart: true });
        } catch {
          // Bad CFIs are common after an EPUB is regenerated. Fall back to the
          // publication's text start rather than treating the whole book as broken.
          await view.init({ showTextStart: true });
        }
        if (!cancelled) setLoading(false);
      } catch (nextError) {
        if (!cancelled) {
          setError(nextError);
          setLoading(false);
        }
      }
    };

    void open();
    return () => {
      cancelled = true;
      createdView?.close();
      createdView?.remove();
      if (viewRef.current === createdView) viewRef.current = null;
    };
  }, [epub.data, epub.mtimeMs, epub.name, epub.openError, initialState.cfi, initialState.flow, initialState.fontSize, initialState.tocOpen, injectDocumentTheme]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || fixedLayout) return;
    view.renderer?.setAttribute("flow", flow);
  }, [fixedLayout, flow]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || loading || (!fixedLayout && flow !== "paginated")) return;

    let accumulatedDelta = 0;
    let resetTimer: number | undefined;
    let cooldownTimer: number | undefined;
    let turning = false;
    let disposed = false;
    const wheelTargets = new Set<HTMLElement | ReaderDocument>();

    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const view = viewRef.current;
      if (!view) return;

      const delta = normalizeEpubWheelDelta(event.deltaX, event.deltaY, event.deltaMode);
      if (!delta) return;
      event.preventDefault();
      if (turning) return;

      accumulatedDelta += delta;
      window.clearTimeout(resetTimer);
      resetTimer = window.setTimeout(() => {
        accumulatedDelta = 0;
      }, 180);

      const turn = getEpubWheelTurn(accumulatedDelta);
      if (!turn) return;

      accumulatedDelta = 0;
      turning = true;
      const navigation = turn > 0 ? view.next() : view.prev();
      const finishTurning = () => {
        if (disposed) return;
        cooldownTimer = window.setTimeout(() => {
          turning = false;
        }, 420);
      };
      void navigation.then(finishTurning, finishTurning);
    };

    const attachWheelTarget = (target: HTMLElement | ReaderDocument) => {
      if (wheelTargets.has(target)) return;
      target.addEventListener("wheel", onWheel as EventListener, { passive: false, capture: true });
      wheelTargets.add(target);
    };

    attachDocumentWheelRef.current = attachWheelTarget;
    attachWheelTarget(stage);
    const renderer = viewRef.current?.renderer as FoliateRenderer | undefined;
    for (const content of renderer?.getContents?.() ?? []) attachWheelTarget(content.doc);

    return () => {
      disposed = true;
      attachDocumentWheelRef.current = () => undefined;
      for (const target of wheelTargets) target.removeEventListener("wheel", onWheel as EventListener, true);
      window.clearTimeout(resetTimer);
      window.clearTimeout(cooldownTimer);
    };
  }, [fixedLayout, flow, loading]);

  useEffect(() => {
    refreshLoadedDocuments();
  }, [fontSize, refreshLoadedDocuments, theme]);

  useEffect(() => {
    const state: EpubReadingState = { cfi: locationCfi, flow, fontSize, tocOpen };
    saveEpubReadingState(readingKey, state);
  }, [flow, fontSize, locationCfi, readingKey, tocOpen]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;
      if (event.key === "ArrowLeft" || event.key === "PageUp") {
        event.preventDefault();
        void viewRef.current?.goLeft();
      } else if (event.key === "ArrowRight" || event.key === "PageDown" || event.key === " ") {
        event.preventDefault();
        void viewRef.current?.goRight();
      } else if (event.key === "Home") {
        event.preventDefault();
        void viewRef.current?.goToFraction(0);
      } else if (event.key === "End") {
        event.preventDefault();
        void viewRef.current?.goToFraction(1);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const changeFontSize = useCallback((delta: number) => {
    setFontSize((value) => clampFontSize(value + delta));
  }, []);

  const goToTocItem = useCallback((item: FoliateTocItem) => {
    if (!item.href) return;
    void viewRef.current?.goTo(item.href);
    if (window.innerWidth < 900) setTocOpen(false);
  }, []);

  if (error) {
    return (
      <section className="epub-error" role="alert">
        <div className="epub-error-icon"><AlertTriangle size={28} aria-hidden="true" /></div>
        <h1>{t.errorTitle}</h1>
        <p>{getEpubErrorMessage(error, language)}</p>
        <p className="epub-error-hint">{t.errorHint}</p>
        <button type="button" onClick={onOpenAnother}><FolderOpen size={16} />{t.openAnother}</button>
        <span>{epub.name}</span>
      </section>
    );
  }

  return (
    <section className={`epub-reader${tocOpen ? " has-toc" : ""}${fixedLayout ? " is-fixed-layout" : ""}`}>
      <header className="epub-toolbar">
        <button
          type="button"
          className="epub-tool-button"
          title={t.toc}
          aria-label={t.toc}
          aria-pressed={tocOpen}
          onClick={() => setTocOpen((value) => !value)}
        >
          {tocOpen ? <PanelLeftClose size={17} /> : <PanelLeftOpen size={17} />}
        </button>
        <div className="epub-title-block">
          <strong>{title}</strong>
          <span>{author}</span>
        </div>
        <div className="epub-toolbar-actions">
          {fixedLayout ? <span className="epub-layout-badge">{t.fixedLayout}</span> : (
            <button
              type="button"
              className="epub-tool-button epub-flow-button"
              title={flow === "paginated" ? t.scrolled : t.paginated}
              aria-label={flow === "paginated" ? t.scrolled : t.paginated}
              onClick={() => setFlow((value) => value === "paginated" ? "scrolled" : "paginated")}
            >
              {flow === "paginated" ? <Columns2 size={17} /> : <Rows3 size={17} />}
              <span>{flow === "paginated" ? t.paginated : t.scrolled}</span>
            </button>
          )}
          {!fixedLayout && (
            <div className="epub-font-controls" aria-label={`${fontSize}px`}>
              <button type="button" title={t.decreaseFont} aria-label={t.decreaseFont} disabled={fontSize <= 13} onClick={() => changeFontSize(-1)}><Minus size={15} /></button>
              <span>{fontSize}</span>
              <button type="button" title={t.increaseFont} aria-label={t.increaseFont} disabled={fontSize >= 32} onClick={() => changeFontSize(1)}><Plus size={15} /></button>
            </div>
          )}
        </div>
      </header>

      <div className="epub-reader-body">
        <aside className="epub-toc-panel" aria-label={t.toc}>
          <div className="epub-toc-heading"><ListTree size={16} /><strong>{t.toc}</strong><span>{tocItems.length || "—"}</span></div>
          <div className="epub-toc-list">
            {tocItems.length ? tocItems.map((item, index) => (
              <button
                type="button"
                key={`${item.href ?? "toc"}-${index}`}
                className={sectionLabel && item.label?.trim() === sectionLabel ? "is-active" : ""}
                style={{ paddingInlineStart: `${14 + Math.min(item.depth, 4) * 15}px` }}
                title={item.label}
                disabled={!item.href}
                onClick={() => goToTocItem(item)}
              >
                <span>{item.label?.trim() || `${t.toc} ${index + 1}`}</span>
              </button>
            )) : <p>{t.noToc}</p>}
          </div>
        </aside>

        <main ref={stageRef} className="epub-stage">
          <div ref={hostRef} className="epub-view-host" />
          <button type="button" className="epub-page-button is-previous" title={rightToLeft ? t.next : t.previous} aria-label={rightToLeft ? t.next : t.previous} onClick={() => void viewRef.current?.goLeft()}><ChevronLeft size={22} /></button>
          <button type="button" className="epub-page-button is-next" title={rightToLeft ? t.previous : t.next} aria-label={rightToLeft ? t.previous : t.next} onClick={() => void viewRef.current?.goRight()}><ChevronRight size={22} /></button>
          {loading && (
            <div className="epub-loading" role="status">
              <div className="epub-book-mark"><BookOpenText size={26} /></div>
              <LoaderCircle className="epub-spinner" size={22} />
              <strong>{t.loading}</strong>
              <span>{t.loadHint}</span>
            </div>
          )}
        </main>
      </div>

      <footer className="epub-progress-bar">
        <span className="epub-section-label">{sectionLabel || title}</span>
        <label>
          <span className="sr-only">{t.readingProgress}</span>
          <input
            type="range"
            min="0"
            max="1000"
            value={Math.round(progress * 1000)}
            aria-label={t.readingProgress}
            onChange={(event) => {
              const fraction = Number(event.currentTarget.value) / 1000;
              setProgress(fraction);
              void viewRef.current?.goToFraction(fraction);
            }}
          />
        </label>
        <output>{formatEpubPercent(progress)}</output>
      </footer>
    </section>
  );
}

export const EpubReader = memo(EpubReaderComponent);
