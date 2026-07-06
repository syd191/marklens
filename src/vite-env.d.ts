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
  exportHtml: (payload: { title: string; html: string; theme: ResolvedTheme }) => Promise<SaveResult>;
  listDirectory: (dirPath: string) => Promise<DirectoryListing>;
  showInFolder: (targetPath: string) => Promise<{ ok: boolean; reason?: string }>;
  createMarkdown: (parentPath: string) => Promise<FileOperationResult>;
  createFolder: (parentPath: string) => Promise<FileOperationResult>;
  renameEntry: (payload: { targetPath: string; nextName: string }) => Promise<FileOperationResult>;
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
