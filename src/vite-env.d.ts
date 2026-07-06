/// <reference types="vite/client" />

declare module "markdown-it-task-lists";

type ThemeMode = "system" | "light" | "night";
type ResolvedTheme = "light" | "night";

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
  exportHtml: (payload: { title: string; html: string; theme: ResolvedTheme }) => Promise<SaveResult>;
  listDirectory: (dirPath: string) => Promise<DirectoryListing>;
  watchFile: (filePath: string | null) => Promise<{ ok: boolean }>;
  getSystemTheme: () => Promise<ResolvedTheme>;
  getSystemLanguage: () => Promise<string>;
  getPathForFile: (file: File) => string;
  sendRendererReady: () => void;
  onCommand: (callback: (command: string) => void) => () => void;
  onOpenPath: (callback: (filePath: string) => void) => () => void;
  onFileChanged: (callback: (payload: { filePath: string; mtimeMs: number }) => void) => () => void;
  onSystemThemeChanged: (callback: (theme: ResolvedTheme) => void) => () => void;
};

interface Window {
  markdownBridge?: MarkdownBridge;
}
