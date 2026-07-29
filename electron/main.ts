import { app, BrowserWindow, dialog, ipcMain, Menu, nativeTheme, shell, type WebContents } from "electron";
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
type FileOperationResult =
  | { ok: true; path: string; parentPath: string; type: "file" | "directory" }
  | { ok: false; reason: string };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;
let pendingOpenPath: string | null = null;
const fileWatchers = new Map<number, {
  filePath: string;
  watcher: fs.FSWatcher;
  timer: NodeJS.Timeout | null;
}>();
const watcherCleanupRegistered = new Set<number>();
const forceCloseWindows = new Set<number>();
const recentPaths: string[] = [];

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

async function ensureDirectoryPath(dirPath: string) {
  const stat = await fs.promises.stat(dirPath);
  if (!stat.isDirectory()) throw new Error("Path is not a directory.");
}

function isValidEntryName(name: string) {
  const trimmed = name.trim();
  if (!trimmed || trimmed === "." || trimmed === "..") return false;
  if (/[<>:"/\\|?*\x00-\x1F]/.test(trimmed)) return false;
  if (/[. ]$/.test(trimmed)) return false;
  return !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i.test(trimmed);
}

async function exists(filePath: string) {
  return fs.promises.access(filePath).then(() => true, () => false);
}

async function getUniqueChildPath(parentPath: string, baseName: string, extension = "") {
  let index = 0;
  while (index < 1000) {
    const suffix = index === 0 ? "" : ` ${index + 1}`;
    const candidate = path.join(parentPath, `${baseName}${suffix}${extension}`);
    if (!(await exists(candidate))) return candidate;
    index += 1;
  }
  throw new Error("Unable to create a unique name.");
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
  const target = BrowserWindow.getFocusedWindow() ?? mainWindow;
  target?.webContents.send("app:command", command);
}

function sendCommandToAll(command: string) {
  BrowserWindow.getAllWindows().forEach((window) => {
    if (!window.isDestroyed()) window.webContents.send("app:command", command);
  });
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
  const target = BrowserWindow.getFocusedWindow() ?? mainWindow;
  if (!target || target.webContents.isLoading()) {
    pendingOpenPath = filePath;
    return;
  }
  target.webContents.send("app:open-path", filePath);
}

function createMenu() {
  const t = getText();
  const zh = getSystemLanguage() === "zh-CN";
  const l = (chinese: string, english: string) => zh ? chinese : english;
  const command = (label: string, action: string, accelerator?: string): Electron.MenuItemConstructorOptions => ({
    label,
    accelerator,
    click: () => sendCommand(action)
  });
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: t.file,
      submenu: [
        command(l("新建", "New"), "new", "CommandOrControl+N"),
        command(l("新建窗口", "New Window"), "new-window", "CommandOrControl+Shift+N"),
        { type: "separator" },
        { label: t.openFile, accelerator: "CommandOrControl+O", click: () => sendCommand("open-file") },
        { label: t.openFolder, click: () => sendCommand("open-folder") },
        command(l("快速打开...", "Quick Open..."), "quick-open", "CommandOrControl+P"),
        {
          label: l("打开最近文件", "Open Recent"),
          submenu: recentPaths.length
            ? recentPaths.map((filePath) => ({
                label: path.basename(filePath),
                sublabel: filePath,
                click: () => sendOpenPath(filePath)
              }))
            : [{ label: l("没有最近文件", "No Recent Files"), enabled: false }]
        },
        { type: "separator" },
        { label: t.save, accelerator: "CommandOrControl+S", click: () => sendCommand("save") },
        command(l("另存为...", "Save As..."), "save-as", "CommandOrControl+Shift+S"),
        command(l("移动到...", "Move To..."), "move-to"),
        {
          label: l("保存全部打开的文件", "Save All Open Files"),
          click: () => sendCommandToAll("save")
        },
        { type: "separator" },
        command(l("属性...", "Properties..."), "properties"),
        command(l("打开文件位置...", "Show in File Explorer..."), "show-in-folder"),
        command(l("删除...", "Delete..."), "delete-file"),
        { type: "separator" },
        command(l("导入...", "Import..."), "import"),
        {
          label: l("导出", "Export"),
          submenu: [
            command(l("HTML...", "HTML..."), "export-html"),
            command(l("PDF...", "PDF..."), "export-pdf")
          ]
        },
        command(l("打印...", "Print..."), "print", "Alt+Shift+P"),
        { type: "separator" },
        { label: t.preferences, accelerator: "CommandOrControl+,", click: () => sendCommand("preferences") },
        { type: "separator" },
        command(l("关闭", "Close"), "close-window", "CommandOrControl+W")
      ]
    },
    {
      label: t.edit,
      submenu: [
        command(t.undo, "undo", "CommandOrControl+Z"),
        command(t.redo, "redo", "CommandOrControl+Y"),
        { type: "separator" },
        { label: t.cut, role: "cut" },
        { label: t.copy, role: "copy" },
        { label: t.paste, role: "paste" },
        { type: "separator" },
        command(l("复制为纯文本", "Copy as Plain Text"), "copy-plain"),
        command(l("复制为 Markdown", "Copy as Markdown"), "copy-markdown", "CommandOrControl+Shift+C"),
        command(l("复制为 HTML 代码", "Copy as HTML Code"), "copy-html"),
        command(l("复制内容并简化格式", "Copy and Simplify Formatting"), "copy-plain"),
        { type: "separator" },
        command(l("粘贴为纯文本", "Paste as Plain Text"), "paste-plain", "CommandOrControl+Shift+V"),
        {
          label: l("选择", "Select"),
          submenu: [
            command(l("全选", "Select All"), "select-all", "CommandOrControl+A"),
            command(l("选择当前行", "Select Current Line"), "select-line")
          ]
        },
        command(l("上移该行", "Move Line Up"), "move-line-up", "Alt+Up"),
        command(l("下移该行", "Move Line Down"), "move-line-down", "Alt+Down"),
        { type: "separator" },
        command(l("删除", "Delete"), "delete"),
        {
          label: l("删除范围", "Delete Range"),
          submenu: [
            command(l("删除当前行", "Delete Current Line"), "delete-line"),
            command(l("删除选中内容", "Delete Selection"), "delete")
          ]
        },
        { type: "separator" },
        command(l("数学工具", "Math Tools"), "math-block"),
        command(l("智能标点", "Smart Punctuation"), "smart-punctuation"),
        command(l("换行符", "Line Endings"), "normalize-line-endings"),
        command(l("空格与换行", "Spaces and Line Breaks"), "trim-whitespace"),
        command(l("拼写检查...", "Spell Check..."), "toggle-spellcheck"),
        { type: "separator" },
        command(l("查找和替换", "Find and Replace"), "find-replace", "CommandOrControl+F"),
        command(l("表情与符号", "Emoji & Symbols"), "emoji")
      ]
    },
    {
      label: l("段落", "Paragraph"),
      submenu: [
        ...([1, 2, 3, 4, 5, 6] as const).map((level) =>
          command(l(`${["一", "二", "三", "四", "五", "六"][level - 1]}级标题`, `Heading ${level}`), `heading-${level}`, `CommandOrControl+${level}`)
        ),
        { type: "separator" },
        command(l("段落", "Paragraph"), "paragraph", "CommandOrControl+0"),
        { type: "separator" },
        command(l("提升标题级别", "Promote Heading"), "promote-heading", "CommandOrControl+="),
        command(l("降低标题级别", "Demote Heading"), "demote-heading", "CommandOrControl+-"),
        { type: "separator" },
        command(l("表格", "Table"), "table"),
        command(l("公式块", "Math Block"), "math-block", "CommandOrControl+Shift+M"),
        command(l("代码块", "Code Block"), "code-block", "CommandOrControl+Shift+K"),
        command(l("警告框", "Callout"), "warning"),
        { type: "separator" },
        command(l("引用", "Quote"), "quote", "CommandOrControl+Shift+Q"),
        { type: "separator" },
        command(l("有序列表", "Ordered List"), "ordered-list", "CommandOrControl+Shift+["),
        command(l("无序列表", "Unordered List"), "unordered-list", "CommandOrControl+Shift+]"),
        command(l("任务列表", "Task List"), "task-list", "CommandOrControl+Shift+X"),
        command(l("增加列表缩进", "Indent List"), "indent-list", "Tab"),
        command(l("减少列表缩进", "Outdent List"), "outdent-list", "Shift+Tab"),
        { type: "separator" },
        command(l("在上方插入段落", "Insert Paragraph Above"), "insert-paragraph-above"),
        command(l("在下方插入段落", "Insert Paragraph Below"), "insert-paragraph-below"),
        { type: "separator" },
        command(l("链接引用", "Link Reference"), "link-reference"),
        command(l("脚注", "Footnote"), "footnote"),
        { type: "separator" },
        command(l("水平分割线", "Horizontal Rule"), "horizontal-rule"),
        command(l("内容目录", "Table of Contents"), "toc"),
        command("YAML Front Matter", "front-matter")
      ]
    },
    {
      label: l("格式", "Format"),
      submenu: [
        command(l("加粗", "Bold"), "bold", "CommandOrControl+B"),
        command(l("斜体", "Italic"), "italic", "CommandOrControl+I"),
        command(l("下划线", "Underline"), "underline", "CommandOrControl+U"),
        command(l("代码", "Code"), "inline-code", "CommandOrControl+Shift+`"),
        { type: "separator" },
        command(l("删除线", "Strikethrough"), "strikethrough", "Alt+Shift+5"),
        command(l("注释", "Comment"), "comment"),
        { type: "separator" },
        command(l("超链接", "Hyperlink"), "link", "CommandOrControl+K"),
        command(l("图像", "Image"), "image"),
        { type: "separator" },
        command(l("清除样式", "Clear Formatting"), "clear-format", "CommandOrControl+\\")
      ]
    },
    {
      label: t.view,
      submenu: [
        { label: t.toggleSidebar, accelerator: "CommandOrControl+Shift+L", click: () => sendCommand("toggle-sidebar") },
        command(l("大纲", "Outline"), "show-outline", "CommandOrControl+Shift+1"),
        command(l("文档列表", "Document List"), "show-files", "CommandOrControl+Shift+2"),
        command(l("文件树", "File Tree"), "show-files", "CommandOrControl+Shift+3"),
        command(l("搜索", "Search"), "show-search", "CommandOrControl+Shift+F"),
        { type: "separator" },
        { label: t.sourceMode, accelerator: "CommandOrControl+/", click: () => sendCommand("toggle-source") },
        { type: "separator" },
        command(l("专注模式", "Focus Mode"), "toggle-focus", "F8"),
        command(l("打字机模式", "Typewriter Mode"), "toggle-typewriter", "F9"),
        { type: "separator" },
        command(l("显示状态栏", "Show Status Bar"), "toggle-status-bar"),
        command(l("字数统计窗口", "Word Count"), "word-count"),
        { type: "separator" },
        command(l("切换全屏", "Toggle Full Screen"), "toggle-fullscreen", "F11"),
        command(l("保持窗口在最前端", "Always on Top"), "toggle-always-on-top"),
        { type: "separator" },
        { label: l("实际大小", "Actual Size"), role: "resetZoom", accelerator: "CommandOrControl+Shift+9" },
        { label: l("放大", "Zoom In"), role: "zoomIn", accelerator: "CommandOrControl+Shift+=" },
        { label: l("缩小", "Zoom Out"), role: "zoomOut", accelerator: "CommandOrControl+Shift+-" },
        { type: "separator" },
        {
          label: l("应用内窗口切换", "Switch Application Window"),
          submenu: BrowserWindow.getAllWindows().map((window, index) => ({
            label: window.getTitle() || `${productName} ${index + 1}`,
            type: "radio",
            checked: window === BrowserWindow.getFocusedWindow(),
            click: () => {
              if (window.isMinimized()) window.restore();
              window.show();
              window.focus();
            }
          }))
        },
        { type: "separator" },
        { label: t.devTools, role: "toggleDevTools", accelerator: "Shift+F12" }
      ]
    },
    {
      label: t.themes,
      submenu: [
        command(t.followSystem, "theme-system"),
        command("Github", "theme-github"),
        command("Newsprint", "theme-newsprint"),
        command("Night", "theme-night"),
        command("Pixyll", "theme-pixyll"),
        command("Whitey", "theme-whitey")
      ]
    },
    {
      label: t.help,
      submenu: [
        {
          label: t.about,
          click: () => {
            const owner = BrowserWindow.getFocusedWindow() ?? mainWindow;
            if (!owner) return;
            dialog.showMessageBox(owner, {
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
  const window = new BrowserWindow({
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
  mainWindow = window;
  const webContentsId = window.webContents.id;

  if (isDev) {
    window.loadURL(devUrl);
  } else {
    window.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  window.once("ready-to-show", () => {
    window.show();
  });

  window.on("focus", createMenu);
  window.on("close", (event) => {
    if (forceCloseWindows.delete(window.id)) return;
    event.preventDefault();
    window.webContents.send("app:command", "request-close");
  });
  window.on("closed", () => {
    stopWatchingFile(webContentsId);
    mainWindow = BrowserWindow.getAllWindows().at(-1) ?? null;
    createMenu();
  });

  registerWindowShortcuts(window);
  createMenu();
}

async function readTextFile(filePath: string) {
  ensureMarkdownFile(filePath);
  const stat = await fs.promises.stat(filePath);
  if (!stat.isFile()) {
    throw new Error("Path is not a file.");
  }
  const content = await fs.promises.readFile(filePath, "utf8");
  const existingIndex = recentPaths.findIndex((item) => item.toLowerCase() === filePath.toLowerCase());
  if (existingIndex >= 0) recentPaths.splice(existingIndex, 1);
  recentPaths.unshift(filePath);
  recentPaths.splice(10);
  app.addRecentDocument(filePath);
  createMenu();
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

async function createMarkdownFile(parentPath: string): Promise<FileOperationResult> {
  try {
    await ensureDirectoryPath(parentPath);
    const baseName = getSystemLanguage() === "zh-CN" ? "新建 Markdown" : "New Markdown";
    const filePath = await getUniqueChildPath(parentPath, baseName, ".md");
    await fs.promises.writeFile(filePath, "", { encoding: "utf8", flag: "wx" });
    return { ok: true, path: filePath, parentPath, type: "file" };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : "create-failed" };
  }
}

async function createFolder(parentPath: string): Promise<FileOperationResult> {
  try {
    await ensureDirectoryPath(parentPath);
    const baseName = getSystemLanguage() === "zh-CN" ? "新建文件夹" : "New Folder";
    const folderPath = await getUniqueChildPath(parentPath, baseName);
    await fs.promises.mkdir(folderPath);
    return { ok: true, path: folderPath, parentPath, type: "directory" };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : "create-failed" };
  }
}

async function renameEntry(targetPath: string, nextName: string): Promise<FileOperationResult> {
  try {
    const cleanName = nextName.trim();
    if (!isValidEntryName(cleanName)) return { ok: false, reason: "invalid-name" };

    const stat = await fs.promises.stat(targetPath);
    const parentPath = path.dirname(targetPath);
    const nextPath = path.join(parentPath, cleanName);
    if (stat.isFile() && isMarkdownLike(targetPath) && !isMarkdownLike(nextPath)) {
      return { ok: false, reason: "invalid-extension" };
    }
    if (path.resolve(targetPath) === path.resolve(nextPath)) {
      return { ok: true, path: targetPath, parentPath, type: stat.isDirectory() ? "directory" : "file" };
    }
    if (await exists(nextPath)) return { ok: false, reason: "already-exists" };

    await fs.promises.rename(targetPath, nextPath);
    return { ok: true, path: nextPath, parentPath, type: stat.isDirectory() ? "directory" : "file" };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : "rename-failed" };
  }
}

function stopWatchingFile(webContentsId: number) {
  const current = fileWatchers.get(webContentsId);
  if (!current) return;
  if (current.timer) clearTimeout(current.timer);
  current.watcher.close();
  fileWatchers.delete(webContentsId);
}

function watchFile(sender: WebContents, filePath: string | null) {
  stopWatchingFile(sender.id);
  if (!filePath || sender.isDestroyed()) return;

  try {
    const state = {
      filePath,
      watcher: fs.watch(filePath, { persistent: false }, () => {
        const current = fileWatchers.get(sender.id);
        if (!current || current.filePath !== filePath) return;
        if (current.timer) clearTimeout(current.timer);
        current.timer = setTimeout(async () => {
          try {
            const stat = await fs.promises.stat(filePath);
            if (!sender.isDestroyed()) sender.send("file:changed", { filePath, mtimeMs: stat.mtimeMs });
          } catch {
            // Ignore deleted or inaccessible files until the user reopens them.
          }
        }, 350);
      }),
      timer: null as NodeJS.Timeout | null
    };
    fileWatchers.set(sender.id, state);
    if (!watcherCleanupRegistered.has(sender.id)) {
      watcherCleanupRegistered.add(sender.id);
      sender.once("destroyed", () => {
        stopWatchingFile(sender.id);
        watcherCleanupRegistered.delete(sender.id);
      });
    }
  } catch {
    stopWatchingFile(sender.id);
  }
}

function registerIpc() {
  ipcMain.handle("dialog:open-file", async (event) => {
    const t = getText();
    const owner = BrowserWindow.fromWebContents(event.sender) ?? mainWindow;
    if (!owner) return null;
    const result = await dialog.showOpenDialog(owner, {
      title: t.openFile.replace("...", ""),
      properties: ["openFile"],
      filters: [{ name: t.markdownFilter, extensions: ["md", "markdown", "txt"] }]
    });
    if (result.canceled || !result.filePaths[0]) return null;
    return readTextFile(result.filePaths[0]);
  });

  ipcMain.handle("dialog:open-folder", async (event) => {
    const t = getText();
    const owner = BrowserWindow.fromWebContents(event.sender) ?? mainWindow;
    if (!owner) return null;
    const result = await dialog.showOpenDialog(owner, {
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

  ipcMain.handle("file:save-as", async (event, payload: { filePath?: string | null; content: string }) => {
    const owner = BrowserWindow.fromWebContents(event.sender) ?? mainWindow!;
    const result = await dialog.showSaveDialog(owner, {
      title: getSystemLanguage() === "zh-CN" ? "另存为" : "Save As",
      defaultPath: payload.filePath ?? "Untitled.md",
      filters: [{ name: getText().markdownFilter, extensions: ["md", "markdown", "txt"] }]
    });
    if (result.canceled || !result.filePath) return null;
    const target = path.extname(result.filePath) ? result.filePath : `${result.filePath}.md`;
    await fs.promises.writeFile(target, payload.content, "utf8");
    return readTextFile(target);
  });

  ipcMain.handle("file:move", async (event, filePath: string) => {
    if (!(await exists(filePath))) return null;
    const owner = BrowserWindow.fromWebContents(event.sender) ?? mainWindow!;
    const result = await dialog.showSaveDialog(owner, {
      title: getSystemLanguage() === "zh-CN" ? "移动到" : "Move To",
      defaultPath: filePath,
      filters: [{ name: getText().markdownFilter, extensions: ["md", "markdown", "txt"] }]
    });
    if (result.canceled || !result.filePath || path.resolve(result.filePath) === path.resolve(filePath)) return null;
    await fs.promises.rename(filePath, result.filePath);
    return readTextFile(result.filePath);
  });

  ipcMain.handle("file:delete", async (event, filePath: string) => {
    if (!(await exists(filePath))) return { ok: false, reason: "not-found" };
    const owner = BrowserWindow.fromWebContents(event.sender) ?? mainWindow!;
    const confirmation = await dialog.showMessageBox(owner, {
      type: "warning",
      buttons: getSystemLanguage() === "zh-CN" ? ["移到回收站", "取消"] : ["Move to Recycle Bin", "Cancel"],
      defaultId: 1,
      cancelId: 1,
      title: productName,
      message: getSystemLanguage() === "zh-CN" ? `删除“${path.basename(filePath)}”？` : `Delete “${path.basename(filePath)}”?`,
      detail: getSystemLanguage() === "zh-CN" ? "文件将移到回收站。" : "The file will be moved to the Recycle Bin."
    });
    if (confirmation.response !== 0) return { ok: false, reason: "cancelled" };
    await shell.trashItem(filePath);
    return { ok: true };
  });

  ipcMain.handle("file:properties", async (_event, filePath: string) => {
    const stat = await fs.promises.stat(filePath).catch(() => null);
    if (!stat) return null;
    return {
      name: path.basename(filePath),
      path: filePath,
      size: stat.size,
      createdAt: stat.birthtimeMs,
      modifiedAt: stat.mtimeMs
    };
  });

  ipcMain.handle("dialog:confirm-unsaved", async (event, name: string | null) => {
    const owner = BrowserWindow.fromWebContents(event.sender) ?? mainWindow;
    if (!owner) return "cancel";
    const zh = getSystemLanguage() === "zh-CN";
    const result = await dialog.showMessageBox(owner, {
      type: "warning",
      buttons: zh ? ["保存", "不保存", "取消"] : ["Save", "Don't Save", "Cancel"],
      defaultId: 0,
      cancelId: 2,
      title: productName,
      message: zh
        ? `是否保存对“${name || "未命名文档"}”的更改？`
        : `Do you want to save changes to “${name || "Untitled"}”?`,
      detail: zh ? "如果不保存，更改将会丢失。" : "Your changes will be lost if you don't save them."
    });
    return (["save", "discard", "cancel"] as const)[result.response] ?? "cancel";
  });

  ipcMain.handle("dialog:resolve-save-conflict", async (event, name: string | null) => {
    const owner = BrowserWindow.fromWebContents(event.sender) ?? mainWindow;
    if (!owner) return "cancel";
    const zh = getSystemLanguage() === "zh-CN";
    const result = await dialog.showMessageBox(owner, {
      type: "warning",
      buttons: zh ? ["覆盖磁盘文件", "重新载入", "取消"] : ["Overwrite", "Reload", "Cancel"],
      defaultId: 2,
      cancelId: 2,
      title: productName,
      message: zh
        ? `“${name || "当前文档"}”已被其他程序修改。`
        : `“${name || "This document"}” was modified by another application.`,
      detail: zh
        ? "覆盖会保留 MarkLens 中的内容；重新载入会丢弃当前更改。"
        : "Overwrite keeps the MarkLens version; reload discards the current edits."
    });
    return (["overwrite", "reload", "cancel"] as const)[result.response] ?? "cancel";
  });

  ipcMain.handle("file:export-html", async (event, payload: { title: string; html: string; theme: string }) => {
    const t = getText();
    const owner = BrowserWindow.fromWebContents(event.sender) ?? mainWindow!;
    const result = await dialog.showSaveDialog(owner, {
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

  ipcMain.handle("file:export-pdf", async (event, defaultName: string) => {
    const owner = BrowserWindow.fromWebContents(event.sender) ?? mainWindow!;
    const result = await dialog.showSaveDialog(owner, {
      title: getSystemLanguage() === "zh-CN" ? "导出 PDF" : "Export PDF",
      defaultPath: `${defaultName || "document"}.pdf`,
      filters: [{ name: "PDF", extensions: ["pdf"] }]
    });
    if (result.canceled || !result.filePath) return { ok: false, reason: "cancelled" };
    const data = await event.sender.printToPDF({ printBackground: true, pageSize: "A4" });
    await fs.promises.writeFile(result.filePath, data);
    shell.showItemInFolder(result.filePath);
    return { ok: true, filePath: result.filePath };
  });

  ipcMain.handle("image:save", async (event, payload: { directory: string | null; name: string; data: ArrayBuffer }) => {
    try {
      const sourceExtension = path.extname(payload.name).toLowerCase();
      const extension = [".png", ".jpg", ".jpeg", ".gif", ".webp"].includes(sourceExtension) ? sourceExtension : ".png";
      const baseName = path.basename(payload.name, sourceExtension)
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, "-")
        .replace(/[. ]+$/g, "")
        .slice(0, 80) || "image";

      let targetPath: string;
      let markdownPath: string;
      if (payload.directory) {
        const assetDirectory = path.join(payload.directory, "assets");
        await fs.promises.mkdir(assetDirectory, { recursive: true });
        targetPath = await getUniqueChildPath(assetDirectory, baseName, extension);
        markdownPath = `assets/${path.basename(targetPath)}`;
      } else {
        const owner = BrowserWindow.fromWebContents(event.sender) ?? mainWindow!;
        const result = await dialog.showSaveDialog(owner, {
          title: getSystemLanguage() === "zh-CN" ? "保存图片" : "Save Image",
          defaultPath: `${baseName}${extension}`,
          filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "gif", "webp"] }]
        });
        if (result.canceled || !result.filePath) return { ok: false, reason: "cancelled" };
        targetPath = result.filePath;
        markdownPath = `file:///${targetPath.replace(/\\/g, "/")}`;
      }

      await fs.promises.writeFile(targetPath, Buffer.from(payload.data));
      return { ok: true, path: targetPath, markdownPath };
    } catch (error) {
      return { ok: false, reason: error instanceof Error ? error.message : "image-save-failed" };
    }
  });

  ipcMain.handle("dir:list", async (_event, dirPath: string) => listDirectory(dirPath));
  ipcMain.handle("fs:show-in-folder", async (_event, targetPath: string) => {
    if (!(await exists(targetPath))) return { ok: false, reason: "not-found" };
    shell.showItemInFolder(targetPath);
    return { ok: true };
  });
  ipcMain.handle("fs:create-markdown", async (_event, parentPath: string) => createMarkdownFile(parentPath));
  ipcMain.handle("fs:create-folder", async (_event, parentPath: string) => createFolder(parentPath));
  ipcMain.handle("fs:rename", async (_event, payload: { targetPath: string; nextName: string }) =>
    renameEntry(payload.targetPath, payload.nextName)
  );
  ipcMain.handle("file:watch", async (event, filePath: string | null) => {
    watchFile(event.sender, filePath);
    return { ok: true };
  });
  ipcMain.handle("theme:get-system", async () => getSystemTheme());
  ipcMain.handle("locale:get-system", async () => app.getLocale());
  ipcMain.handle("window:new", async () => {
    createWindow();
    return { ok: true };
  });
  ipcMain.handle("window:print", async (event) => {
    const result = await new Promise<boolean>((resolve) => {
      event.sender.print({ printBackground: true }, (success) => resolve(success));
    });
    return result ? { ok: true } : { ok: false, reason: "print-failed" };
  });
  ipcMain.handle("window:set-fullscreen", async (event, enabled: boolean) => {
    BrowserWindow.fromWebContents(event.sender)?.setFullScreen(enabled);
    return { ok: true };
  });
  ipcMain.handle("window:set-always-on-top", async (event, enabled: boolean) => {
    BrowserWindow.fromWebContents(event.sender)?.setAlwaysOnTop(enabled);
    return { ok: true };
  });
  ipcMain.handle("window:set-zoom", async (event, factor: number) => {
    event.sender.setZoomFactor(Math.max(0.5, Math.min(2, factor)));
    return { ok: true };
  });
  ipcMain.handle("window:close", async (event, force = false) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window && force) forceCloseWindows.add(window.id);
    window?.close();
    return { ok: true };
  });
  ipcMain.on("renderer:ready", (event) => {
    if (pendingOpenPath) {
      event.sender.send("app:open-path", pendingOpenPath);
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
      BrowserWindow.getAllWindows().forEach((window) => {
        if (!window.isDestroyed()) window.webContents.send("theme:system-changed", getSystemTheme());
      });
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
    [...fileWatchers.keys()].forEach(stopWatchingFile);
    if (process.platform !== "darwin") app.quit();
  });
}
