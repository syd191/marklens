export type ThemeMode = "system" | "light" | "night";
export type ResolvedTheme = "light" | "night";
export type AppLanguage = "zh-CN" | "en-US";
export type LanguageMode = "system" | "zh-CN" | "en-US";
export type SidebarTab = "outline" | "files";
export type SaveStatus = "clean" | "unsaved" | "saving" | "saved" | "failed" | "conflict";

export type Preferences = {
  themeMode: ThemeMode;
  languageMode: LanguageMode;
  autoRefresh: boolean;
  autoSave: boolean;
  autoSaveDelay: number;
  smoothScroll: boolean;
  preloadOutline: boolean;
  fontSize: number;
};

export type OutlineItem = {
  id: string;
  text: string;
  level: number;
  line: number;
};

export type MarkdownChunk = {
  index: number;
  startLine: number;
  text: string;
};

export type CurrentDocument = {
  filePath: string | null;
  name: string;
  directory: string | null;
  content: string;
  mtimeMs?: number;
  size?: number;
};
