import type { Preferences } from "../types";

const KEY = "marklens-preferences-v1";

export const defaultPreferences: Preferences = {
  themeMode: "system",
  languageMode: "system",
  autoRefresh: true,
  autoSave: false,
  autoSaveDelay: 1000,
  smoothScroll: true,
  preloadOutline: false,
  fontSize: 16,
  spellCheck: true
};

export function loadPreferences(): Preferences {
  try {
    const saved = localStorage.getItem(KEY);
    if (!saved) return defaultPreferences;
    const parsed = JSON.parse(saved);
    if (parsed.themeMode === "light") parsed.themeMode = "github";
    return { ...defaultPreferences, ...parsed };
  } catch {
    return defaultPreferences;
  }
}

export function savePreferences(preferences: Preferences) {
  localStorage.setItem(KEY, JSON.stringify(preferences));
}
