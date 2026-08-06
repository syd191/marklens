import { memo, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { AppLanguage, ThemeMode } from "../types";

// 菜单项定义：command 走 onCommand 分发；action 由组件内部处理（剪贴板/缩放）
type MenuLeaf = {
  label: string;
  command?: string;
  accelerator?: string;
  action?: "cut" | "copy" | "paste" | "select-all" | "zoom-in" | "zoom-out" | "zoom-reset";
  checked?: boolean;
  disabled?: boolean;
  submenu?: MenuLeaf[];
  openPath?: string;
};
type MenuSeparator = { separator: true };
type MenuNode = MenuLeaf | MenuSeparator;
type MenuGroup = { label: string; items: MenuNode[] };

type Labels = {
  file: string;
  edit: string;
  paragraphMenu: string;
  format: string;
  view: string;
  themes: string;
  help: string;
  // File
  new: string;
  newWindow: string;
  openFile: string;
  openFolder: string;
  quickOpen: string;
  openRecent: string;
  noRecent: string;
  save: string;
  saveAs: string;
  moveTo: string;
  saveAll: string;
  properties: string;
  showInFolder: string;
  deleteFile: string;
  import: string;
  export: string;
  exportHtml: string;
  exportPdf: string;
  print: string;
  preferences: string;
  close: string;
  // Edit
  undo: string;
  redo: string;
  cut: string;
  copy: string;
  paste: string;
  copyPlain: string;
  copyMarkdown: string;
  copyHtml: string;
  pastePlain: string;
  select: string;
  selectAll: string;
  selectLine: string;
  moveLineUp: string;
  moveLineDown: string;
  delete: string;
  deleteRange: string;
  deleteLine: string;
  deleteSelection: string;
  mathTools: string;
  smartPunctuation: string;
  lineEndings: string;
  spacesBreaks: string;
  spellCheck: string;
  findReplace: string;
  emoji: string;
  // Paragraph
  headingMenu: string;
  heading: (n: number) => string;
  paragraph: string;
  promote: string;
  demote: string;
  table: string;
  mathBlock: string;
  codeBlock: string;
  callout: string;
  quote: string;
  orderedList: string;
  unorderedList: string;
  taskList: string;
  indent: string;
  outdent: string;
  insertAbove: string;
  insertBelow: string;
  linkReference: string;
  footnote: string;
  horizontalRule: string;
  toc: string;
  frontMatter: string;
  // Format
  bold: string;
  italic: string;
  underline: string;
  code: string;
  strikethrough: string;
  comment: string;
  hyperlink: string;
  image: string;
  clearFormat: string;
  // View
  toggleSidebar: string;
  outline: string;
  documentList: string;
  fileTree: string;
  search: string;
  sourceMode: string;
  focusMode: string;
  typewriterMode: string;
  showStatusBar: string;
  wordCount: string;
  toggleFullscreen: string;
  alwaysOnTop: string;
  actualSize: string;
  zoomIn: string;
  zoomOut: string;
  switchWindow: string;
  devTools: string;
  reload: string;
  // Themes
  followSystem: string;
};

const zhLabels: Labels = {
  file: "文件",
  edit: "编辑",
  paragraphMenu: "段落",
  format: "格式",
  view: "视图",
  themes: "主题",
  help: "帮助",
  new: "新建",
  newWindow: "新建窗口",
  openFile: "打开文件...",
  openFolder: "打开文件夹...",
  quickOpen: "快速打开...",
  openRecent: "打开最近文件",
  noRecent: "没有最近文件",
  save: "保存",
  saveAs: "另存为...",
  moveTo: "移动到...",
  saveAll: "保存全部打开的文件",
  properties: "属性...",
  showInFolder: "打开文件位置...",
  deleteFile: "删除...",
  import: "导入...",
  export: "导出",
  exportHtml: "HTML...",
  exportPdf: "PDF...",
  print: "打印...",
  preferences: "偏好设置...",
  close: "关闭",
  undo: "撤销",
  redo: "重做",
  cut: "剪切",
  copy: "复制",
  paste: "粘贴",
  copyPlain: "复制为纯文本",
  copyMarkdown: "复制为 Markdown",
  copyHtml: "复制为 HTML 代码",
  pastePlain: "粘贴为纯文本",
  select: "选择",
  selectAll: "全选",
  selectLine: "选择当前行",
  moveLineUp: "上移该行",
  moveLineDown: "下移该行",
  delete: "删除",
  deleteRange: "删除范围",
  deleteLine: "删除当前行",
  deleteSelection: "删除选中内容",
  mathTools: "数学工具",
  smartPunctuation: "智能标点",
  lineEndings: "换行符",
  spacesBreaks: "空格与换行",
  spellCheck: "拼写检查...",
  findReplace: "查找和替换",
  emoji: "表情与符号",
  headingMenu: "标题",
  heading: (n: number) => `H${n} 级标题`,
  paragraph: "段落",
  promote: "提升标题级别",
  demote: "降低标题级别",
  table: "表格",
  mathBlock: "公式块",
  codeBlock: "代码块",
  callout: "警告框",
  quote: "引用",
  orderedList: "有序列表",
  unorderedList: "无序列表",
  taskList: "任务列表",
  indent: "增加列表缩进",
  outdent: "减少列表缩进",
  insertAbove: "在上方插入段落",
  insertBelow: "在下方插入段落",
  linkReference: "链接引用",
  footnote: "脚注",
  horizontalRule: "水平分割线",
  toc: "内容目录",
  frontMatter: "YAML Front Matter",
  bold: "加粗",
  italic: "斜体",
  underline: "下划线",
  code: "代码",
  strikethrough: "删除线",
  comment: "注释",
  hyperlink: "超链接",
  image: "图像",
  clearFormat: "清除格式",
  toggleSidebar: "显示/隐藏侧栏",
  outline: "大纲",
  documentList: "文档列表",
  fileTree: "文件树",
  search: "搜索",
  sourceMode: "源码模式",
  focusMode: "专注模式",
  typewriterMode: "打字机模式",
  showStatusBar: "显示状态栏",
  wordCount: "字数统计",
  toggleFullscreen: "切换全屏",
  alwaysOnTop: "保持窗口在最前端",
  actualSize: "实际大小",
  zoomIn: "放大",
  zoomOut: "缩小",
  switchWindow: "应用内窗口切换",
  devTools: "开发者工具",
  reload: "重新载入",
  followSystem: "跟随系统"
};

const zhTWLabels: Labels = {
  file: "檔案",
  edit: "編輯",
  paragraphMenu: "段落",
  format: "格式",
  view: "檢視",
  themes: "主題",
  help: "說明",
  new: "新增",
  newWindow: "新增視窗",
  openFile: "開啟檔案...",
  openFolder: "開啟資料夾...",
  quickOpen: "快速開啟...",
  openRecent: "開啟最近檔案",
  noRecent: "沒有最近檔案",
  save: "儲存",
  saveAs: "另存新檔...",
  moveTo: "移動到...",
  saveAll: "儲存所有開啟的檔案",
  properties: "內容...",
  showInFolder: "開啟檔案位置...",
  deleteFile: "刪除...",
  import: "匯入...",
  export: "匯出",
  exportHtml: "HTML...",
  exportPdf: "PDF...",
  print: "列印...",
  preferences: "偏好設定...",
  close: "關閉",
  undo: "復原",
  redo: "重做",
  cut: "剪下",
  copy: "複製",
  paste: "貼上",
  copyPlain: "複製為純文字",
  copyMarkdown: "複製為 Markdown",
  copyHtml: "複製為 HTML 程式碼",
  pastePlain: "貼上為純文字",
  select: "選取",
  selectAll: "全選",
  selectLine: "選取目前行",
  moveLineUp: "上移該行",
  moveLineDown: "下移該行",
  delete: "刪除",
  deleteRange: "刪除範圍",
  deleteLine: "刪除目前行",
  deleteSelection: "刪除選取內容",
  mathTools: "數學工具",
  smartPunctuation: "智慧標點",
  lineEndings: "換行字元",
  spacesBreaks: "空格與換行",
  spellCheck: "拼字檢查...",
  findReplace: "尋找和取代",
  emoji: "表情與符號",
  headingMenu: "標題",
  heading: (n: number) => `H${n} 級標題`,
  paragraph: "段落",
  promote: "提升標題層級",
  demote: "降低標題層級",
  table: "表格",
  mathBlock: "公式區塊",
  codeBlock: "程式碼區塊",
  callout: "警告框",
  quote: "引用",
  orderedList: "有序清單",
  unorderedList: "無序清單",
  taskList: "工作清單",
  indent: "增加清單縮排",
  outdent: "減少清單縮排",
  insertAbove: "在上方插入段落",
  insertBelow: "在下方插入段落",
  linkReference: "連結參考",
  footnote: "註腳",
  horizontalRule: "水平分隔線",
  toc: "目錄",
  frontMatter: "YAML Front Matter",
  bold: "粗體",
  italic: "斜體",
  underline: "底線",
  code: "程式碼",
  strikethrough: "刪除線",
  comment: "註解",
  hyperlink: "超連結",
  image: "圖像",
  clearFormat: "清除格式",
  toggleSidebar: "顯示/隱藏側欄",
  outline: "大綱",
  documentList: "文件清單",
  fileTree: "檔案樹",
  search: "搜尋",
  sourceMode: "原始碼模式",
  focusMode: "專注模式",
  typewriterMode: "打字機模式",
  showStatusBar: "顯示狀態列",
  wordCount: "字數統計",
  toggleFullscreen: "切換全螢幕",
  alwaysOnTop: "保持視窗在最上層",
  actualSize: "實際大小",
  zoomIn: "放大",
  zoomOut: "縮小",
  switchWindow: "應用程式內視窗切換",
  devTools: "開發者工具",
  reload: "重新載入",
  followSystem: "跟隨系統"
};

const enLabels: Labels = {
  file: "File",
  edit: "Edit",
  paragraphMenu: "Paragraph",
  format: "Format",
  view: "View",
  themes: "Themes",
  help: "Help",
  new: "New",
  newWindow: "New Window",
  openFile: "Open File...",
  openFolder: "Open Folder...",
  quickOpen: "Quick Open...",
  openRecent: "Open Recent",
  noRecent: "No Recent Files",
  save: "Save",
  saveAs: "Save As...",
  moveTo: "Move To...",
  saveAll: "Save All Open Files",
  properties: "Properties...",
  showInFolder: "Show in File Explorer...",
  deleteFile: "Delete...",
  import: "Import...",
  export: "Export",
  exportHtml: "HTML...",
  exportPdf: "PDF...",
  print: "Print...",
  preferences: "Preferences...",
  close: "Close",
  undo: "Undo",
  redo: "Redo",
  cut: "Cut",
  copy: "Copy",
  paste: "Paste",
  copyPlain: "Copy as Plain Text",
  copyMarkdown: "Copy as Markdown",
  copyHtml: "Copy as HTML Code",
  pastePlain: "Paste as Plain Text",
  select: "Select",
  selectAll: "Select All",
  selectLine: "Select Current Line",
  moveLineUp: "Move Line Up",
  moveLineDown: "Move Line Down",
  delete: "Delete",
  deleteRange: "Delete Range",
  deleteLine: "Delete Current Line",
  deleteSelection: "Delete Selection",
  mathTools: "Math Tools",
  smartPunctuation: "Smart Punctuation",
  lineEndings: "Line Endings",
  spacesBreaks: "Spaces and Line Breaks",
  spellCheck: "Spell Check...",
  findReplace: "Find and Replace",
  emoji: "Emoji & Symbols",
  headingMenu: "Headings",
  heading: (n: number) => `H${n} Heading`,
  paragraph: "Paragraph",
  promote: "Promote Heading",
  demote: "Demote Heading",
  table: "Table",
  mathBlock: "Math Block",
  codeBlock: "Code Block",
  callout: "Callout",
  quote: "Quote",
  orderedList: "Ordered List",
  unorderedList: "Unordered List",
  taskList: "Task List",
  indent: "Indent List",
  outdent: "Outdent List",
  insertAbove: "Insert Paragraph Above",
  insertBelow: "Insert Paragraph Below",
  linkReference: "Link Reference",
  footnote: "Footnote",
  horizontalRule: "Horizontal Rule",
  toc: "Table of Contents",
  frontMatter: "YAML Front Matter",
  bold: "Bold",
  italic: "Italic",
  underline: "Underline",
  code: "Code",
  strikethrough: "Strikethrough",
  comment: "Comment",
  hyperlink: "Hyperlink",
  image: "Image",
  clearFormat: "Clear Formatting",
  toggleSidebar: "Toggle Sidebar",
  outline: "Outline",
  documentList: "Document List",
  fileTree: "File Tree",
  search: "Search",
  sourceMode: "Source Mode",
  focusMode: "Focus Mode",
  typewriterMode: "Typewriter Mode",
  showStatusBar: "Show Status Bar",
  wordCount: "Word Count",
  toggleFullscreen: "Toggle Full Screen",
  alwaysOnTop: "Always on Top",
  actualSize: "Actual Size",
  zoomIn: "Zoom In",
  zoomOut: "Zoom Out",
  switchWindow: "Switch Application Window",
  devTools: "Developer Tools",
  reload: "Reload",
  followSystem: "Follow System"
};

function buildMenu(
  l: Labels,
  themeMode: ThemeMode,
  recentFiles: string[],
  modes: { sourceMode: boolean; focusMode: boolean; typewriterMode: boolean; statusBar: boolean }
): MenuGroup[] {
  const sep = (): MenuSeparator => ({ separator: true });
  const item = (label: string, command: string, accelerator?: string): MenuLeaf => ({ label, command, accelerator });
  const action = (label: string, action: MenuLeaf["action"], accelerator?: string): MenuLeaf => ({ label, action, accelerator });
  const check = (label: string, command: string, checked: boolean): MenuLeaf => ({ label, command, checked });
  const recentItem = (filePath: string, idx: number): MenuLeaf => ({
    label: `${idx < 9 ? `${idx + 1} ` : ""}${filePath.split(/[\\/]/).pop()}`,
    openPath: filePath
  });
  return [
    {
      label: l.file,
      items: [
        item(l.new, "new", "Ctrl+N"),
        item(l.newWindow, "new-window", "Ctrl+Shift+N"),
        sep(),
        item(l.openFile, "open-file", "Ctrl+O"),
        item(l.openFolder, "open-folder"),
        item(l.quickOpen, "quick-open", "Ctrl+P"),
        {
          label: l.openRecent,
          disabled: recentFiles.length === 0,
          submenu: recentFiles.length
            ? recentFiles.slice(0, 10).map((p, i) => recentItem(p, i))
            : [{ label: l.noRecent, disabled: true }]
        },
        sep(),
        item(l.save, "save", "Ctrl+S"),
        item(l.saveAs, "save-as", "Ctrl+Shift+S"),
        item(l.moveTo, "move-to"),
        item(l.saveAll, "save-all"),
        sep(),
        item(l.properties, "properties"),
        item(l.showInFolder, "show-in-folder"),
        item(l.deleteFile, "delete-file"),
        sep(),
        item(l.import, "import"),
        item(l.exportHtml, "export-html"),
        item(l.exportPdf, "export-pdf"),
        item(l.print, "print", "Alt+Shift+P"),
        sep(),
        item(l.preferences, "preferences", "Ctrl+,"),
        sep(),
        item(l.close, "close-window", "Ctrl+W")
      ]
    },
    {
      label: l.edit,
      items: [
        item(l.undo, "undo", "Ctrl+Z"),
        item(l.redo, "redo", "Ctrl+Y"),
        sep(),
        action(l.cut, "cut", "Ctrl+X"),
        action(l.copy, "copy", "Ctrl+C"),
        action(l.paste, "paste", "Ctrl+V"),
        sep(),
        item(l.copyPlain, "copy-plain"),
        item(l.copyMarkdown, "copy-markdown", "Ctrl+Shift+C"),
        item(l.copyHtml, "copy-html"),
        sep(),
        item(l.pastePlain, "paste-plain", "Ctrl+Shift+V"),
        sep(),
        action(l.selectAll, "select-all", "Ctrl+A"),
        item(l.selectLine, "select-line"),
        item(l.moveLineUp, "move-line-up", "Alt+Up"),
        item(l.moveLineDown, "move-line-down", "Alt+Down"),
        sep(),
        item(l.delete, "delete"),
        item(l.deleteLine, "delete-line"),
        sep(),
        item(l.mathTools, "math-block"),
        item(l.smartPunctuation, "smart-punctuation"),
        item(l.lineEndings, "normalize-line-endings"),
        item(l.spacesBreaks, "trim-whitespace"),
        item(l.spellCheck, "toggle-spellcheck"),
        sep(),
        item(l.findReplace, "find-replace", "Ctrl+F"),
        item(l.emoji, "emoji")
      ]
    },
    {
      label: l.paragraphMenu,
      items: [
        {
          label: l.headingMenu,
          submenu: [1, 2, 3, 4, 5, 6].map((n) => item(l.heading(n), `heading-${n}`, `Ctrl+${n}`))
        },
        item(l.paragraph, "paragraph", "Ctrl+0"),
        sep(),
        item(l.table, "table"),
        item(l.mathBlock, "math-block", "Ctrl+Shift+M"),
        item(l.codeBlock, "code-block", "Ctrl+Shift+K"),
        item(l.callout, "warning"),
        sep(),
        item(l.quote, "quote", "Ctrl+Shift+Q"),
        sep(),
        item(l.orderedList, "ordered-list", "Ctrl+Shift+["),
        item(l.unorderedList, "unordered-list", "Ctrl+Shift+]"),
        item(l.taskList, "task-list", "Ctrl+Shift+X"),
        item(l.indent, "indent-list", "Tab"),
        item(l.outdent, "outdent-list", "Shift+Tab"),
        sep(),
        item(l.footnote, "footnote"),
        item(l.horizontalRule, "horizontal-rule"),
        item(l.toc, "toc"),
        item(l.frontMatter, "front-matter")
      ]
    },
    {
      label: l.format,
      items: [
        item(l.bold, "bold", "Ctrl+B"),
        item(l.italic, "italic", "Ctrl+I"),
        item(l.underline, "underline", "Ctrl+U"),
        item(l.code, "inline-code", "Ctrl+Shift+`"),
        sep(),
        item(l.strikethrough, "strikethrough", "Alt+Shift+5"),
        item(l.comment, "comment"),
        sep(),
        item(l.hyperlink, "link", "Ctrl+K"),
        item(l.image, "image"),
        sep(),
        item(l.clearFormat, "clear-format", "Ctrl+\\")
      ]
    },
    {
      label: l.view,
      items: [
        item(l.toggleSidebar, "toggle-sidebar", "Ctrl+Shift+L"),
        item(l.outline, "show-outline", "Ctrl+Shift+1"),
        item(l.documentList, "show-files", "Ctrl+Shift+2"),
        item(l.fileTree, "show-files"),
        item(l.search, "show-search", "Ctrl+Shift+F"),
        sep(),
        check(l.sourceMode, "toggle-source", modes.sourceMode),
        sep(),
        check(l.focusMode, "toggle-focus", modes.focusMode),
        check(l.typewriterMode, "toggle-typewriter", modes.typewriterMode),
        sep(),
        check(l.showStatusBar, "toggle-status-bar", modes.statusBar),
        item(l.wordCount, "word-count"),
        sep(),
        item(l.toggleFullscreen, "toggle-fullscreen", "F11"),
        item(l.alwaysOnTop, "toggle-always-on-top"),
        sep(),
        action(l.actualSize, "zoom-reset", "Ctrl+Shift+9"),
        action(l.zoomIn, "zoom-in", "Ctrl+Shift+="),
        action(l.zoomOut, "zoom-out", "Ctrl+Shift+-"),
        sep(),
        item(l.devTools, "toggle-devtools")
      ]
    },
    {
      label: l.themes,
      items: [
        check(l.followSystem, "theme-system", themeMode === "system"),
        check("Github", "theme-github", themeMode === "github"),
        check("Newsprint", "theme-newsprint", themeMode === "newsprint"),
        check("Night", "theme-night", themeMode === "night"),
        check("Pixyll", "theme-pixyll", themeMode === "pixyll"),
        check("Whitey", "theme-whitey", themeMode === "whitey")
      ]
    },
    {
      label: l.help,
      items: [item("About MarkLens", "about")]
    }
  ];
}

// 把 Electron accelerator 转成更短的展示文本
function formatAccel(accel: string): string {
  return accel
    .replace("CommandOrControl", "Ctrl")
    .replace("CmdOrCtrl", "Ctrl")
    .replace("Command", "Cmd");
}

type MenuBarProps = {
  language: AppLanguage;
  themeMode: ThemeMode;
  sourceMode: boolean;
  focusMode: boolean;
  typewriterMode: boolean;
  statusBar: boolean;
  onCommand: (command: string) => void;
  onOpenPath: (filePath: string) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onFocusEditor: () => void;
};

export const MenuBar = memo(function MenuBar({ language, themeMode, sourceMode, focusMode, typewriterMode, statusBar, onCommand, onOpenPath, onZoomIn, onZoomOut, onZoomReset, onFocusEditor }: MenuBarProps) {
  const labels = language === "en-US" ? enLabels : language === "zh-TW" ? zhTWLabels : zhLabels;
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [recentFiles, setRecentFiles] = useState<string[]>([]);
  // 打开 File 下拉时拉取最近文件列表
  useEffect(() => {
    if (openIndex === 0) window.markdownBridge?.getRecentFiles().then(setRecentFiles);
  }, [openIndex]);
  // 仅在语言/主题/模式/最近文件变化时重建菜单树，避免每次渲染都重新构造数百个对象
  const groups = useMemo(
    () => buildMenu(labels, themeMode, recentFiles, { sourceMode, focusMode, typewriterMode, statusBar }),
    [labels, themeMode, recentFiles, sourceMode, focusMode, typewriterMode, statusBar]
  );
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (openIndex === null) return;
    const onDown = (event: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(event.target as Node)) setOpenIndex(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenIndex(null);
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [openIndex]);

  const runLeaf = async (leaf: MenuLeaf) => {
    if (leaf.disabled) return;
    setOpenIndex(null);
    // 先恢复编辑区焦点：菜单按钮持焦会让 caret 消失，且 cut/copy/paste
    // 等 execCommand 需要焦点在编辑区内才能作用于当前 selection
    onFocusEditor();
    if (leaf.openPath) {
      onOpenPath(leaf.openPath);
      return;
    }
    if (leaf.command) {
      onCommand(leaf.command);
      return;
    }
    if (leaf.action) {
      switch (leaf.action) {
        case "cut":
          document.execCommand("cut");
          break;
        case "copy":
          document.execCommand("copy");
          break;
        case "paste": {
          // sandbox 下 execCommand("paste") 不可靠，改由主进程读剪贴板再插入
          const text = await window.markdownBridge?.readClipboardText();
          if (text) document.execCommand("insertText", false, text);
          break;
        }
        case "select-all":
          document.execCommand("selectAll");
          break;
        case "zoom-in":
          onZoomIn();
          break;
        case "zoom-out":
          onZoomOut();
          break;
        case "zoom-reset":
          onZoomReset();
          break;
      }
    }
  };

  // 通过 Portal 渲染到 body，脱离 .app-shell 的 grid/层叠上下文，
  // 确保 -webkit-app-region: drag 不被父容器干扰（Windows 标题栏拖动）
  return createPortal(
    <div className="menu-bar" role="menubar" ref={barRef}>
      {groups.map((group, index) => {
        const isOpen = openIndex === index;
        return (
          <div className={`menu-top${isOpen ? " is-open" : ""}`} key={group.label}>
            <button
              type="button"
              className="menu-top-button"
              role="menuitem"
              aria-expanded={isOpen}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setOpenIndex(isOpen ? null : index)}
              onMouseEnter={() => {
                if (openIndex !== null) setOpenIndex(index);
              }}
            >
              {group.label}
            </button>
            {isOpen && (
              <div className="menu-dropdown" role="menu">
                {group.items.map((node, itemIndex) =>
                  "separator" in node ? (
                    <div className="menu-separator" key={`sep-${itemIndex}`} />
                  ) : node.submenu ? (
                    <div className="menu-item-submenu" key={node.label}>
                      <button
                        type="button"
                        className={`menu-item${node.disabled ? " is-disabled" : ""}`}
                        role="menuitem"
                        disabled={node.disabled}
                        onMouseDown={(e) => e.preventDefault()}
                      >
                        <span className="menu-item-check" />
                        <span className="menu-item-label">{node.label}</span>
                        <span className="menu-item-accel">▸</span>
                      </button>
                      <div className="menu-dropdown menu-dropdown-nested" role="menu">
                        {node.submenu.map((sub) => (
                          <button
                            type="button"
                            className={`menu-item${sub.disabled ? " is-disabled" : ""}`}
                            role="menuitem"
                            disabled={sub.disabled}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => runLeaf(sub)}
                            key={sub.label}
                          >
                            <span className="menu-item-check" />
                            <span className="menu-item-label">{sub.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className={`menu-item${node.checked ? " is-checked" : ""}${node.disabled ? " is-disabled" : ""}`}
                      role="menuitem"
                      disabled={node.disabled}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => runLeaf(node)}
                      key={node.label}
                    >
                      <span className="menu-item-check">{node.checked ? "✓" : ""}</span>
                      <span className="menu-item-label">{node.label}</span>
                      {node.accelerator && <span className="menu-item-accel">{formatAccel(node.accelerator)}</span>}
                    </button>
                  )
                )}
              </div>
            )}
          </div>
        );
      })}
      {/* 可拖动占位条：填满菜单组右侧到系统按钮之间的空白，提供连续大块拖动区域。
          Tauri 通过 data-tauri-drag-region 标记可拖动区域（按钮等交互元素不可标记） */}
      <div className="menu-drag-spacer" data-tauri-drag-region />
    </div>,
    document.body
  );
});
