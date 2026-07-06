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
  exportHtml: (payload: { title: string; html: string; theme: "light" | "night" }) =>
    ipcRenderer.invoke("file:export-html", payload),
  listDirectory: (dirPath: string) => ipcRenderer.invoke("dir:list", dirPath),
  showInFolder: (targetPath: string) => ipcRenderer.invoke("fs:show-in-folder", targetPath),
  createMarkdown: (parentPath: string) => ipcRenderer.invoke("fs:create-markdown", parentPath),
  createFolder: (parentPath: string) => ipcRenderer.invoke("fs:create-folder", parentPath),
  renameEntry: (payload: { targetPath: string; nextName: string }) => ipcRenderer.invoke("fs:rename", payload),
  watchFile: (filePath: string | null) => ipcRenderer.invoke("file:watch", filePath),
  getSystemTheme: () => ipcRenderer.invoke("theme:get-system"),
  getSystemLanguage: () => ipcRenderer.invoke("locale:get-system"),
  getPathForFile: (file: File) => webUtils.getPathForFile(file),
  sendRendererReady: () => ipcRenderer.send("renderer:ready"),
  onCommand: (callback: (command: string) => void) => on<string>("app:command", callback),
  onOpenPath: (callback: (filePath: string) => void) => on<string>("app:open-path", callback),
  onFileChanged: (callback: (payload: { filePath: string; mtimeMs: number }) => void) =>
    on<{ filePath: string; mtimeMs: number }>("file:changed", callback),
  onSystemThemeChanged: (callback: (theme: "light" | "night") => void) =>
    on<"light" | "night">("theme:system-changed", callback)
});
