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
    more: "更多",
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
    more: "More",
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
  }
};

export const i18n = {
  "zh-CN": zhCN,
  "en-US": enUS
};

export type AppStrings = typeof enUS;

export function resolveLanguage(mode: LanguageMode, systemLanguage: string): AppLanguage {
  if (mode !== "system") return mode;
  return systemLanguage.toLowerCase().startsWith("zh") ? "zh-CN" : "en-US";
}
