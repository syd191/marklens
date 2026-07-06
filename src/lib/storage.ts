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
  fontSize: 16
};

export function loadPreferences(): Preferences {
  try {
    const saved = localStorage.getItem(KEY);
    if (!saved) return defaultPreferences;
    return { ...defaultPreferences, ...JSON.parse(saved) };
  } catch {
    return defaultPreferences;
  }
}

export function savePreferences(preferences: Preferences) {
  localStorage.setItem(KEY, JSON.stringify(preferences));
}
