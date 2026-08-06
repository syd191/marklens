/// <reference types="vite/client" />

declare module "markdown-it-task-lists";
declare module "markdown-it-front-matter" {
  import type MarkdownIt from "markdown-it";
  const plugin: MarkdownIt.PluginWithOptions<(frontMatter: string) => void>;
  export default plugin;
}
declare module "markdown-it-toc-done-right" {
  import type MarkdownIt from "markdown-it";
  import type { PresetName } from "markdown-it";
  interface TocOptions {
    placeholder?: string | RegExp;
    slugify?: (s: string) => string;
    listType?: "ul" | "ol";
    level?: number[];
    containerClass?: string;
    containerAttrs?: Record<string, string>;
    listClass?: string;
    itemClass?: string;
    linkClass?: string;
    anchorAttrs?: Record<string, string>;
    [key: string]: unknown;
  }
  const plugin: MarkdownIt.PluginWithOptions<TocOptions>;
  export default plugin;
}

type ThemeMode = "system" | "github" | "newsprint" | "night" | "pixyll" | "whitey";
type ResolvedTheme = "github" | "newsprint" | "night" | "pixyll" | "whitey";

type OpenedFile = {
  filePath: string;
  name: string;
  directory: string;
  content: string;
  mtimeMs: number;
  size: number;
};

type DirectoryChild = {
  name: string;
  path: string;
  type: "directory" | "file";
};

type DirectoryListing = {
  name: string;
  path: string;
  children: DirectoryChild[];
};

type SaveResult =
  | { ok: true; mtimeMs: number }
  | { ok: false; reason: "conflict" | "cancelled" | string; mtimeMs?: number };

type FileOperationResult =
  | { ok: true; path: string; parentPath: string; type: "file" | "directory" }
  | { ok: false; reason: string };

type MarkdownBridge = {
  openFileDialog: () => Promise<OpenedFile | null>;
  openFolderDialog: () => Promise<DirectoryListing | null>;
  readFile: (filePath: string) => Promise<OpenedFile>;
  saveFile: (payload: {
    filePath: string;
    content: string;
    expectedMtimeMs?: number;
    force?: boolean;
  }) => Promise<SaveResult>;
  saveFileAs: (payload: { filePath?: string | null; content: string }) => Promise<OpenedFile | null>;
  moveFile: (filePath: string) => Promise<OpenedFile | null>;
  deleteFile: (filePath: string) => Promise<{ ok: boolean; reason?: string }>;
  getFileProperties: (filePath: string) => Promise<{
    name: string;
    path: string;
    size: number;
    createdAt: number;
    modifiedAt: number;
  } | null>;
  confirmUnsaved: (name: string | null) => Promise<"save" | "discard" | "cancel">;
  resolveSaveConflict: (name: string | null) => Promise<"overwrite" | "reload" | "cancel">;
  exportHtml: (payload: { title: string; html: string; theme: ResolvedTheme }) => Promise<SaveResult>;
  exportPdf: (defaultName: string) => Promise<SaveResult>;
  saveImage: (payload: { directory: string | null; name: string; data: ArrayBuffer }) => Promise<{
    ok: boolean;
    path?: string;
    markdownPath?: string;
    reason?: string;
  }>;
  listDirectory: (dirPath: string) => Promise<DirectoryListing>;
  showInFolder: (targetPath: string) => Promise<{ ok: boolean; reason?: string }>;
  createMarkdown: (parentPath: string) => Promise<FileOperationResult>;
  createFolder: (parentPath: string) => Promise<FileOperationResult>;
  renameEntry: (payload: { targetPath: string; nextName: string }) => Promise<FileOperationResult>;
  watchFile: (filePath: string | null) => Promise<{ ok: boolean }>;
  getSystemTheme: () => Promise<"light" | "night">;
  applyTheme: (themeMode: ThemeMode) => Promise<void>;
  getSystemLanguage: () => Promise<string>;
  openProjectRepository: () => Promise<{ ok: boolean }>;
  createNewWindow: () => Promise<{ ok: boolean }>;
  print: () => Promise<{ ok: boolean; reason?: string }>;
  setFullscreen: (enabled: boolean) => Promise<{ ok: boolean }>;
  setAlwaysOnTop: (enabled: boolean) => Promise<{ ok: boolean }>;
  setZoom: (factor: number) => Promise<{ ok: boolean }>;
  toggleDevTools: () => Promise<{ ok: boolean }>;
  readClipboardText: () => Promise<string>;
  getRecentFiles: () => Promise<string[]>;
  closeWindow: (force?: boolean) => Promise<{ ok: boolean }>;
  getPathForFile: (file: File) => string;
  sendRendererReady: () => void;
  onCommand: (callback: (command: string) => void) => () => void;
  onOpenPath: (callback: (filePath: string) => void) => () => void;
  onFileChanged: (callback: (payload: { filePath: string; mtimeMs: number }) => void) => () => void;
  onSystemThemeChanged: (callback: (theme: "light" | "night") => void) => () => void;
};

interface Window {
  markdownBridge?: MarkdownBridge;
}
