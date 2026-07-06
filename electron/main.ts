import { app, BrowserWindow, dialog, ipcMain, Menu, nativeTheme, shell } from "electron";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

type ThemeMode = "light" | "night";
type SavePayload = {
  filePath: string;
  content: string;
  expectedMtimeMs?: number;
  force?: boolean;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;
let pendingOpenPath: string | null = null;
let watchedFile: string | null = null;
let fileWatcher: fs.FSWatcher | null = null;
let fileWatchTimer: NodeJS.Timeout | null = null;

const isDev = !app.isPackaged;
const devUrl = "http://127.0.0.1:5173";
const productName = "MarkLens";

type AppLanguage = "zh-CN" | "en-US";

const menuText: Record<AppLanguage, {
  file: string;
  edit: string;
  view: string;
  themes: string;
  help: string;
  openFile: string;
  openFolder: string;
  save: string;
  exportHtml: string;
  preferences: string;
  exit: string;
  undo: string;
  redo: string;
  cut: string;
  copy: string;
  paste: string;
  find: string;
  toggleSidebar: string;
  sourceMode: string;
  reload: string;
  devTools: string;
  followSystem: string;
  light: string;
  night: string;
  about: string;
  aboutDetail: string;
  markdownFilter: string;
  folderDialog: string;
  htmlFilter: string;
}> = {
  "zh-CN": {
    file: "文件",
    edit: "编辑",
    view: "视图",
    themes: "主题",
    help: "帮助",
    openFile: "打开文件...",
    openFolder: "打开文件夹...",
    save: "保存",
    exportHtml: "导出 HTML...",
    preferences: "偏好设置...",
    exit: "退出",
    undo: "撤销",
    redo: "重做",
    cut: "剪切",
    copy: "复制",
    paste: "粘贴",
    find: "查找",
    toggleSidebar: "显示/隐藏侧栏",
    sourceMode: "源码模式",
    reload: "重新载入",
    devTools: "开发者工具",
    followSystem: "跟随系统",
    light: "浅色",
    night: "夜间",
    about: "关于 MarkLens",
    aboutDetail: "免费的 Markdown 维护工具。适合阅读、整理、轻量编辑 Markdown 文档，专注打开快、阅读安静、正文优先。",
    markdownFilter: "Markdown 文档",
    folderDialog: "打开文件夹",
    htmlFilter: "HTML 文件"
  },
  "en-US": {
    file: "File",
    edit: "Edit",
    view: "View",
    themes: "Themes",
    help: "Help",
    openFile: "Open File...",
    openFolder: "Open Folder...",
    save: "Save",
    exportHtml: "Export HTML...",
    preferences: "Preferences...",
    exit: "Exit",
    undo: "Undo",
    redo: "Redo",
    cut: "Cut",
    copy: "Copy",
    paste: "Paste",
    find: "Find",
    toggleSidebar: "Toggle Sidebar",
    sourceMode: "Source Mode",
    reload: "Reload",
    devTools: "Developer Tools",
    followSystem: "Follow System",
    light: "Light",
    night: "Night",
    about: "About MarkLens",
    aboutDetail: "A free Markdown maintenance tool for reading, organizing, and lightly editing Markdown documents with fast opening and a document-first layout.",
    markdownFilter: "Markdown Documents",
    folderDialog: "Open Folder",
    htmlFilter: "HTML Files"
  }
};

function getSystemTheme(): ThemeMode {
  return nativeTheme.shouldUseDarkColors ? "night" : "light";
}

function getSystemLanguage(): AppLanguage {
  return app.getLocale().toLowerCase().startsWith("zh") ? "zh-CN" : "en-US";
}

function getText() {
  return menuText[getSystemLanguage()];
}

function isMarkdownLike(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return ext === ".md" || ext === ".markdown" || ext === ".txt";
}

function ensureMarkdownFile(filePath: string) {
  if (!isMarkdownLike(filePath)) {
    throw new Error("Unsupported file type. MarkLens opens .md, .markdown, and .txt files.");
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getLaunchPath(argv: string[]): string | null {
  return argv.find((arg) => {
    if (!arg || arg.startsWith("-")) return false;
    try {
      const stat = fs.existsSync(arg) ? fs.statSync(arg) : null;
      return Boolean(stat?.isFile() && isMarkdownLike(arg));
    } catch {
      return false;
    }
  }) ?? null;
}

function sendCommand(command: string) {
  mainWindow?.webContents.send("app:command", command);
}

function registerWindowShortcuts(window: BrowserWindow) {
  window.webContents.on("before-input-event", (event, input) => {
    if (input.type !== "keyDown" || !input.control || input.alt || input.meta) return;

    const key = input.key.toLowerCase();
    const shift = input.shift;
    const command =
      key === "o" && shift
        ? "open-folder"
        : key === "o"
          ? "open-file"
          : key === "s"
            ? "save"
            : key === "f"
              ? "search"
              : key === ","
                ? "preferences"
                : key === "/"
                  ? "toggle-source"
                  : key === "l" && shift
                    ? "toggle-sidebar"
                    : null;

    if (!command) return;
    event.preventDefault();
    sendCommand(command);
  });
}

function sendOpenPath(filePath: string) {
  if (!mainWindow || mainWindow.webContents.isLoading()) {
    pendingOpenPath = filePath;
    return;
  }
  mainWindow.webContents.send("app:open-path", filePath);
}

function createMenu() {
  const t = getText();
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: t.file,
      submenu: [
        { label: t.openFile, accelerator: "CommandOrControl+O", click: () => sendCommand("open-file") },
        { label: t.openFolder, accelerator: "CommandOrControl+Shift+O", click: () => sendCommand("open-folder") },
        { type: "separator" },
        { label: t.save, accelerator: "CommandOrControl+S", click: () => sendCommand("save") },
        { label: t.exportHtml, click: () => sendCommand("export-html") },
        { type: "separator" },
        { label: t.preferences, accelerator: "CommandOrControl+,", click: () => sendCommand("preferences") },
        { type: "separator" },
        { label: t.exit, role: "quit" }
      ]
    },
    {
      label: t.edit,
      submenu: [
        { label: t.undo, role: "undo" },
        { label: t.redo, role: "redo" },
        { type: "separator" },
        { label: t.cut, role: "cut" },
        { label: t.copy, role: "copy" },
        { label: t.paste, role: "paste" },
        { type: "separator" },
        { label: t.find, accelerator: "CommandOrControl+F", click: () => sendCommand("search") }
      ]
    },
    {
      label: t.view,
      submenu: [
        { label: t.toggleSidebar, accelerator: "CommandOrControl+Shift+L", click: () => sendCommand("toggle-sidebar") },
        { label: t.sourceMode, accelerator: "CommandOrControl+/", click: () => sendCommand("toggle-source") },
        { type: "separator" },
        { label: t.reload, role: "reload" },
        { label: t.devTools, role: "toggleDevTools" }
      ]
    },
    {
      label: t.themes,
      submenu: [
        { label: t.followSystem, click: () => mainWindow?.webContents.send("app:command", "theme-system") },
        { label: t.light, click: () => mainWindow?.webContents.send("app:command", "theme-light") },
        { label: t.night, click: () => mainWindow?.webContents.send("app:command", "theme-night") }
      ]
    },
    {
      label: t.help,
      submenu: [
        {
          label: t.about,
          click: () => {
            dialog.showMessageBox(mainWindow!, {
              type: "info",
              title: productName,
              message: productName,
              detail: t.aboutDetail
            });
          }
        }
      ]
    }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 860,
    minHeight: 560,
    title: productName,
    show: false,
    backgroundColor: getSystemTheme() === "night" ? "#1f1f1f" : "#ffffff",
    icon: path.join(__dirname, "../assets/icon.ico"),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  if (isDev) {
    mainWindow.loadURL(devUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  registerWindowShortcuts(mainWindow);
}

async function readTextFile(filePath: string) {
  ensureMarkdownFile(filePath);
  const stat = await fs.promises.stat(filePath);
  if (!stat.isFile()) {
    throw new Error("Path is not a file.");
  }
  const content = await fs.promises.readFile(filePath, "utf8");
  return {
    filePath,
    name: path.basename(filePath),
    directory: path.dirname(filePath),
    content,
    mtimeMs: stat.mtimeMs,
    size: stat.size
  };
}

async function listDirectory(dirPath: string) {
  const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
  const children = entries
    .filter((entry) => !entry.name.startsWith("."))
    .filter((entry) => entry.isDirectory() || isMarkdownLike(entry.name))
    .slice(0, 800)
    .map((entry) => {
      const childPath = path.join(dirPath, entry.name);
      return {
        name: entry.name,
        path: childPath,
        type: entry.isDirectory() ? "directory" : "file"
      };
    })
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });

  return { path: dirPath, name: path.basename(dirPath) || dirPath, children };
}

function watchFile(filePath: string | null) {
  fileWatcher?.close();
  fileWatcher = null;
  watchedFile = filePath;

  if (!filePath) return;

  try {
    fileWatcher = fs.watch(filePath, { persistent: false }, () => {
      if (!watchedFile) return;
      if (fileWatchTimer) clearTimeout(fileWatchTimer);
      fileWatchTimer = setTimeout(async () => {
        try {
          const stat = await fs.promises.stat(watchedFile!);
          mainWindow?.webContents.send("file:changed", { filePath: watchedFile, mtimeMs: stat.mtimeMs });
        } catch {
          // Ignore deleted or inaccessible files until the user reopens them.
        }
      }, 350);
    });
  } catch {
    watchedFile = null;
  }
}

function registerIpc() {
  ipcMain.handle("dialog:open-file", async () => {
    const t = getText();
    const result = await dialog.showOpenDialog(mainWindow!, {
      title: t.openFile.replace("...", ""),
      properties: ["openFile"],
      filters: [{ name: t.markdownFilter, extensions: ["md", "markdown", "txt"] }]
    });
    if (result.canceled || !result.filePaths[0]) return null;
    return readTextFile(result.filePaths[0]);
  });

  ipcMain.handle("dialog:open-folder", async () => {
    const t = getText();
    const result = await dialog.showOpenDialog(mainWindow!, {
      title: t.folderDialog,
      properties: ["openDirectory"]
    });
    if (result.canceled || !result.filePaths[0]) return null;
    return listDirectory(result.filePaths[0]);
  });

  ipcMain.handle("file:read", async (_event, filePath: string) => readTextFile(filePath));

  ipcMain.handle("file:save", async (_event, payload: SavePayload) => {
    const { filePath, content, expectedMtimeMs, force } = payload;
    const currentStat = await fs.promises.stat(filePath).catch(() => null);
    if (!force && currentStat && expectedMtimeMs && Math.abs(currentStat.mtimeMs - expectedMtimeMs) > 2) {
      return {
        ok: false,
        reason: "conflict",
        mtimeMs: currentStat.mtimeMs
      };
    }

    await fs.promises.writeFile(filePath, content, "utf8");
    const nextStat = await fs.promises.stat(filePath);
    return { ok: true, mtimeMs: nextStat.mtimeMs };
  });

  ipcMain.handle("file:export-html", async (_event, payload: { title: string; html: string; theme: ThemeMode }) => {
    const t = getText();
    const result = await dialog.showSaveDialog(mainWindow!, {
      title: t.exportHtml.replace("...", ""),
      defaultPath: `${payload.title || "document"}.html`,
      filters: [{ name: t.htmlFilter, extensions: ["html"] }]
    });
    if (result.canceled || !result.filePath) return { ok: false, reason: "cancelled" };

    const cssTheme =
      payload.theme === "night"
        ? "body{background:#1f1f1f;color:#d9d9d9}.markdown-body{max-width:860px;margin:48px auto;font:16px/1.72 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}pre,code{background:#2b2b2b}a{color:#7ca7d9}"
        : "body{background:#fff;color:#333}.markdown-body{max-width:860px;margin:48px auto;font:16px/1.72 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}pre,code{background:#f6f8fa}a{color:#2f6fbd}";

    const safeTitle = escapeHtml(payload.title || "document");
    const page = `<!doctype html><html><head><meta charset="utf-8"><title>${safeTitle}</title><style>${cssTheme}</style></head><body><main class="markdown-body">${payload.html}</main></body></html>`;
    await fs.promises.writeFile(result.filePath, page, "utf8");
    shell.showItemInFolder(result.filePath);
    return { ok: true, filePath: result.filePath };
  });

  ipcMain.handle("dir:list", async (_event, dirPath: string) => listDirectory(dirPath));
  ipcMain.handle("file:watch", async (_event, filePath: string | null) => {
    watchFile(filePath);
    return { ok: true };
  });
  ipcMain.handle("theme:get-system", async () => getSystemTheme());
  ipcMain.handle("locale:get-system", async () => app.getLocale());
  ipcMain.on("renderer:ready", () => {
    if (pendingOpenPath) {
      sendOpenPath(pendingOpenPath);
      pendingOpenPath = null;
    }
  });
}

app.setName(productName);
const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", (_event, argv) => {
    const launchPath = getLaunchPath(argv);
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
    if (launchPath) sendOpenPath(launchPath);
  });

  app.whenReady().then(() => {
    pendingOpenPath = getLaunchPath(process.argv);
    registerIpc();
    createMenu();
    createWindow();

    nativeTheme.on("updated", () => {
      mainWindow?.webContents.send("theme:system-changed", getSystemTheme());
    });

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on("open-file", (event, filePath) => {
    event.preventDefault();
    if (!isMarkdownLike(filePath)) return;
    pendingOpenPath = filePath;
    if (mainWindow) sendOpenPath(filePath);
  });

  app.on("window-all-closed", () => {
    fileWatcher?.close();
    if (process.platform !== "darwin") app.quit();
  });
}
