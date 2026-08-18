import type { AppLanguage, LanguageMode, SaveStatus } from "../types";

const zhCN = {
  appName: "MarkLens",
  common: {
    close: "关闭",
    openFile: "打开文件",
    openFolder: "打开文件夹",
    exportHtml: "导出 HTML",
    preferences: "偏好设置"
  },
  status: {
    noFile: "未打开文件",
    showOutline: "显示大纲",
    hideOutline: "隐藏侧栏",
    sourceMode: "源码模式",
    returnPreview: "返回预览",
    words: (count: number) => `${count.toLocaleString("zh-CN")} 字/词`,
    save: {
      clean: "",
      unsaved: "未保存",
      saving: "保存中...",
      saved: "已保存",
      failed: "保存失败",
      conflict: "文件冲突"
    } satisfies Record<SaveStatus, string>
  },
  preview: {
    advancedNotice: "此文档包含属性、公式、图表、脚注、目录或 HTML，当前显示完整预览。",
    editSource: "使用源码模式编辑",
    documentProperties: "文档属性"
  },
  theme: {
    system: "跟随系统",
    github: "Github",
    newsprint: "Newsprint",
    night: "Night",
    pixyll: "Pixyll",
    whitey: "Whitey"
  },
  language: {
    label: "界面语言",
    system: "跟随系统",
    chinese: "简体中文",
    traditional: "繁體中文",
    english: "English"
  },
  drawer: {
    aria: "侧栏",
    outline: "大纲",
    files: "文件",
    search: "搜索",
    closeSidebar: "关闭侧栏",
    searchDocument: "搜索当前文档",
    line: (line: number) => `第 ${line} 行`,
    noMatches: "无匹配结果。",
    noFile: "未打开文件"
  },
  outline: {
    aria: "文档大纲",
    empty: "当前文档没有标题。",
    line: (line: number) => `第 ${line} 行`
  },
  files: {
    noFolder: "未打开文件夹。",
    openFolder: "打开文件夹",
    filter: "筛选文件",
    showInFolder: "打开文件位置",
    newMarkdown: "新建 MD 文件",
    newFolder: "新建文件夹",
    rename: "重命名",
    renamePlaceholder: "输入新名称",
    operationFailed: "文件操作失败"
  },
  preferences: {
    title: "偏好设置",
    close: "关闭偏好设置",
    nav: {
      appearance: "外观",
      language: "界面语言",
      files: "文件",
      performance: "性能"
    },
    groups: {
      appearance: "外观",
      files: "文件",
      performance: "性能"
    },
    fontSize: "字体大小",
    autoRefresh: "外部文件变化时自动刷新",
    autoSave: "自动保存源码编辑",
    spellCheck: "编辑时进行拼写检查",
    autoSaveDelay: "自动保存延迟",
    smoothScroll: "平滑滚动",
    preloadOutline: "打开文件后预生成大纲",
    delay500: "500 毫秒",
    delay1000: "1 秒",
    delay3000: "3 秒"
  },
  findReplace: {
    aria: "查找和替换",
    find: "查找",
    replaceWith: "替换为",
    matchCount: (count: number) => `${count} 处`,
    previous: "上一个",
    next: "下一个",
    replace: "替换",
    replaceAll: "全部"
  },
  wordCount: {
    aria: "字数统计",
    title: "字数统计",
    words: "字/词",
    charactersWithSpaces: "字符（含空格）",
    charactersNoSpaces: "字符（不含空格）",
    paragraphs: "段落",
    lines: "行"
  },
  about: {
    aria: "关于 MarkLens",
    eyebrow: "MARKLENS",
    title: "关于 MarkLens",
    description: "一款为 Markdown 写作、阅读与整理打造的桌面编辑器。让内容结构更清晰，文档维护更从容。",
    repository: "开源项目地址",
    scan: "扫描二维码，访问 GitHub 项目主页",
    qrAlt: "MarkLens GitHub 项目二维码"
  }
};

const enUS = {
  appName: "MarkLens",
  common: {
    close: "Close",
    openFile: "Open File",
    openFolder: "Open Folder",
    exportHtml: "Export HTML",
    preferences: "Preferences"
  },
  status: {
    noFile: "No file opened",
    showOutline: "Show Outline",
    hideOutline: "Hide Sidebar",
    sourceMode: "Source Mode",
    returnPreview: "Return to Preview",
    words: (count: number) => `${count.toLocaleString("en-US")} words`,
    save: {
      clean: "",
      unsaved: "Unsaved",
      saving: "Saving...",
      saved: "Saved",
      failed: "Save failed",
      conflict: "Conflict"
    } satisfies Record<SaveStatus, string>
  },
  preview: {
    advancedNotice: "This document uses properties, math, diagrams, footnotes, a TOC, or HTML. Showing the complete preview.",
    editSource: "Edit in source mode",
    documentProperties: "Document properties"
  },
  theme: {
    system: "Follow System",
    github: "Github",
    newsprint: "Newsprint",
    night: "Night",
    pixyll: "Pixyll",
    whitey: "Whitey"
  },
  language: {
    label: "Interface Language",
    system: "Follow System",
    chinese: "Simplified Chinese",
    traditional: "Traditional Chinese",
    english: "English"
  },
  drawer: {
    aria: "Sidebar",
    outline: "Outline",
    files: "Files",
    search: "Search",
    closeSidebar: "Close sidebar",
    searchDocument: "Search document",
    line: (line: number) => `Line ${line}`,
    noMatches: "No matches.",
    noFile: "No file"
  },
  outline: {
    aria: "Document outline",
    empty: "No headings in this document.",
    line: (line: number) => `Line ${line}`
  },
  files: {
    noFolder: "No folder opened.",
    openFolder: "Open Folder",
    filter: "Filter files",
    showInFolder: "Show in File Explorer",
    newMarkdown: "New MD File",
    newFolder: "New Folder",
    rename: "Rename",
    renamePlaceholder: "Enter a new name",
    operationFailed: "File operation failed"
  },
  preferences: {
    title: "Preferences",
    close: "Close preferences",
    nav: {
      appearance: "Appearance",
      language: "Interface Language",
      files: "Files",
      performance: "Performance"
    },
    groups: {
      appearance: "Appearance",
      files: "Files",
      performance: "Performance"
    },
    fontSize: "Font size",
    autoRefresh: "Auto refresh when the file changes outside this app",
    autoSave: "Auto save source edits",
    spellCheck: "Check spelling while editing",
    autoSaveDelay: "Auto save delay",
    smoothScroll: "Smooth scrolling",
    preloadOutline: "Preload outline after opening files",
    delay500: "500 ms",
    delay1000: "1 second",
    delay3000: "3 seconds"
  },
  findReplace: {
    aria: "Find and replace",
    find: "Find",
    replaceWith: "Replace with",
    matchCount: (count: number) => `${count} matches`,
    previous: "Previous",
    next: "Next",
    replace: "Replace",
    replaceAll: "All"
  },
  wordCount: {
    aria: "Word count",
    title: "Word Count",
    words: "Words",
    charactersWithSpaces: "Characters (with spaces)",
    charactersNoSpaces: "Characters (no spaces)",
    paragraphs: "Paragraphs",
    lines: "Lines"
  },
  about: {
    aria: "About MarkLens",
    eyebrow: "MARKLENS",
    title: "About MarkLens",
    description: "A desktop editor for writing, reading, and organizing Markdown—built to keep documents clear and easy to maintain.",
    repository: "Open-source repository",
    scan: "Scan to visit the GitHub project page",
    qrAlt: "QR code for the MarkLens GitHub project"
  }
};

const zhTW = {
  appName: "MarkLens",
  common: {
    close: "關閉",
    openFile: "開啟檔案",
    openFolder: "開啟資料夾",
    exportHtml: "匯出 HTML",
    preferences: "偏好設定"
  },
  status: {
    noFile: "未開啟檔案",
    showOutline: "顯示大綱",
    hideOutline: "隱藏側欄",
    sourceMode: "原始碼模式",
    returnPreview: "返回預覽",
    words: (count: number) => `${count.toLocaleString("zh-TW")} 字/詞`,
    save: {
      clean: "",
      unsaved: "未儲存",
      saving: "儲存中...",
      saved: "已儲存",
      failed: "儲存失敗",
      conflict: "檔案衝突"
    } satisfies Record<SaveStatus, string>
  },
  preview: {
    advancedNotice: "此文件包含屬性、公式、圖表、註腳、目錄或 HTML，目前顯示完整預覽。",
    editSource: "使用原始碼模式編輯",
    documentProperties: "文件屬性"
  },
  theme: {
    system: "跟隨系統",
    github: "Github",
    newsprint: "Newsprint",
    night: "Night",
    pixyll: "Pixyll",
    whitey: "Whitey"
  },
  language: {
    label: "介面語言",
    system: "跟隨系統",
    chinese: "簡體中文",
    traditional: "繁體中文",
    english: "English"
  },
  drawer: {
    aria: "側欄",
    outline: "大綱",
    files: "檔案",
    search: "搜尋",
    closeSidebar: "關閉側欄",
    searchDocument: "搜尋目前文件",
    line: (line: number) => `第 ${line} 行`,
    noMatches: "無相符結果。",
    noFile: "未開啟檔案"
  },
  outline: {
    aria: "文件大綱",
    empty: "目前文件沒有標題。",
    line: (line: number) => `第 ${line} 行`
  },
  files: {
    noFolder: "未開啟資料夾。",
    openFolder: "開啟資料夾",
    filter: "篩選檔案",
    showInFolder: "開啟檔案位置",
    newMarkdown: "新增 MD 檔案",
    newFolder: "新增資料夾",
    rename: "重新命名",
    renamePlaceholder: "輸入新名稱",
    operationFailed: "檔案操作失敗"
  },
  preferences: {
    title: "偏好設定",
    close: "關閉偏好設定",
    nav: {
      appearance: "外觀",
      language: "介面語言",
      files: "檔案",
      performance: "效能"
    },
    groups: {
      appearance: "外觀",
      files: "檔案",
      performance: "效能"
    },
    fontSize: "字型大小",
    autoRefresh: "外部檔案變更時自動重新整理",
    autoSave: "自動儲存原始碼編輯",
    spellCheck: "編輯時進行拼字檢查",
    autoSaveDelay: "自動儲存延遲",
    smoothScroll: "平滑捲動",
    preloadOutline: "開啟檔案後預先產生大綱",
    delay500: "500 毫秒",
    delay1000: "1 秒",
    delay3000: "3 秒"
  },
  findReplace: {
    aria: "尋找和取代",
    find: "尋找",
    replaceWith: "取代為",
    matchCount: (count: number) => `${count} 處`,
    previous: "上一個",
    next: "下一個",
    replace: "取代",
    replaceAll: "全部"
  },
  wordCount: {
    aria: "字數統計",
    title: "字數統計",
    words: "字/詞",
    charactersWithSpaces: "字元（含空格）",
    charactersNoSpaces: "字元（不含空格）",
    paragraphs: "段落",
    lines: "行"
  },
  about: {
    aria: "關於 MarkLens",
    eyebrow: "MARKLENS",
    title: "關於 MarkLens",
    description: "一款為 Markdown 寫作、閱讀與整理打造的桌面編輯器。讓內容結構更清晰，文件維護更從容。",
    repository: "開源專案位址",
    scan: "掃描 QR Code，前往 GitHub 專案頁面",
    qrAlt: "MarkLens GitHub 專案 QR Code"
  }
};

export const i18n = {
  "zh-CN": zhCN,
  "zh-TW": zhTW,
  "en-US": enUS
};

export type AppStrings = typeof enUS;

export function resolveLanguage(mode: LanguageMode, systemLanguage: string): AppLanguage {
  if (mode !== "system") return mode;
  const lang = systemLanguage.toLowerCase().replace("_", "-");
  if (lang.startsWith("zh-hant") || lang.startsWith("zh-tw")) return "zh-TW";
  if (lang.startsWith("zh")) return "zh-CN";
  return "en-US";
}
