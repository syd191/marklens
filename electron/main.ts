import { app, BrowserWindow, clipboard, dialog, ipcMain, Menu, nativeTheme, shell, type WebContents } from "electron";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";

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
const projectRepositoryUrl = "https://github.com/syd191/marklens";

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
  markdownFilter: string;
  allSupportedFilter: string;
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
    markdownFilter: "Markdown 文档",
    allSupportedFilter: "所有支持的文件",
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
    markdownFilter: "Markdown Documents",
    allSupportedFilter: "All Supported Files",
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

function isEpubFile(filePath: string): boolean {
  return path.extname(filePath).toLowerCase() === ".epub";
}

function isPdfFile(filePath: string): boolean {
  return path.extname(filePath).toLowerCase() === ".pdf";
}

function isOpenableFile(filePath: string): boolean {
  return isMarkdownLike(filePath) || isEpubFile(filePath) || isPdfFile(filePath);
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
      return Boolean(stat?.isFile() && isOpenableFile(arg));
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
            owner.webContents.send("app:command", "about");
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
    // 自定义标题栏：保留系统按钮（最小化/最大化/关闭），背景色与符号色可控，
    // 使每个主题的标题栏颜色精确匹配（如 newsprint 的米色、pixyll 的暖白）
    titleBarStyle: "hidden",
    titleBarOverlay: {
      color: getSystemTheme() === "night" ? "#1f1f1f" : "#ffffff",
      symbolColor: getSystemTheme() === "night" ? "#d8d8d8" : "#262626",
      height: 32
    },
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

  // 隐藏原生菜单栏（改由渲染进程自绘 HTML 菜单栏，颜色随主题变化），
  // 但保留原生菜单以维持 role 快捷键（剪贴板/缩放/devTools）有效。
  // 不设 autoHideMenuBar，避免按 Alt 临时唤出原生菜单造成双菜单
  window.setMenuBarVisibility(false);

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

// ===== EPUB 支持 =====

type EpubTocItem = {
  id: string;
  text: string;
  level: number;
  src?: string;
};

type EpubSpineItem = {
  id: string;
  href: string;
};

type OpenedEpub = {
  filePath: string;
  name: string;
  directory: string;
  title: string;
  author: string;
  toc: EpubTocItem[];
  spine: EpubSpineItem[];
  size: number;
};

// EPUB ZIP 缓存：key=filePath，避免反复解压
const epubCache = new Map<string, JSZip>();
// EPUB 元数据缓存：key=filePath
const epubMetaCache = new Map<string, { spine: EpubSpineItem[]; toc: EpubTocItem[] }>();

// 从 XML 字符串中提取所有匹配标签的属性
function extractTags(xml: string, tagName: string): { attrs: Record<string, string>; text: string; raw: string }[] {
  const results: { attrs: Record<string, string>; text: string; raw: string }[] = [];
  // 匹配自闭合和非自闭合标签
  const selfCloseRe = new RegExp(`<${tagName}\\b([^>]*?)\\/>`, "gi");
  const openCloseRe = new RegExp(`<${tagName}\\b([^>]*?)>([\\s\\S]*?)<\\/${tagName}>`, "gi");

  // 先处理自闭合标签
  let m: RegExpExecArray | null;
  while ((m = selfCloseRe.exec(xml)) !== null) {
    const attrs = parseAttrs(m[1]);
    results.push({ attrs, text: "", raw: m[0] });
  }

  // 再处理开闭标签
  while ((m = openCloseRe.exec(xml)) !== null) {
    const attrs = parseAttrs(m[1]);
    const text = m[2].replace(/<[^>]*>/g, "").trim();
    results.push({ attrs, text, raw: m[0] });
  }

  return results;
}

function parseAttrs(attrStr: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /(\w[\w:-]*)\s*=\s*"([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(attrStr)) !== null) {
    attrs[m[1].toLowerCase()] = m[2];
  }
  return attrs;
}

function extractAttr(xml: string, tagName: string, attrName: string): string | null {
  const re = new RegExp(`<${tagName}\\b[^>]*?\\b${attrName}\\s*=\\s*"([^"]*)"`, "i");
  const m = re.exec(xml);
  return m ? m[1] : null;
}

function extractText(xml: string, tagName: string): string | null {
  const re = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i");
  const m = re.exec(xml);
  return m ? m[1].replace(/<[^>]*>/g, "").trim() : null;
}

async function readEpubFile(filePath: string): Promise<OpenedEpub> {
  const stat = await fs.promises.stat(filePath);
  if (!stat.isFile()) throw new Error("Path is not a file.");
  const data = await fs.promises.readFile(filePath);
  const zip = await JSZip.loadAsync(data);
  epubCache.set(filePath, zip);

  // 解析 container.xml 获取 OPF 路径
  const containerFile = zip.file("META-INF/container.xml");
  if (!containerFile) throw new Error("Invalid EPUB: missing container.xml");
  const containerXml = await containerFile.async("string");
  const opfPath = extractAttr(containerXml, "rootfile", "full-path");
  if (!opfPath) throw new Error("Invalid EPUB: missing OPF path");

  // 解析 OPF
  const opfFile = zip.file(opfPath);
  if (!opfFile) throw new Error("Invalid EPUB: missing OPF file");
  const opfXml = await opfFile.async("string");
  const opfDir = path.posix.dirname(opfPath);

  // 元数据
  const title = extractText(opfXml, "dc:title") || extractText(opfXml, "title") || path.basename(filePath, ".epub");
  const author = extractText(opfXml, "dc:creator") || extractText(opfXml, "creator") || "";

  // manifest: id → href
  const manifest = new Map<string, string>();
  for (const item of extractTags(opfXml, "item")) {
    const id = item.attrs["id"];
    const href = item.attrs["href"];
    if (id && href) manifest.set(id, href);
  }

  // spine: 有序章节列表
  const spine: EpubSpineItem[] = [];
  for (const itemref of extractTags(opfXml, "itemref")) {
    const idref = itemref.attrs["idref"];
    if (!idref) continue;
    const href = manifest.get(idref);
    if (href) {
      spine.push({ id: idref, href: path.posix.join(opfDir, href) });
    }
  }

  // TOC: 优先从 NCX (EPUB2) 解析，回退从 nav (EPUB3) 解析
  const toc: EpubTocItem[] = [];
  const ncxId = extractAttr(opfXml, "spine", "toc");
  if (ncxId) {
    const ncxHref = manifest.get(ncxId);
    if (ncxHref) {
      const ncxFile = zip.file(path.posix.join(opfDir, ncxHref));
      if (ncxFile) {
        const ncxXml = await ncxFile.async("string");
        // 递归解析 navPoint
        const parseNavPoints = (xml: string, parentTag: string, level: number) => {
          const navPointRe = /<navPoint\b([^>]*?)>([\s\S]*?)<\/navPoint>/gi;
          let m: RegExpExecArray | null;
          // 需要只匹配直接子 navPoint，但正则无法精确做到。
          // 改用：先提取所有 navPoint，根据 level 属性计算层级
          const allNavPoints: { label: string; src: string; id: string }[] = [];
          while ((m = navPointRe.exec(xml)) !== null) {
            const attrs = parseAttrs(m[1]);
            const body = m[2];
            const labelMatch = /<navLabel[^>]*>([\s\S]*?)<\/navLabel>/i.exec(body);
            const label = labelMatch ? labelMatch[1].replace(/<[^>]*>/g, "").trim() : "";
            const contentMatch = /<content\b([^>]*?)\/?>/i.exec(body);
            const src = contentMatch ? (parseAttrs(contentMatch[1]).src || "") : "";
            const id = attrs.id || `${allNavPoints.length}`;
            if (label) allNavPoints.push({ label, src, id });
          }
          // 按 playOrder 排序，层级通过 depth 属性或嵌套推断
          // 简化处理：所有 NCX navPoint 视为 level 0，子项通过 playOrder 顺序排列
          allNavPoints.forEach((np) => {
            toc.push({ id: np.id, text: np.label, level: 0, src: np.src ? path.posix.join(opfDir, np.src) : undefined });
          });
          void parentTag;
        };
        parseNavPoints(ncxXml, "navMap", 0);
      }
    }
  }

  // 回退：EPUB3 nav 元素
  if (toc.length === 0) {
    // 查找 nav 类型的 manifest item
    for (const [id, href] of manifest) {
      const itemFile = zip.file(path.posix.join(opfDir, href));
      if (!itemFile) continue;
      const itemXml = await itemFile.async("string");
      // 检查是否有 nav epub:type="toc"
      if (!/epub:type\s*=\s*["']?toc/i.test(itemXml) && !/class\s*=\s*["']?[^"']*toc/i.test(itemXml)) continue;
      // 解析 <li><a> 结构
      const liRe = /<li\b[^>]*>([\s\S]*?)<\/li>/gi;
      let liMatch: RegExpExecArray | null;
      while ((liMatch = liRe.exec(itemXml)) !== null) {
        const liBody = liMatch[1];
        const aMatch = /<a\b([^>]*?)>([\s\S]*?)<\/a>/i.exec(liBody);
        if (aMatch) {
          const label = aMatch[2].replace(/<[^>]*>/g, "").trim();
          const src = parseAttrs(aMatch[1]).href || "";
          if (label) toc.push({ id: `${toc.length}`, text: label, level: 0, src: src ? path.posix.join(opfDir, src) : undefined });
        }
      }
      if (toc.length > 0) break;
      void id;
    }
  }

  // 最终回退：用 spine 标题作为 TOC
  if (toc.length === 0) {
    spine.forEach((item, index) => {
      toc.push({ id: `spine-${index}`, text: `${index + 1}`, level: 0, src: item.href });
    });
  }

  const existingIndex = recentPaths.findIndex((item) => item.toLowerCase() === filePath.toLowerCase());
  if (existingIndex >= 0) recentPaths.splice(existingIndex, 1);
  recentPaths.unshift(filePath);
  recentPaths.splice(10);
  app.addRecentDocument(filePath);
  createMenu();

  epubMetaCache.set(filePath, { spine, toc });

  return { filePath, name: path.basename(filePath), directory: path.dirname(filePath), title, author, toc, spine, size: stat.size };
}

type OpenedPdf = {
  filePath: string;
  name: string;
  directory: string;
  title: string;
  size: number;
};

async function readPdfFile(filePath: string): Promise<OpenedPdf> {
  const stat = await fs.promises.stat(filePath);
  if (!stat.isFile()) throw new Error("Path is not a file.");
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
    title: path.basename(filePath, path.extname(filePath)),
    size: stat.size
  };
}

async function readEpubSpineItem(filePath: string, spineIndex: number): Promise<string> {
  const zip = epubCache.get(filePath);
  const meta = epubMetaCache.get(filePath);
  if (!zip || !meta) throw new Error("EPUB not loaded. Call readEpub first.");
  if (spineIndex < 0 || spineIndex >= meta.spine.length) throw new Error("Spine index out of range.");
  const href = meta.spine[spineIndex].href;
  // 处理 href 中的锚点（如 chapter.xhtml#section1）
  const basePath = href.split("#")[0];
  const file = zip.file(basePath);
  if (!file) throw new Error(`EPUB content not found: ${basePath}`);
  let html = await file.async("string");

  // 章节文件所在目录（用于解析相对路径的图片/CSS资源）
  const chapterDir = path.posix.dirname(basePath);

  // 1. 将 <link rel="stylesheet" href="..."> 内联为 <style>（匹配 href/rel 任意顺序）
  const linkRe = /<link\b([^>]*?)\/?>/gi;
  const cssPromises: { matchStr: string; cssText: string }[] = [];
  let linkMatch: RegExpExecArray | null;
  while ((linkMatch = linkRe.exec(html)) !== null) {
    const attrs = parseAttrs(linkMatch[1]);
    if (attrs.rel !== "stylesheet" || !attrs.href) continue;
    const cssHref = attrs.href;
    if (/^(https?:|data:)/i.test(cssHref)) continue;
    try {
      const cssPath = path.posix.normalize(path.posix.join(chapterDir, cssHref));
      const cssFile = zip.file(cssPath);
      if (cssFile) {
        let cssText = await cssFile.async("string");
        // 内联 CSS 中的 url() 引用（如背景图、字体）
        cssText = await inlineCssUrlResources(zip, cssText, path.posix.dirname(cssPath));
        // 移除 page-break 属性（屏幕阅读不需要分页）
        cssText = cssText.replace(/page-break-(before|after|inside)\s*:\s*\w+/gi, "page-break-$1: avoid");
        // 移除强制背景色（让主题色生效）
        cssText = cssText.replace(/background-color\s*:\s*white\s*!/gi, "background-color: transparent !");
        cssText = cssText.replace(/background-color\s*:\s*#fff\b/gi, "background-color: transparent");
        cssPromises.push({ matchStr: linkMatch[0], cssText });
      }
    } catch { /* ignore */ }
  }
  for (const { matchStr, cssText } of cssPromises) {
    html = html.replace(matchStr, `<style>\n${cssText}\n</style>`);
  }

  // 2. 将 <style> 标签内的 url() 引用也内联
  const styleTagRe = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
  const stylePromises: { matchStr: string; cssText: string }[] = [];
  let styleMatch: RegExpExecArray | null;
  while ((styleMatch = styleTagRe.exec(html)) !== null) {
    let originalCss = styleMatch[1];
    originalCss = await inlineCssUrlResources(zip, originalCss, chapterDir);
    // 同样处理 page-break 和 background-color
    originalCss = originalCss.replace(/page-break-(before|after|inside)\s*:\s*\w+/gi, "page-break-$1: avoid");
    originalCss = originalCss.replace(/background-color\s*:\s*white\s*!/gi, "background-color: transparent !");
    originalCss = originalCss.replace(/background-color\s*:\s*#fff\b/gi, "background-color: transparent");
    // 移除 body 的强制 color（让主题色生效）
    originalCss = originalCss.replace(/(body[^{]*\{[^}]*?)color\s*:\s*black\s*;?/gi, "$1");
    stylePromises.push({ matchStr: styleMatch[0], cssText: originalCss });
  }
  for (const { matchStr, cssText } of stylePromises) {
    html = html.replace(matchStr, `<style>${cssText}</style>`);
  }

  // 3. 将 <img src="..."> 替换为 data URL
  html = await inlineEpubResources(zip, html, /<img\b([^>]*?)\ssrc=["']([^"']+)["']/gi, chapterDir, 2);
  // 4. 将 <image xlink:href="..." href="..."> 替换为 data URL（SVG 引用）
  html = await inlineEpubResources(zip, html, /<image\b([^>]*?)\s(?:xlink:href|href)=["']([^"']+)["']/gi, chapterDir, 2);
  // 5. 内部 <a href="chapter.xhtml"> 改为 href="#"
  html = html.replace(/<a\b([^>]*?)\shref=["']([^"']+)["']/gi, (match, pre: string, h: string) => {
    if (/^(https?:|mailto:|#)/i.test(h)) return match;
    return `<a${pre} href="#" data-epub-internal="${h}"`;
  });

  // 6. 移除 <script> 标签
  html = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");

  return html;
}

// 将 CSS 中的 url(...) 引用替换为 data URL
async function inlineCssUrlResources(zip: JSZip, css: string, baseDir: string): Promise<string> {
  const urlRe = /url\(\s*['"]?([^'")]+)['"]?\s*\)/gi;
  const matches: { matchStr: string; resourcePath: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = urlRe.exec(css)) !== null) {
    const url = m[1];
    if (/^(https?:|data:|#)/i.test(url)) continue;
    matches.push({ matchStr: m[0], resourcePath: url });
  }

  let result = css;
  for (const { matchStr, resourcePath } of matches) {
    try {
      const fullPath = path.posix.normalize(path.posix.join(baseDir, resourcePath.split("#")[0]));
      const resFile = zip.file(fullPath);
      if (resFile) {
        const ext = path.posix.extname(fullPath).toLowerCase();
        const mimeMap: Record<string, string> = {
          ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
          ".gif": "image/gif", ".svg": "image/svg+xml", ".webp": "image/webp",
          ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf", ".otf": "font/otf",
        };
        const mime = mimeMap[ext] || "application/octet-stream";
        if (ext === ".svg") {
          const svgText = await resFile.async("string");
          result = result.replace(matchStr, `url("data:${mime};utf8,${encodeURIComponent(svgText)}")`);
        } else {
          const buffer = await resFile.async("base64");
          result = result.replace(matchStr, `url("data:${mime};base64,${buffer}")`);
        }
      }
    } catch { /* ignore */ }
  }
  return result;
}

// 将 HTML 中匹配的资源路径替换为 ZIP 内的 data URL
async function inlineEpubResources(
  zip: JSZip,
  html: string,
  re: RegExp,
  baseDir: string,
  hrefGroupIndex: number,
): Promise<string> {
  const promises: { match: string; replacement: string }[] = [];
  const matches: { matchStr: string; href: string; fullMatch: string }[] = [];
  let m: RegExpExecArray | null;
  const reCopy = new RegExp(re.source, re.flags);
  while ((m = reCopy.exec(html)) !== null) {
    const href = m[hrefGroupIndex];
    if (/^(https?:|data:|#)/i.test(href)) continue; // 外部链接/data URL/锚点跳过
    matches.push({ matchStr: m[0], href, fullMatch: m[0] });
  }

  for (const { matchStr, href } of matches) {
    try {
      // 解析相对路径：去掉锚点，拼接 baseDir
      const resourcePath = path.posix.normalize(path.posix.join(baseDir, href.split("#")[0]));
      const resourceFile = zip.file(resourcePath);
      if (resourceFile) {
        const ext = path.posix.extname(resourcePath).toLowerCase();
        const mimeMap: Record<string, string> = {
          ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
          ".gif": "image/gif", ".svg": "image/svg+xml", ".webp": "image/webp",
          ".bmp": "image/bmp", ".css": "text/css",
        };
        const mime = mimeMap[ext] || "application/octet-stream";
        if (ext === ".svg") {
          // SVG 可以直接内联为文本
          const svgText = await resourceFile.async("string");
          promises.push({ match: matchStr, replacement: matchStr.replace(href, `data:${mime};utf8,${encodeURIComponent(svgText)}`) });
        } else {
          const buffer = await resourceFile.async("base64");
          promises.push({ match: matchStr, replacement: matchStr.replace(href, `data:${mime};base64,${buffer}`) });
        }
      }
    } catch {
      // 资源提取失败，保持原样
    }
  }

  let result = html;
  for (const { match, replacement } of promises) {
    result = result.replace(match, replacement);
  }
  return result;
}

async function listDirectory(dirPath: string) {
  const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
  const children = entries
    .filter((entry) => !entry.name.startsWith("."))
    .filter((entry) => entry.isDirectory() || isMarkdownLike(entry.name) || isEpubFile(entry.name))
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
    // getUniqueChildPath 与 writeFile 之间存在 TOCTOU 竞态：并发创建时可能两个调用
    // 得到相同路径。使用 flag:"wx" 保证原子性，并在 EEXIST 时重试获取新路径（#14）
    let filePath = await getUniqueChildPath(parentPath, baseName, ".md");
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        await fs.promises.writeFile(filePath, "", { encoding: "utf8", flag: "wx" });
        return { ok: true, path: filePath, parentPath, type: "file" };
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
        filePath = await getUniqueChildPath(parentPath, baseName, ".md");
      }
    }
    throw new Error("Unable to create a unique file.");
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
    // 额外拒绝包含路径分隔符的名称，防止 path.join 将其规范化为子路径，
    // 绕过“同目录重命名”的约束创建子目录文件（#10）
    if (cleanName.includes("/") || cleanName.includes("\\")) {
      return { ok: false, reason: "invalid-name" };
    }

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
        // 记录本次 timer 句柄，回调执行时再次校验未被 stopWatchingFile 清除（#12）
        const handle = setTimeout(async () => {
          const entry = fileWatchers.get(sender.id);
          // 若监听已被切换/关闭，或 timer 已被替换，跳过本次通知
          if (!entry || entry.filePath !== filePath || entry.timer !== handle) return;
          try {
            const stat = await fs.promises.stat(filePath);
            if (!sender.isDestroyed()) sender.send("file:changed", { filePath, mtimeMs: stat.mtimeMs });
          } catch {
            // Ignore deleted or inaccessible files until the user reopens them.
          } finally {
            if (fileWatchers.get(sender.id)?.timer === handle) {
              fileWatchers.get(sender.id)!.timer = null;
            }
          }
        }, 350);
        current.timer = handle;
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
      filters: [
        { name: t.allSupportedFilter, extensions: ["md", "markdown", "txt", "epub", "pdf"] },
        { name: t.markdownFilter, extensions: ["md", "markdown", "txt"] },
        { name: "EPUB", extensions: ["epub"] },
        { name: "PDF", extensions: ["pdf"] }
      ]
    });
    if (result.canceled || !result.filePaths[0]) return null;
    const selectedPath = result.filePaths[0];
    if (isEpubFile(selectedPath)) {
      return readEpubFile(selectedPath);
    }
    if (isPdfFile(selectedPath)) {
      return readPdfFile(selectedPath);
    }
    return readTextFile(selectedPath);
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

  ipcMain.handle("file:read", async (_event, filePath: string) => {
    if (isEpubFile(filePath)) return readEpubFile(filePath);
    if (isPdfFile(filePath)) return readPdfFile(filePath);
    return readTextFile(filePath);
  });

  ipcMain.handle("pdf:read", async (_event, filePath: string) => {
    const buf = await fs.promises.readFile(filePath);
    return new Uint8Array(buf);
  });

  ipcMain.handle("epub:read-spine", async (_event, filePath: string, spineIndex: number) =>
    readEpubSpineItem(filePath, spineIndex)
  );

  ipcMain.handle("file:save", async (_event, payload: SavePayload) => {
    const { filePath, content, expectedMtimeMs, force } = payload;
    const currentStat = await fs.promises.stat(filePath).catch(() => null);
    // 同一文件系统返回的时间戳精度一致，只保留浮点舍入余量。更大的容差会让
    // 保存前一秒内发生的真实外部修改被静默覆盖。
    if (!force && currentStat && expectedMtimeMs !== undefined && Math.abs(currentStat.mtimeMs - expectedMtimeMs) > 2) {
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
  // 主题应用：更新 nativeTheme + 标题栏 overlay 颜色 + 窗口背景色，
  // 使 newsprint（米色）/pixyll（暖白）等浅色主题的标题栏精确匹配
  ipcMain.handle("theme:apply", async (event, themeMode: string) => {
    const themeColors: Record<string, { bg: string; symbol: string }> = {
      github: { bg: "#ffffff", symbol: "#333333" },
      newsprint: { bg: "#f4f0e8", symbol: "#2e2a25" },
      night: { bg: "#1f1f1f", symbol: "#eeeeee" },
      pixyll: { bg: "#fffdf9", symbol: "#4a4037" },
      whitey: { bg: "#ffffff", symbol: "#222222" }
    };
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return;
    if (themeMode === "system") {
      nativeTheme.themeSource = "system";
      const resolved = getSystemTheme();
      const colors = resolved === "night" ? themeColors.night : themeColors.github;
      win.setTitleBarOverlay({ color: colors.bg, symbolColor: colors.symbol });
      win.setBackgroundColor(colors.bg);
      return;
    }
    nativeTheme.themeSource = themeMode === "night" ? "dark" : "light";
    const colors = themeColors[themeMode] ?? themeColors.github;
    win.setTitleBarOverlay({ color: colors.bg, symbolColor: colors.symbol });
    win.setBackgroundColor(colors.bg);
  });
  ipcMain.handle("locale:get-system", async () => app.getLocale());
  ipcMain.handle("app:open-project-repository", async () => {
    await shell.openExternal(projectRepositoryUrl);
    return { ok: true };
  });
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
  ipcMain.handle("window:toggle-devtools", async (event) => {
    if (event.sender.isDevToolsOpened()) event.sender.closeDevTools();
    else event.sender.openDevTools({ mode: "detach" });
    return { ok: true };
  });
  // 剪贴板读取：sandbox 下 document.execCommand("paste") 不可靠，
  // 改由主进程读 clipboard，渲染进程再用 insertText 插入
  ipcMain.handle("clipboard:read-text", async () => clipboard.readText());
  ipcMain.handle("app:get-recent-files", async () => recentPaths.slice());
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
    if (!isOpenableFile(filePath)) return;
    pendingOpenPath = filePath;
    if (mainWindow) sendOpenPath(filePath);
  });

  app.on("window-all-closed", () => {
    [...fileWatchers.keys()].forEach(stopWatchingFile);
    if (process.platform !== "darwin") app.quit();
  });
}
