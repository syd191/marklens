import { contextBridge, ipcRenderer, webUtils } from "electron";

type Unsubscribe = () => void;

const on = <T,>(channel: string, callback: (payload: T) => void): Unsubscribe => {
  const listener = (_event: Electron.IpcRendererEvent, payload: T) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
};

contextBridge.exposeInMainWorld("markdownBridge", {
  openFileDialog: () => ipcRenderer.invoke("dialog:open-file"),
  openFolderDialog: () => ipcRenderer.invoke("dialog:open-folder"),
  readFile: (filePath: string) => ipcRenderer.invoke("file:read", filePath),
  saveFile: (payload: { filePath: string; content: string; expectedMtimeMs?: number; force?: boolean }) =>
    ipcRenderer.invoke("file:save", payload),
  saveFileAs: (payload: { filePath?: string | null; content: string }) => ipcRenderer.invoke("file:save-as", payload),
  moveFile: (filePath: string) => ipcRenderer.invoke("file:move", filePath),
  deleteFile: (filePath: string) => ipcRenderer.invoke("file:delete", filePath),
  getFileProperties: (filePath: string) => ipcRenderer.invoke("file:properties", filePath),
  confirmUnsaved: (name: string | null) => ipcRenderer.invoke("dialog:confirm-unsaved", name),
  resolveSaveConflict: (name: string | null) => ipcRenderer.invoke("dialog:resolve-save-conflict", name),
  exportHtml: (payload: { title: string; html: string; theme: "github" | "newsprint" | "night" | "pixyll" | "whitey" }) =>
    ipcRenderer.invoke("file:export-html", payload),
  exportPdf: (defaultName: string) => ipcRenderer.invoke("file:export-pdf", defaultName),
  saveImage: (payload: { directory: string | null; name: string; data: ArrayBuffer }) =>
    ipcRenderer.invoke("image:save", payload),
  listDirectory: (dirPath: string) => ipcRenderer.invoke("dir:list", dirPath),
  showInFolder: (targetPath: string) => ipcRenderer.invoke("fs:show-in-folder", targetPath),
  createMarkdown: (parentPath: string) => ipcRenderer.invoke("fs:create-markdown", parentPath),
  createFolder: (parentPath: string) => ipcRenderer.invoke("fs:create-folder", parentPath),
  renameEntry: (payload: { targetPath: string; nextName: string }) => ipcRenderer.invoke("fs:rename", payload),
  watchFile: (filePath: string | null) => ipcRenderer.invoke("file:watch", filePath),
  getSystemTheme: () => ipcRenderer.invoke("theme:get-system"),
  applyTheme: (themeMode: string) => ipcRenderer.invoke("theme:apply", themeMode),
  getSystemLanguage: () => ipcRenderer.invoke("locale:get-system"),
  openProjectRepository: () => ipcRenderer.invoke("app:open-project-repository"),
  createNewWindow: () => ipcRenderer.invoke("window:new"),
  print: () => ipcRenderer.invoke("window:print"),
  setFullscreen: (enabled: boolean) => ipcRenderer.invoke("window:set-fullscreen", enabled),
  setAlwaysOnTop: (enabled: boolean) => ipcRenderer.invoke("window:set-always-on-top", enabled),
  setZoom: (factor: number) => ipcRenderer.invoke("window:set-zoom", factor),
  toggleDevTools: () => ipcRenderer.invoke("window:toggle-devtools"),
  readClipboardText: () => ipcRenderer.invoke("clipboard:read-text"),
  getRecentFiles: () => ipcRenderer.invoke("app:get-recent-files"),
  closeWindow: (force = false) => ipcRenderer.invoke("window:close", force),
  getPathForFile: (file: File) => webUtils.getPathForFile(file),
  sendRendererReady: () => ipcRenderer.send("renderer:ready"),
  onCommand: (callback: (command: string) => void) => on<string>("app:command", callback),
  onOpenPath: (callback: (filePath: string) => void) => on<string>("app:open-path", callback),
  onFileChanged: (callback: (payload: { filePath: string; mtimeMs: number }) => void) =>
    on<{ filePath: string; mtimeMs: number }>("file:changed", callback),
  onSystemThemeChanged: (callback: (theme: "light" | "night") => void) =>
    on<"light" | "night">("theme:system-changed", callback)
});
