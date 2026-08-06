import { lazy, Suspense, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { FindReplaceBar } from "./components/FindReplaceBar";
import { AboutModal, PROJECT_REPOSITORY_URL } from "./components/AboutModal";
import { MenuBar } from "./components/MenuBar";
import { PreferencesModal } from "./components/PreferencesModal";
import type { RichMarkdownEditorHandle } from "./components/RichMarkdownEditor";
// 富文本编辑器依赖庞大的 MDXEditor/Lexical，仅在使用时才加载，避免拖慢首屏（启动默认源码模式用不到）
const RichMarkdownEditor = lazy(() =>
  import("./components/RichMarkdownEditor").then((m) => ({ default: m.RichMarkdownEditor }))
);
import { SidebarDrawer } from "./components/SidebarDrawer";
import { SourceEditor, type CursorPosition, type SourceEditorHandle } from "./components/SourceEditor";
import { StatusBar } from "./components/StatusBar";
import { WordCountModal } from "./components/WordCountModal";
import { i18n, resolveLanguage } from "./lib/i18n";
import { buildOutline, getWordCount, renderMarkdownDocument, renderMermaidDiagrams, splitMarkdownIntoChunks } from "./lib/markdown";
import { loadPreferences, savePreferences } from "./lib/storage";
import { useDebouncedEffect } from "./lib/useDebouncedEffect";
import type { AppLanguage, CurrentDocument, MarkdownChunk, OutlineItem, Preferences, ResolvedTheme, SaveStatus, SidebarTab } from "./types";

const browserLanguage = typeof navigator !== "undefined" ? navigator.language : "en-US";
const initialSystemTheme: ResolvedTheme =
  typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "night" : "github";
const initialLanguage = resolveLanguage("system", browserLanguage);
// 大纲不需要时复用的空数组，避免每次 render 产生新引用触发 outline useMemo 重算
const EMPTY_CHUNKS: MarkdownChunk[] = [];

function createInitialDocument(): CurrentDocument {
  return {
    filePath: null,
    name: "",
    directory: null,
    content: ""
  };
}

function getMatches(content: string, term: string) {
  if (!term.trim()) return [];
  const lower = term.toLowerCase();
  const result: number[] = [];
  content.split(/\r?\n/).forEach((line, index) => {
    if (line.toLowerCase().includes(lower)) result.push(index + 1);
  });
  return result;
}

function getMatchCount(content: string, term: string) {
  if (!term.trim()) return 0;
  const source = content.toLocaleLowerCase();
  const needle = term.toLocaleLowerCase();
  let count = 0;
  let index = 0;
  while ((index = source.indexOf(needle, index)) >= 0) {
    count += 1;
    index += Math.max(1, needle.length);
  }
  return count;
}

export default function App() {
  const [document, setDocument] = useState<CurrentDocument>(() => createInitialDocument());
  const [preferences, setPreferences] = useState<Preferences>(() => loadPreferences());
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(initialSystemTheme);
  const [systemLanguage, setSystemLanguage] = useState<AppLanguage>(initialLanguage);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("outline");
  // 无文档时默认进入编辑模式（源码/textarea），有内容且未打开文件也保持可编辑；
  // 打开文件时由 openFilePayload 切到富文本预览模式
  const [sourceMode, setSourceMode] = useState(true);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("clean");
  const [fileRoot, setFileRoot] = useState<DirectoryListing | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [findReplaceOpen, setFindReplaceOpen] = useState(false);
  const [replaceTerm, setReplaceTerm] = useState("");
  const [focusMode, setFocusMode] = useState(false);
  const [typewriterMode, setTypewriterMode] = useState(false);
  const [statusBarVisible, setStatusBarVisible] = useState(true);
  const [wordCountOpen, setWordCountOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [alwaysOnTop, setAlwaysOnTop] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [cursor, setCursor] = useState<CursorPosition>({ start: 0, end: 0, line: 1, column: 1 });
  const editorRef = useRef<SourceEditorHandle>(null);
  const richEditorRef = useRef<RichMarkdownEditorHandle>(null);
  // 编辑器容器 ref，用于大纲跳转在富文本模式下按文本查找 heading 元素
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const rendererReadySent = useRef(false);
  const closeInProgressRef = useRef(false);
  const confirmTransitionRef = useRef<() => Promise<boolean>>(async () => true);
  // 用 ref 保存最新的 document/saveStatus/preferences，避免在 IPC 订阅 effect 中
  // 把这些易变值放入依赖数组导致监听器频繁重订阅（#15）以及闭包陈旧问题（#3）
  const documentRef = useRef(document);
  documentRef.current = document;
  const saveStatusRef = useRef(saveStatus);
  saveStatusRef.current = saveStatus;
  const preferencesRef = useRef(preferences);
  preferencesRef.current = preferences;
  // 记录最近一次自动保存成功时的 content 快照，避免保存成功后因 saveStatus 变化
  // 再次触发 effect 重复保存（#2）
  const lastAutoSavedContentRef = useRef<string | null>(null);
  const [, startTransition] = useTransition();
  // sourceMode 的 ref，供稳定引用的 focusEditor 在菜单操作后决定聚焦哪个编辑器
  const sourceModeRef = useRef(sourceMode);
  sourceModeRef.current = sourceMode;

  const resolvedTheme: ResolvedTheme = preferences.themeMode === "system" ? systemTheme : preferences.themeMode;
  const language = resolveLanguage(preferences.languageMode, systemLanguage);
  const t = i18n[language];
  const deferredContent = useDeferredValue(document.content);
  const shouldBuildOutline = preferences.preloadOutline || (sidebarOpen && sidebarTab === "outline");
  // chunks 仅在大纲需要时计算（侧栏关闭/非大纲 tab 时跳过全量切分）
  const chunks = useMemo(
    () => (shouldBuildOutline ? splitMarkdownIntoChunks(deferredContent) : EMPTY_CHUNKS),
    [deferredContent, shouldBuildOutline]
  );
  const outline = useMemo(() => (shouldBuildOutline ? buildOutline(chunks) : []), [chunks, shouldBuildOutline]);
  // 字数统计：依赖低优先级 deferredContent，内容变化时才重算（无需额外 debounce state，避免多余重渲染）
  const wordCount = useMemo(() => getWordCount(deferredContent), [deferredContent]);
  const searchMatches = useMemo(() => getMatches(deferredContent, searchTerm), [deferredContent, searchTerm]);
  const findMatchCount = useMemo(() => getMatchCount(deferredContent, searchTerm), [deferredContent, searchTerm]);

  const updatePreferences = useCallback((next: Preferences) => {
    setPreferences(next);
    savePreferences(next);
  }, []);

  const openFilePayload = useCallback((payload: OpenedFile) => {
    startTransition(() => {
      setDocument({
        filePath: payload.filePath,
        name: payload.name,
        directory: payload.directory,
        content: payload.content,
        mtimeMs: payload.mtimeMs,
        size: payload.size
      });
      setSourceMode(false);
      setSaveStatus("clean");
      setSearchTerm("");
    });
    // 切换文件时重置自动保存快照，避免新文件内容恰好与上一文件相同时被错误跳过
    lastAutoSavedContentRef.current = null;
    window.markdownBridge?.watchFile(payload.filePath);
  }, []);

  const openPath = useCallback(
    async (filePath: string) => {
      if (!(await confirmTransitionRef.current())) return;
      try {
        const payload = await window.markdownBridge?.readFile(filePath);
        if (payload) openFilePayload(payload);
      } catch (error) {
        console.warn("Unable to open file", error);
      }
    },
    [openFilePayload]
  );

  const openFileDialog = useCallback(async () => {
    if (!(await confirmTransitionRef.current())) return;
    const payload = await window.markdownBridge?.openFileDialog();
    if (payload) openFilePayload(payload);
  }, [openFilePayload]);

  const openFolderDialog = useCallback(async () => {
    const root = await window.markdownBridge?.openFolderDialog();
    if (!root) return;
    setFileRoot(root);
    setSidebarOpen(true);
    setSidebarTab("files");
  }, []);

  const listDirectory = useCallback(async (dirPath: string) => {
    const listing = await window.markdownBridge?.listDirectory(dirPath);
    if (!listing) throw new Error("Directory listing is unavailable.");
    return listing;
  }, []);

  const showInFolder = useCallback(async (targetPath: string) => {
    const result = await window.markdownBridge?.showInFolder(targetPath);
    if (!result?.ok) throw new Error(result?.reason ?? "Unable to show item in folder.");
  }, []);

  const createMarkdown = useCallback(
    async (parentPath: string) => {
      const result = await window.markdownBridge?.createMarkdown(parentPath);
      if (result?.ok) {
        const payload = await window.markdownBridge?.readFile(result.path);
        if (payload) openFilePayload(payload);
      }
      return result ?? { ok: false, reason: "unavailable" };
    },
    [openFilePayload]
  );

  const createFolder = useCallback(async (parentPath: string) => {
    const result = await window.markdownBridge?.createFolder(parentPath);
    return result ?? { ok: false, reason: "unavailable" };
  }, []);

  const renameEntry = useCallback(
    async (targetPath: string, nextName: string) => {
      const result = await window.markdownBridge?.renameEntry({ targetPath, nextName });
      if (result?.ok && document.filePath) {
        const targetLower = targetPath.toLowerCase();
        const currentLower = document.filePath.toLowerCase();
        if (result.type === "file" && currentLower === targetLower) {
          const payload = await window.markdownBridge?.readFile(result.path);
          if (payload) openFilePayload(payload);
        }
        if (result.type === "directory" && currentLower.startsWith(`${targetLower}\\`)) {
          const nextPath = `${result.path}${document.filePath.slice(targetPath.length)}`;
          const payload = await window.markdownBridge?.readFile(nextPath);
          if (payload) openFilePayload(payload);
        }
      }
      return result ?? { ok: false, reason: "unavailable" };
    },
    [document.filePath, openFilePayload]
  );

  const saveCurrentFile = useCallback(
    async (force = false) => {
      if (!document.filePath) return false;
      const snapshot = {
        filePath: document.filePath,
        content: document.content,
        mtimeMs: document.mtimeMs,
        name: document.name
      };
      const setSnapshotStatus = (status: SaveStatus) => {
        if (documentRef.current.filePath === snapshot.filePath) setSaveStatus(status);
      };
      const completeSnapshotSave = (mtimeMs: number) => {
        const latest = documentRef.current;
        const isStillCurrent = latest.filePath === snapshot.filePath && latest.content === snapshot.content;
        setDocument((current) =>
          current.filePath === snapshot.filePath ? { ...current, mtimeMs } : current
        );
        setSnapshotStatus(isStillCurrent ? "saved" : "unsaved");
        return isStillCurrent;
      };

      setSaveStatus("saving");
      try {
        const result = await window.markdownBridge?.saveFile({
          filePath: snapshot.filePath,
          content: snapshot.content,
          expectedMtimeMs: snapshot.mtimeMs,
          force
        });
        if (result?.ok) {
          return completeSnapshotSave(result.mtimeMs);
        } else if (result?.reason === "conflict") {
          setSnapshotStatus("conflict");
          const resolution = await window.markdownBridge?.resolveSaveConflict(snapshot.name || null) ?? "cancel";
          if (resolution === "overwrite") {
            const forced = await window.markdownBridge?.saveFile({
              filePath: snapshot.filePath,
              content: snapshot.content,
              expectedMtimeMs: result.mtimeMs,
              force: true
            });
            if (forced?.ok) {
              return completeSnapshotSave(forced.mtimeMs);
            }
            setSnapshotStatus("failed");
          } else if (resolution === "reload") {
            const payload = await window.markdownBridge?.readFile(snapshot.filePath);
            if (payload && documentRef.current.filePath === snapshot.filePath) {
              openFilePayload(payload);
              return true;
            }
            setSnapshotStatus("failed");
          }
        } else {
          setSnapshotStatus("failed");
        }
      } catch {
        setSnapshotStatus("failed");
      }
      return false;
    },
    [document.content, document.filePath, document.mtimeMs, document.name, openFilePayload]
  );

  const saveAs = useCallback(async () => {
    const payload = await window.markdownBridge?.saveFileAs({
      filePath: document.filePath,
      content: document.content
    });
    if (payload) {
      openFilePayload(payload);
      return true;
    }
    return false;
  }, [document.content, document.filePath, openFilePayload]);

  const confirmDocumentTransition = useCallback(async () => {
    if (!["unsaved", "conflict", "failed"].includes(saveStatus)) return true;
    const decision = await window.markdownBridge?.confirmUnsaved(document.name || null) ?? "cancel";
    if (decision === "discard") return true;
    if (decision === "cancel") return false;
    return document.filePath ? saveCurrentFile() : saveAs();
  }, [document.filePath, document.name, saveAs, saveCurrentFile, saveStatus]);
  confirmTransitionRef.current = confirmDocumentTransition;

  const requestClose = useCallback(async () => {
    if (closeInProgressRef.current) return;
    closeInProgressRef.current = true;
    try {
      if (await confirmDocumentTransition()) await window.markdownBridge?.closeWindow(true);
    } finally {
      closeInProgressRef.current = false;
    }
  }, [confirmDocumentTransition]);

  const moveCurrentFile = useCallback(async () => {
    if (!document.filePath) return;
    const payload = await window.markdownBridge?.moveFile(document.filePath);
    if (payload) openFilePayload(payload);
  }, [document.filePath, openFilePayload]);

  const deleteCurrentFile = useCallback(async () => {
    if (!document.filePath) return;
    const result = await window.markdownBridge?.deleteFile(document.filePath);
    if (result?.ok) {
      // 先停止文件监听，再清空状态，避免旧监听器在状态提交前触发（#1）
      window.markdownBridge?.watchFile(null);
      setDocument(createInitialDocument());
      setSaveStatus("clean");
      setFileRoot(null);
    }
  }, [document.filePath]);

  const showProperties = useCallback(async () => {
    if (!document.filePath) return;
    const value = await window.markdownBridge?.getFileProperties(document.filePath);
    if (!value) return;
    window.alert(
      `${value.name}\n\n${value.path}\n${value.size.toLocaleString()} bytes\n` +
      `创建：${new Date(value.createdAt).toLocaleString()}\n修改：${new Date(value.modifiedAt).toLocaleString()}`
    );
  }, [document.filePath]);

  const exportHtml = useCallback(async () => {
    const rawHtml = renderMarkdownDocument(document.content, document.directory);
    // 预渲染 mermaid 图表为 SVG，使导出的 HTML 自包含、可离线查看
    const html = await renderMermaidDiagrams(rawHtml, resolvedTheme === "night");
    await window.markdownBridge?.exportHtml({ title: document.name.replace(/\.[^.]+$/, ""), html, theme: resolvedTheme });
  }, [document.content, document.directory, document.name, resolvedTheme]);

  const exportPdf = useCallback(async () => {
    await window.markdownBridge?.exportPdf(document.name.replace(/\.[^.]+$/, "") || "document");
  }, [document.name]);

  const createNewDocument = useCallback(async () => {
    if (!(await confirmDocumentTransition())) return;
    setDocument(createInitialDocument());
    setSourceMode(true);
    setSaveStatus("unsaved");
    setSearchTerm("");
    setReplaceTerm("");
    // 重置自动保存快照，避免连续创建空文档时第二个被跳过
    lastAutoSavedContentRef.current = null;
    window.markdownBridge?.watchFile(null);
    window.requestAnimationFrame(() => editorRef.current?.focus());
  }, [confirmDocumentTransition]);

  const runEditorCommand = useCallback((command: string) => {
    if (!sourceMode && richEditorRef.current?.execute(command)) return;
    // 切换到源码模式后，SourceEditor 尚未挂载，editorRef.current 仍为 null。
    // 使用 requestAnimationFrame 等待挂载完成后再执行，并再次校验 ref 存在（#4）
    const run = () => {
      const target = editorRef.current;
      if (!target) {
        // 若仍未挂载，再等一帧后重试一次
        window.requestAnimationFrame(() => editorRef.current?.execute(command));
        return;
      }
      target.execute(command);
    };
    if (!sourceMode) {
      setSourceMode(true);
      window.requestAnimationFrame(run);
    } else {
      run();
    }
  }, [sourceMode]);

  const jumpToHeading = useCallback((item: OutlineItem) => {
    // 优先按 markdown-it 渲染管线生成的 id 定位（源码模式预览/导出 HTML 场景）
    const target = window.document.getElementById(item.id);
    if (target) {
      target.scrollIntoView({ behavior: preferences.smoothScroll ? "smooth" : "auto", block: "start" });
      return;
    }
    // 富文本模式（MDXEditor）下 heading 元素无 id，回退按层级+文本在编辑器内查找。
    const editor = editorContainerRef.current;
    if (editor) {
      const tagName = `h${Math.min(6, Math.max(1, item.level))}`;
      const normalizedText = item.text.trim();
      const headings = editor.querySelectorAll<HTMLElement>(tagName);
      for (const heading of headings) {
        if (heading.textContent?.trim() === normalizedText) {
          heading.scrollIntoView({ behavior: preferences.smoothScroll ? "smooth" : "auto", block: "start" });
          return;
        }
      }
    }
  }, [preferences.smoothScroll]);

  const jumpToSearchMatch = useCallback(
    (line: number) => {
      const chunk = chunks.find((item, index) => {
        const next = chunks[index + 1];
        return line >= item.startLine + 1 && (!next || line < next.startLine + 1);
      });
      const selector = chunk ? `.markdown-chunk[data-start-line="${chunk.startLine}"]` : ".markdown-chunk";
      window.document.querySelector(selector)?.scrollIntoView({ behavior: preferences.smoothScroll ? "smooth" : "auto" });
    },
    [chunks, preferences.smoothScroll]
  );

  useEffect(() => {
    const root = window.document.documentElement;
    root.dataset.theme = resolvedTheme;
    root.dataset.smoothScroll = preferences.smoothScroll ? "true" : "false";
    root.dataset.focusMode = focusMode ? "true" : "false";
    root.dataset.statusBar = statusBarVisible ? "true" : "false";
    root.style.colorScheme = resolvedTheme === "night" ? "dark" : "light";
    root.lang = language;
    // 通知主进程更新标题栏 overlay 与窗口背景色，使标题栏精确匹配主题（#16）
    window.markdownBridge?.applyTheme(preferences.themeMode);
  }, [focusMode, language, preferences.smoothScroll, resolvedTheme, statusBarVisible, preferences.themeMode]);

  // 切换主题会触发 App 重渲染导致编辑器失焦，主题变化后用 rAF 循环
  // 重新聚焦编辑区（直到焦点真正落到编辑器上），恢复 caret
  // 若模态框打开（偏好设置/关于/字数/查找替换）则跳过，避免抢走模态框内的焦点
  const firstThemeRenderRef = useRef(true);
  const modalOpenRef = useRef(false);
  modalOpenRef.current = preferencesOpen || aboutOpen || wordCountOpen || findReplaceOpen;
  useEffect(() => {
    if (firstThemeRenderRef.current) {
      firstThemeRenderRef.current = false;
      return;
    }
    let raf = 0;
    let attempts = 0;
    const tryFocus = () => {
      attempts += 1;
      if (modalOpenRef.current) return;
      if (sourceModeRef.current) editorRef.current?.focus();
      else richEditorRef.current?.focus();
      const active = window.document.activeElement;
      const ok = active && (active.closest(".source-editor") || active.closest(".rich-markdown-content") || active.tagName === "TEXTAREA");
      if (ok || attempts > 20) return;
      raf = window.requestAnimationFrame(tryFocus);
    };
    raf = window.requestAnimationFrame(tryFocus);
    return () => window.cancelAnimationFrame(raf);
  }, [resolvedTheme]);

  useEffect(() => {
    if (!document.directory || fileRoot?.path === document.directory) return;

    let ignore = false;
    window.markdownBridge
      ?.listDirectory(document.directory)
      .then((root) => {
        if (!ignore) setFileRoot(root);
      })
      .catch(() => {
        // The Files tab can still fall back to the manual folder picker.
      });

    return () => {
      ignore = true;
    };
  }, [document.directory, fileRoot?.path]);

  useEffect(() => {
    window.markdownBridge?.getSystemTheme().then((theme) => setSystemTheme(theme === "night" ? "night" : "github")).catch(() => setSystemTheme("github"));
    window.markdownBridge?.getSystemLanguage().then((value) => setSystemLanguage(resolveLanguage("system", value))).catch(() => {
      setSystemLanguage(resolveLanguage("system", browserLanguage));
    });
  }, []);

  // IPC 监听只注册一次；每次事件触发时再读取最新操作，避免输入过程中因
  // document 变化反复解除/注册 Electron 监听器。
  const ipcActions = {
    createNewDocument,
    deleteCurrentFile,
    exportHtml,
    exportPdf,
    language,
    moveCurrentFile,
    openFileDialog,
    openFolderDialog,
    openFilePayload,
    openPath,
    requestClose,
    runEditorCommand,
    saveAs,
    saveCurrentFile,
    showInFolder,
    showProperties,
    updatePreferences
  };
  const ipcActionsRef = useRef(ipcActions);
  ipcActionsRef.current = ipcActions;

  // 统一命令分发：原生菜单/HTML 菜单栏/快捷键都走这里。
  // 通过 ref 读取最新的 document/preferences/actions，保持函数引用稳定（#15）
  const dispatchCommand = useCallback((command: string) => {
    const actions = ipcActionsRef.current;
    const currentDoc = documentRef.current;
    const currentPrefs = preferencesRef.current;
    if (command === "new") void actions.createNewDocument();
    if (command === "new-window") window.markdownBridge?.createNewWindow();
    if (command === "open-file") actions.openFileDialog();
    if (command === "quick-open" || command === "import") actions.openFileDialog();
    if (command === "open-folder") actions.openFolderDialog();
    if (command === "save") {
      if (currentDoc.filePath) void actions.saveCurrentFile();
      else void actions.saveAs();
    }
    if (command === "save-as") actions.saveAs();
    if (command === "move-to") actions.moveCurrentFile();
    if (command === "save-all") actions.saveCurrentFile();
    if (command === "properties") actions.showProperties();
    if (command === "show-in-folder" && currentDoc.filePath) actions.showInFolder(currentDoc.filePath);
    if (command === "delete-file") actions.deleteCurrentFile();
    if (command === "export-html") actions.exportHtml();
    if (command === "export-pdf") actions.exportPdf();
    if (command === "print") window.markdownBridge?.print();
    if (command === "preferences") setPreferencesOpen(true);
    if (command === "about") setAboutOpen(true);
    if (command === "close-window" || command === "request-close") void actions.requestClose();
    if (command === "find-replace") {
      setSourceMode(true);
      setFindReplaceOpen(true);
    }
    if (command === "show-search") {
      setSidebarOpen(true);
      setSidebarTab("search");
    }
    if (command === "toggle-sidebar") {
      setSidebarOpen((value) => !value);
      setSidebarTab("outline");
    }
    if (command === "show-outline") {
      setSidebarOpen(true);
      setSidebarTab("outline");
    }
    if (command === "show-files") {
      setSidebarOpen(true);
      setSidebarTab("files");
    }
    if (command === "toggle-source") setSourceMode((value) => !value);
    if (command === "toggle-focus") setFocusMode((value) => !value);
    if (command === "toggle-typewriter") {
      setTypewriterMode((value) => !value);
    }
    if (command === "toggle-status-bar") setStatusBarVisible((value) => !value);
    if (command === "word-count") setWordCountOpen(true);
    if (command === "toggle-fullscreen") {
      setFullscreen((value) => {
        window.markdownBridge?.setFullscreen(!value);
        return !value;
      });
    }
    if (command === "toggle-always-on-top") {
      setAlwaysOnTop((value) => {
        window.markdownBridge?.setAlwaysOnTop(!value);
        return !value;
      });
    }
    if (command === "toggle-spellcheck") {
      actions.updatePreferences({ ...currentPrefs, spellCheck: !currentPrefs.spellCheck });
    }
    if (command === "toggle-devtools") window.markdownBridge?.toggleDevTools();
    if (command === "emoji") {
      window.alert(actions.language.startsWith("zh") ? "请按 Win + . 打开 Windows 表情与符号面板。" : "Press Win + . to open the Windows emoji and symbols panel.");
    }
    if (command === "theme-system") actions.updatePreferences({ ...currentPrefs, themeMode: "system" });
    if (command === "theme-github") actions.updatePreferences({ ...currentPrefs, themeMode: "github" });
    if (command === "theme-newsprint") actions.updatePreferences({ ...currentPrefs, themeMode: "newsprint" });
    if (command === "theme-night") actions.updatePreferences({ ...currentPrefs, themeMode: "night" });
    if (command === "theme-pixyll") actions.updatePreferences({ ...currentPrefs, themeMode: "pixyll" });
    if (command === "theme-whitey") actions.updatePreferences({ ...currentPrefs, themeMode: "whitey" });

    const editorCommands = new Set([
      "undo", "redo", "copy-plain", "copy-markdown", "copy-html", "paste-plain",
      "select-all", "select-line", "move-line-up", "move-line-down", "delete", "delete-line",
      "smart-punctuation", "normalize-line-endings", "trim-whitespace",
      "heading-1", "heading-2", "heading-3", "heading-4", "heading-5", "heading-6",
      "paragraph", "promote-heading", "demote-heading", "table", "math-block", "code-block",
      "warning", "quote", "ordered-list", "unordered-list", "task-list", "indent-list",
      "outdent-list", "insert-paragraph-above", "insert-paragraph-below", "link-reference",
      "footnote", "horizontal-rule", "toc", "front-matter", "bold", "italic", "underline",
      "inline-code", "strikethrough", "comment", "link", "image", "clear-format"
    ]);
    if (editorCommands.has(command)) actions.runEditorCommand(command);
  }, []);
  const dispatchCommandRef = useRef(dispatchCommand);
  dispatchCommandRef.current = dispatchCommand;

  useEffect(() => {
    const offTheme = window.markdownBridge?.onSystemThemeChanged((theme) => setSystemTheme(theme === "night" ? "night" : "github"));
    const offOpenPath = window.markdownBridge?.onOpenPath((filePath) => ipcActionsRef.current.openPath(filePath));
    // 文件外部变化通知：通过 ref 读取最新的 document/saveStatus/preferences，
    // 避免把这些易变值放入依赖数组导致监听器频繁重订阅（#15、#3）
    const offChanged = window.markdownBridge?.onFileChanged(async ({ filePath, mtimeMs }) => {
      const currentDoc = documentRef.current;
      const currentStatus = saveStatusRef.current;
      const currentPrefs = preferencesRef.current;
      if (!currentPrefs.autoRefresh || filePath !== currentDoc.filePath) return;
      if (currentStatus !== "clean" && currentStatus !== "saved") return;
      if (currentDoc.mtimeMs && Math.abs(currentDoc.mtimeMs - mtimeMs) < 2) return;
      const payload = await window.markdownBridge?.readFile(filePath);
      // 异步读取期间用户可能切换文件或开始编辑。只有文档、内容、mtime 与
      // 保存状态都仍是读取前快照时，才允许应用外部内容。
      const latestDoc = documentRef.current;
      const latestStatus = saveStatusRef.current;
      if (
        latestDoc.filePath !== currentDoc.filePath ||
        latestDoc.content !== currentDoc.content ||
        latestDoc.mtimeMs !== currentDoc.mtimeMs ||
        (latestStatus !== "clean" && latestStatus !== "saved")
      ) return;
      if (payload) ipcActionsRef.current.openFilePayload(payload);
    });

    // 命令通道：复用 dispatchCommand，避免与 MenuBar 重复维护（#15）
    const offCommand = window.markdownBridge?.onCommand((command) => dispatchCommandRef.current(command));

    if (!rendererReadySent.current) {
      rendererReadySent.current = true;
      window.markdownBridge?.sendRendererReady();
    }

    return () => {
      offTheme?.();
      offOpenPath?.();
      offChanged?.();
      offCommand?.();
    };
  }, []);

  // 启动时聚焦编辑器：rich 模式由 RichMarkdownEditor 内部 autoFocus 处理；
  // 这里仅处理 source 模式（textarea focus 即可显示 caret）
  useEffect(() => {
    if (!sourceMode) return;
    const timer = setTimeout(() => editorRef.current?.focus(), 100);
    return () => clearTimeout(timer);
  }, []);

  useDebouncedEffect(
    () => {
      if (!preferences.autoSave || !document.filePath || saveStatus !== "unsaved") return;
      // 防止保存成功后 saveStatus 由 "unsaved" -> "saved" 触发本 effect 再次执行：
      // 仅当 content 与上次成功自动保存的快照不同时才保存（#2）
      if (lastAutoSavedContentRef.current === document.content) return;
      void saveCurrentFile(false).then((ok) => {
        if (ok) lastAutoSavedContentRef.current = document.content;
      });
    },
    preferences.autoSaveDelay,
    [document.content, preferences.autoSave, preferences.autoSaveDelay, saveStatus]
  );

  // 用 ref 保存高频变化的回调，避免每次输入都重注册 keydown 监听器
  const saveCurrentFileRef = useRef(saveCurrentFile);
  saveCurrentFileRef.current = saveCurrentFile;
  const saveAsRef = useRef(saveAs);
  saveAsRef.current = saveAs;
  const createNewDocumentRef = useRef(createNewDocument);
  createNewDocumentRef.current = createNewDocument;
  const openFileDialogRef = useRef(openFileDialog);
  openFileDialogRef.current = openFileDialog;
  const openFolderDialogRef = useRef(openFolderDialog);
  openFolderDialogRef.current = openFolderDialog;
  const filePathRef = useRef(document.filePath);
  filePathRef.current = document.filePath;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "F8") {
        event.preventDefault();
        setFocusMode((value) => !value);
        return;
      }
      if (event.key === "F9") {
        event.preventDefault();
        setTypewriterMode((value) => !value);
        return;
      }
      if (event.key === "Escape" && findReplaceOpen) {
        setFindReplaceOpen(false);
        return;
      }

      const modifier = event.ctrlKey || event.metaKey;
      if (!modifier || event.altKey) return;

      const key = event.key.toLowerCase();
      if (key === "n") {
        event.preventDefault();
        void createNewDocumentRef.current();
        return;
      }
      if (key === "o" && event.shiftKey) {
        event.preventDefault();
        openFolderDialogRef.current();
        return;
      }
      if (key === "o") {
        event.preventDefault();
        openFileDialogRef.current();
        return;
      }
      if (key === "s") {
        event.preventDefault();
        if (event.shiftKey) saveAsRef.current();
        else if (filePathRef.current) saveCurrentFileRef.current();
        else saveAsRef.current();
        return;
      }
      if (key === "f") {
        event.preventDefault();
        setSourceMode(true);
        setFindReplaceOpen(true);
        return;
      }
      if (key === ",") {
        event.preventDefault();
        setPreferencesOpen(true);
        return;
      }
      if (key === "/") {
        event.preventDefault();
        setSourceMode((value) => !value);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [findReplaceOpen]);

  useEffect(() => {
    const onDragOver = (event: DragEvent) => event.preventDefault();
    const onDrop = async (event: DragEvent) => {
      const file = event.dataTransfer?.files?.[0];
      if (!file) return;
      const target = event.target instanceof Element ? event.target : null;
      if (file.type.startsWith("image/") && target?.closest(".rich-editor-shell")) return;
      event.preventDefault();
      if (!/\.(md|markdown|txt)$/i.test(file.name)) return;
      const filePath = window.markdownBridge?.getPathForFile(file);
      if (filePath) openPath(filePath);
    };
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("drop", onDrop);
    };
  }, [openPath]);

  const onContentChange = useCallback((value: string) => {
    setDocument((current) => {
      if (current.content === value) return current;
      return { ...current, content: value };
    });
    setSaveStatus((prev) => (prev === "unsaved" ? prev : "unsaved"));
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((value) => !value);
    setSidebarTab("outline");
  }, []);

  const replaceAll = useCallback(() => {
    if (!searchTerm) return;
    const escaped = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // 使用函数形式替换，避免 replaceTerm 中的 $&、$1 等被当作替换模式解释
    const next = document.content.replace(new RegExp(escaped, "gi"), () => replaceTerm);
    if (next !== document.content) onContentChange(next);
  }, [document.content, onContentChange, replaceTerm, searchTerm]);

  const changeZoom = useCallback((next: number) => {
    setZoom(next);
    window.markdownBridge?.setZoom(next / 100);
  }, []);
  const zoomIn = useCallback(() => changeZoom(Math.min(200, zoom + 10)), [changeZoom, zoom]);
  const zoomOut = useCallback(() => changeZoom(Math.max(50, zoom - 10)), [changeZoom, zoom]);
  const zoomReset = useCallback(() => changeZoom(100), [changeZoom]);
  // 菜单操作后恢复编辑区焦点（用 rAF 等 state 更新完成后），恢复 caret
  const focusEditor = useCallback(() => {
    window.requestAnimationFrame(() => {
      if (sourceModeRef.current) editorRef.current?.focus();
      else richEditorRef.current?.focus();
    });
  }, []);
  const requestSourceMode = useCallback(() => setSourceMode(true), []);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  return (
    <div className={`app-shell${focusMode ? " is-focus-mode" : ""}${statusBarVisible ? "" : " is-status-hidden"}`}>
      <MenuBar
        language={language}
        themeMode={preferences.themeMode}
        sourceMode={sourceMode}
        focusMode={focusMode}
        typewriterMode={typewriterMode}
        statusBar={statusBarVisible}
        onCommand={dispatchCommand}
        onOpenPath={openPath}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onZoomReset={zoomReset}
        onFocusEditor={focusEditor}
      />
      <SidebarDrawer
        t={t}
        open={sidebarOpen}
        tab={sidebarTab}
        outline={outline}
        fileRoot={fileRoot}
        currentPath={document.filePath}
        searchTerm={searchTerm}
        searchMatches={searchMatches}
        onSetTab={setSidebarTab}
        onClose={closeSidebar}
        onJump={jumpToHeading}
        onOpenFolder={openFolderDialog}
        onOpenFile={openPath}
        onRootUpdate={setFileRoot}
        onShowInFolder={showInFolder}
        onCreateMarkdown={createMarkdown}
        onCreateFolder={createFolder}
        onRenameEntry={renameEntry}
        onSearchTermChange={setSearchTerm}
        onJumpToSearchMatch={jumpToSearchMatch}
        listDirectory={listDirectory}
      />

      <div className={`workspace${sidebarOpen ? " has-sidebar" : ""}`} ref={editorContainerRef}>
        {sourceMode ? (
          <SourceEditor
            key={document.filePath ?? "untitled"}
            ref={editorRef}
            value={document.content}
            baseDirectory={document.directory}
            fontSize={preferences.fontSize}
            spellCheck={preferences.spellCheck}
            typewriterMode={typewriterMode}
            onChange={onContentChange}
            onCursorChange={setCursor}
          />
        ) : (
          <Suspense fallback={<div className="rich-editor-shell" />}>
            <RichMarkdownEditor
              key={document.filePath ?? "untitled-rich"}
              ref={richEditorRef}
              markdown={document.content}
              baseDirectory={document.directory}
              fontSize={preferences.fontSize}
              spellCheck={preferences.spellCheck}
              typewriterMode={typewriterMode}
              onChange={onContentChange}
              onRequestSourceMode={requestSourceMode}
            />
          </Suspense>
        )}
        <FindReplaceBar
          t={t}
          open={findReplaceOpen}
          term={searchTerm}
          replacement={replaceTerm}
          matchCount={findMatchCount}
          onTermChange={setSearchTerm}
          onReplacementChange={setReplaceTerm}
          onFind={(backwards) => editorRef.current?.findNext(searchTerm, backwards)}
          onReplace={() => editorRef.current?.replaceCurrent(searchTerm, replaceTerm)}
          onReplaceAll={replaceAll}
          onClose={() => setFindReplaceOpen(false)}
        />
      </div>

      <PreferencesModal
        t={t}
        open={preferencesOpen}
        preferences={preferences}
        onChange={updatePreferences}
        onClose={() => setPreferencesOpen(false)}
      />

      <AboutModal
        t={t}
        open={aboutOpen}
        onClose={() => setAboutOpen(false)}
        onOpenProject={() => {
          if (window.markdownBridge) {
            void window.markdownBridge.openProjectRepository();
            return;
          }
          window.open(PROJECT_REPOSITORY_URL, "_blank", "noopener,noreferrer");
        }}
      />

      <WordCountModal
        t={t}
        open={wordCountOpen}
        content={document.content}
        words={wordCount}
        onClose={() => setWordCountOpen(false)}
      />

      {statusBarVisible && <StatusBar
        t={t}
        sidebarOpen={sidebarOpen}
        sourceMode={sourceMode}
        focusMode={focusMode}
        typewriterMode={typewriterMode}
        wordCount={wordCount}
        line={cursor.line}
        column={cursor.column}
        zoom={zoom}
        saveStatus={saveStatus}
        currentName={document.filePath ? document.name : null}
        onToggleSidebar={toggleSidebar}
        onToggleSource={() => setSourceMode((value) => !value)}
        onToggleFocus={() => setFocusMode((value) => !value)}
        onToggleTypewriter={() => {
          setTypewriterMode((value) => !value);
        }}
        onOpenWordCount={() => setWordCountOpen(true)}
        onZoomChange={changeZoom}
      />}
    </div>
  );
}
