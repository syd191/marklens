import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { MoreMenu } from "./components/MoreMenu";
import { MarkdownPreview } from "./components/MarkdownPreview";
import { PreferencesModal } from "./components/PreferencesModal";
import { SidebarDrawer } from "./components/SidebarDrawer";
import { SourceEditor } from "./components/SourceEditor";
import { StatusBar } from "./components/StatusBar";
import { i18n, resolveLanguage } from "./lib/i18n";
import { buildOutline, getWordCount, renderMarkdownDocument, splitMarkdownIntoChunks } from "./lib/markdown";
import { loadPreferences, savePreferences } from "./lib/storage";
import { useDebouncedEffect } from "./lib/useDebouncedEffect";
import type { AppLanguage, CurrentDocument, Preferences, ResolvedTheme, SaveStatus, SidebarTab } from "./types";

const browserLanguage = typeof navigator !== "undefined" ? navigator.language : "en-US";
const initialSystemTheme: ResolvedTheme =
  typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "night" : "light";
const initialLanguage = resolveLanguage("system", browserLanguage);

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

export default function App() {
  const [document, setDocument] = useState<CurrentDocument>(() => createInitialDocument());
  const [preferences, setPreferences] = useState<Preferences>(() => loadPreferences());
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(initialSystemTheme);
  const [systemLanguage, setSystemLanguage] = useState<AppLanguage>(initialLanguage);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("outline");
  const [sourceMode, setSourceMode] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("clean");
  const [fileRoot, setFileRoot] = useState<DirectoryListing | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [moreOpen, setMoreOpen] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const rendererReadySent = useRef(false);
  const [, startTransition] = useTransition();

  const resolvedTheme = preferences.themeMode === "system" ? systemTheme : preferences.themeMode;
  const language = resolveLanguage(preferences.languageMode, systemLanguage);
  const t = i18n[language];
  const deferredContent = useDeferredValue(document.content);
  const chunks = useMemo(() => splitMarkdownIntoChunks(deferredContent), [deferredContent]);
  const shouldBuildOutline = preferences.preloadOutline || (sidebarOpen && sidebarTab === "outline");
  const outline = useMemo(() => (shouldBuildOutline ? buildOutline(chunks) : []), [chunks, shouldBuildOutline]);
  const wordCount = useMemo(() => getWordCount(deferredContent), [deferredContent]);
  const searchMatches = useMemo(() => getMatches(deferredContent, searchTerm), [deferredContent, searchTerm]);

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
      setMoreOpen(false);
    });
    window.markdownBridge?.watchFile(payload.filePath);
  }, []);

  const openPath = useCallback(
    async (filePath: string) => {
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
    const payload = await window.markdownBridge?.openFileDialog();
    if (payload) openFilePayload(payload);
  }, [openFilePayload]);

  const openFolderDialog = useCallback(async () => {
    const root = await window.markdownBridge?.openFolderDialog();
    if (!root) return;
    setFileRoot(root);
    setSidebarOpen(true);
    setSidebarTab("files");
    setMoreOpen(false);
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
      if (!document.filePath) return;
      setSaveStatus("saving");
      try {
        const result = await window.markdownBridge?.saveFile({
          filePath: document.filePath,
          content: document.content,
          expectedMtimeMs: document.mtimeMs,
          force
        });
        if (result?.ok) {
          setDocument((current) => ({ ...current, mtimeMs: result.mtimeMs }));
          setSaveStatus("saved");
        } else if (result?.reason === "conflict") {
          setSaveStatus("conflict");
        } else {
          setSaveStatus("failed");
        }
      } catch {
        setSaveStatus("failed");
      }
    },
    [document.content, document.filePath, document.mtimeMs]
  );

  const exportHtml = useCallback(async () => {
    const html = renderMarkdownDocument(document.content, document.directory);
    await window.markdownBridge?.exportHtml({ title: document.name.replace(/\.[^.]+$/, ""), html, theme: resolvedTheme });
    setMoreOpen(false);
  }, [document.content, document.directory, document.name, resolvedTheme]);

  const jumpToHeading = useCallback((id: string) => {
    const target = window.document.getElementById(id);
    target?.scrollIntoView({ behavior: preferences.smoothScroll ? "smooth" : "auto", block: "start" });
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
    root.lang = language;
  }, [language, preferences.smoothScroll, resolvedTheme]);

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
    window.markdownBridge?.getSystemTheme().then(setSystemTheme).catch(() => setSystemTheme("light"));
    window.markdownBridge?.getSystemLanguage().then((value) => setSystemLanguage(resolveLanguage("system", value))).catch(() => {
      setSystemLanguage(resolveLanguage("system", browserLanguage));
    });
  }, []);

  useEffect(() => {
    const offTheme = window.markdownBridge?.onSystemThemeChanged(setSystemTheme);
    const offOpenPath = window.markdownBridge?.onOpenPath(openPath);
    const offChanged = window.markdownBridge?.onFileChanged(async ({ filePath, mtimeMs }) => {
      if (!preferences.autoRefresh || filePath !== document.filePath || saveStatus === "saving") return;
      if (document.mtimeMs && Math.abs(document.mtimeMs - mtimeMs) < 2) return;
      const payload = await window.markdownBridge?.readFile(filePath);
      if (payload) openFilePayload(payload);
    });

    const offCommand = window.markdownBridge?.onCommand((command) => {
      if (command === "open-file") openFileDialog();
      if (command === "open-folder") openFolderDialog();
      if (command === "save") saveCurrentFile();
      if (command === "export-html") exportHtml();
      if (command === "preferences") setPreferencesOpen(true);
      if (command === "search") {
        setSidebarOpen(true);
        setSidebarTab("outline");
      }
      if (command === "toggle-sidebar") {
        setSidebarOpen((value) => !value);
        setSidebarTab("outline");
      }
      if (command === "toggle-source") setSourceMode((value) => !value);
      if (command === "theme-system") updatePreferences({ ...preferences, themeMode: "system" });
      if (command === "theme-light") updatePreferences({ ...preferences, themeMode: "light" });
      if (command === "theme-night") updatePreferences({ ...preferences, themeMode: "night" });
    });

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
  }, [
    document.filePath,
    document.mtimeMs,
    exportHtml,
    openFileDialog,
    openFolderDialog,
    openFilePayload,
    openPath,
    preferences,
    saveCurrentFile,
    saveStatus,
    updatePreferences
  ]);

  useDebouncedEffect(
    () => {
      if (!preferences.autoSave || !sourceMode || !document.filePath || saveStatus !== "unsaved") return;
      saveCurrentFile(false);
    },
    preferences.autoSaveDelay,
    [document.content, preferences.autoSave, preferences.autoSaveDelay, saveStatus, sourceMode]
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const modifier = event.ctrlKey || event.metaKey;
      if (!modifier || event.altKey) return;

      const key = event.key.toLowerCase();
      if (key === "o" && event.shiftKey) {
        event.preventDefault();
        openFolderDialog();
        return;
      }
      if (key === "o") {
        event.preventDefault();
        openFileDialog();
        return;
      }
      if (key === "s") {
        event.preventDefault();
        saveCurrentFile();
        return;
      }
      if (key === "f") {
        event.preventDefault();
        setSidebarOpen(true);
        setSidebarTab("outline");
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
  }, [openFileDialog, openFolderDialog, saveCurrentFile]);

  useEffect(() => {
    const onDragOver = (event: DragEvent) => event.preventDefault();
    const onDrop = async (event: DragEvent) => {
      event.preventDefault();
      const file = event.dataTransfer?.files?.[0];
      if (!file) return;
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
    setDocument((current) => ({ ...current, content: value }));
    setSaveStatus("unsaved");
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((value) => !value);
    setSidebarTab("outline");
  }, []);

  return (
    <div className="app-shell">
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
        onClose={() => setSidebarOpen(false)}
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

      <div className={`workspace${sidebarOpen ? " has-sidebar" : ""}`}>
        {sourceMode ? (
          <SourceEditor value={document.content} fontSize={preferences.fontSize} onChange={onContentChange} />
        ) : (
          <MarkdownPreview chunks={chunks} baseDirectory={document.directory} fontSize={preferences.fontSize} />
        )}
      </div>

      <MoreMenu
        t={t}
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        onOpenFile={openFileDialog}
        onOpenFolder={openFolderDialog}
        onPreferences={() => {
          setMoreOpen(false);
          setPreferencesOpen(true);
        }}
        onExportHtml={exportHtml}
      />

      <PreferencesModal
        t={t}
        open={preferencesOpen}
        preferences={preferences}
        onChange={updatePreferences}
        onClose={() => setPreferencesOpen(false)}
      />

      <StatusBar
        t={t}
        sidebarOpen={sidebarOpen}
        sourceMode={sourceMode}
        wordCount={wordCount}
        saveStatus={saveStatus}
        currentName={document.filePath ? document.name : null}
        onToggleSidebar={toggleSidebar}
        onToggleSource={() => setSourceMode((value) => !value)}
        onOpenMore={() => setMoreOpen((value) => !value)}
      />
    </div>
  );
}
