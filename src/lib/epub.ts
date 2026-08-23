import type { AppLanguage, ResolvedTheme } from "../types";
import type { FoliateLocalizedValue, FoliateTocItem } from "foliate-js/view.js";

export type EpubFlow = "paginated" | "scrolled";

export type EpubReadingState = {
  cfi?: string;
  flow: EpubFlow;
  fontSize: number;
  tocOpen: boolean;
};

export const EPUB_WHEEL_TURN_THRESHOLD = 40;

export function normalizeEpubWheelDelta(deltaX: number, deltaY: number, deltaMode: number) {
  const dominantDelta = Math.abs(deltaY) >= Math.abs(deltaX) ? deltaY : deltaX;
  const scale = deltaMode === 1 ? 16 : deltaMode === 2 ? 800 : 1;
  return dominantDelta * scale;
}

export function getEpubWheelTurn(accumulatedDelta: number): -1 | 0 | 1 {
  if (accumulatedDelta >= EPUB_WHEEL_TURN_THRESHOLD) return 1;
  if (accumulatedDelta <= -EPUB_WHEEL_TURN_THRESHOLD) return -1;
  return 0;
}

const DEFAULT_READING_STATE: EpubReadingState = {
  flow: "paginated",
  fontSize: 18,
  tocOpen: true
};

export function getEpubReadingKey(filePath: string, size: number, mtimeMs: number) {
  return `marklens-epub-v1:${filePath.toLocaleLowerCase()}:${size}:${Math.trunc(mtimeMs)}`;
}

export function loadEpubReadingState(key: string): EpubReadingState {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) ?? "null") as Partial<EpubReadingState> | null;
    if (!parsed) return { ...DEFAULT_READING_STATE };
    return {
      cfi: typeof parsed.cfi === "string" ? parsed.cfi : undefined,
      flow: parsed.flow === "scrolled" ? "scrolled" : "paginated",
      fontSize: clampFontSize(parsed.fontSize),
      tocOpen: parsed.tocOpen !== false
    };
  } catch {
    return { ...DEFAULT_READING_STATE };
  }
}

export function saveEpubReadingState(key: string, state: EpubReadingState) {
  try {
    localStorage.setItem(key, JSON.stringify(state));
  } catch {
    // Reading progress is a convenience; storage failures must not interrupt reading.
  }
}

export function clampFontSize(value: unknown) {
  const number = typeof value === "number" && Number.isFinite(value) ? value : DEFAULT_READING_STATE.fontSize;
  return Math.max(13, Math.min(32, Math.round(number)));
}

export function normalizeLocalizedValue(value: unknown, languages: string[]): string {
  if (typeof value === "string") return value.trim();
  if (!value || typeof value !== "object") return "";

  if (Array.isArray(value)) {
    for (const item of value) {
      const normalized = normalizeLocalizedValue(item, languages);
      if (normalized) return normalized;
    }
    return "";
  }

  const record = value as Record<string, unknown>;
  if (record.name) return normalizeLocalizedValue(record.name, languages);
  for (const language of languages) {
    const exact = normalizeLocalizedValue(record[language], languages);
    if (exact) return exact;
    const base = language.split("-")[0];
    const matchingKey = Object.keys(record).find((key) => key.split("-")[0].toLowerCase() === base.toLowerCase());
    const matching = matchingKey ? normalizeLocalizedValue(record[matchingKey], languages) : "";
    if (matching) return matching;
  }
  for (const item of Object.values(record)) {
    const normalized = normalizeLocalizedValue(item, languages);
    if (normalized) return normalized;
  }
  return "";
}

export function flattenToc(items: FoliateTocItem[] = [], depth = 0): Array<FoliateTocItem & { depth: number }> {
  const result: Array<FoliateTocItem & { depth: number }> = [];
  for (const item of items) {
    result.push({ ...item, depth });
    if (item.subitems?.length) result.push(...flattenToc(item.subitems, depth + 1));
  }
  return result;
}

export function getEpubErrorMessage(error: unknown, language: AppLanguage) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const zh = language !== "en-US";
  if (/EPUB_TOO_LARGE/.test(message)) {
    return zh ? "这本电子书超过 512 MB 的安全读取上限。" : "This book exceeds the 512 MB safety limit.";
  }
  if (/EPUB_EMPTY/.test(message)) {
    return zh ? "文件为空或尚未完整下载。" : "The file is empty or has not finished downloading.";
  }
  if (/EPUB_INVALID_CONTAINER|not a valid zip|invalid zip|central directory/i.test(message)) {
    return zh ? "文件不是有效的 EPUB 容器，可能只是改了扩展名，或压缩包已经损坏。" : "This is not a valid EPUB container. It may be renamed or corrupted.";
  }
  if (/container\.xml|rootfile|package document|\.opf/i.test(message)) {
    return zh ? "电子书缺少或写错了 container.xml / OPF 包信息，无法确定正文顺序。" : "The book has invalid container or OPF package metadata, so its reading order cannot be determined.";
  }
  if (/encrypted|encryption|drm/i.test(message)) {
    return zh ? "这本电子书包含 MarkLens 暂不支持的 DRM 或加密内容。" : "This book contains DRM or encrypted content that MarkLens cannot open.";
  }
  return zh ? "无法解析这本电子书。文件可能不符合 EPUB 2/3 规范或缺少必要资源。" : "MarkLens could not parse this book. It may not conform to EPUB 2/3 or may be missing required resources.";
}

export function buildEpubDocumentStyles(theme: ResolvedTheme, fontSize: number) {
  const night = theme === "night";
  const paper = theme === "newsprint" ? "#f4f0e8" : theme === "pixyll" ? "#fffdf9" : night ? "#1f1f1f" : "#ffffff";
  const text = theme === "newsprint" ? "#2e2a25" : theme === "pixyll" ? "#4a4037" : night ? "#e6e6e6" : "#292929";
  const muted = night ? "#b8b8b8" : "#6f6f6f";
  const accent = night ? "#8ab4f8" : theme === "newsprint" ? "#8b3f34" : "#2f6fbd";
  const size = clampFontSize(fontSize);
  return `
    :root { color-scheme: ${night ? "dark" : "light"}; }
    html, body { background: ${paper} !important; color: ${text} !important; }
    body { font-size: ${size}px !important; line-height: 1.72 !important; text-rendering: optimizeLegibility; }
    p, li, blockquote, dd, dt { color: ${text}; }
    a, a:visited { color: ${accent} !important; }
    hr { border-color: ${muted} !important; opacity: .45; }
    pre, code { font-family: "Cascadia Mono", Consolas, monospace; }
    img, svg, video { max-width: 100%; }
    ::selection { background: ${accent}; color: #fff; }
  `;
}

export function languagePreferences(language: AppLanguage, bookLanguage?: string | string[]) {
  const bookLanguages = Array.isArray(bookLanguage) ? bookLanguage : bookLanguage ? [bookLanguage] : [];
  return [...bookLanguages, language, language.split("-")[0], "en"];
}

export function formatEpubPercent(value: number) {
  return `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;
}
