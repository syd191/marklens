import { X } from "lucide-react";
import { useState } from "react";
import type { AppStrings } from "../lib/i18n";
import type { LanguageMode, Preferences, ThemeMode } from "../types";

type PreferencesModalProps = {
  t: AppStrings;
  open: boolean;
  preferences: Preferences;
  onChange: (preferences: Preferences) => void;
  onClose: () => void;
};

type PreferencesSection = "appearance" | "language" | "files" | "performance";

export function PreferencesModal({ t, open, preferences, onChange, onClose }: PreferencesModalProps) {
  const [section, setSection] = useState<PreferencesSection>("appearance");

  if (!open) return null;

  const update = <K extends keyof Preferences>(key: K, value: Preferences[K]) => {
    onChange({ ...preferences, [key]: value });
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="preferences-modal" role="dialog" aria-modal="true" aria-label={t.preferences.title} onMouseDown={(event) => event.stopPropagation()}>
        <div className="preferences-titlebar">
          <h2>{t.preferences.title}</h2>
          <button type="button" aria-label={t.preferences.close} onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="preferences-body">
          <nav className="preferences-nav">
            {(["appearance", "language", "files", "performance"] as PreferencesSection[]).map((item) => (
              <button
                key={item}
                className={section === item ? "is-active" : ""}
                type="button"
                onClick={() => setSection(item)}
              >
                {item === "language" ? t.language.label : t.preferences.nav[item]}
              </button>
            ))}
          </nav>

          <div className="preferences-content">
            {section === "appearance" && <section className="preference-group">
              <h3>{t.preferences.groups.appearance}</h3>
              <div className="segmented-list">
                {(["system", "github", "newsprint", "night", "pixyll", "whitey"] as ThemeMode[]).map((mode) => (
                  <label key={mode}>
                    <input
                      type="radio"
                      name="theme"
                      checked={preferences.themeMode === mode}
                      onChange={() => update("themeMode", mode)}
                    />
                    <span>{mode === "system" ? t.theme.system : t.theme[mode]}</span>
                  </label>
                ))}
              </div>
              <label className="inline-setting">
                <span>{t.preferences.fontSize}</span>
                <input
                  type="number"
                  min={13}
                  max={22}
                  value={preferences.fontSize}
                  onChange={(event) => update("fontSize", Number(event.target.value))}
                />
              </label>
            </section>}

            {section === "language" && <section className="preference-group">
              <h3>{t.language.label}</h3>
              <div className="segmented-list">
                {(["system", "zh-CN", "zh-TW", "en-US"] as LanguageMode[]).map((mode) => (
                  <label key={mode}>
                    <input
                      type="radio"
                      name="language"
                      checked={preferences.languageMode === mode}
                      onChange={() => update("languageMode", mode)}
                    />
                    <span>
                      {mode === "system"
                        ? t.language.system
                        : mode === "zh-CN"
                          ? t.language.chinese
                          : mode === "zh-TW"
                            ? t.language.traditional
                            : t.language.english}
                    </span>
                  </label>
                ))}
              </div>
            </section>}

            {section === "files" && <section className="preference-group">
              <h3>{t.preferences.groups.files}</h3>
              <label className="checkbox-setting">
                <input
                  type="checkbox"
                  checked={preferences.autoRefresh}
                  onChange={(event) => update("autoRefresh", event.target.checked)}
                />
                <span>{t.preferences.autoRefresh}</span>
              </label>
              <label className="checkbox-setting">
                <input
                  type="checkbox"
                  checked={preferences.autoSave}
                  onChange={(event) => update("autoSave", event.target.checked)}
                />
                <span>{t.preferences.autoSave}</span>
              </label>
              <label className="checkbox-setting">
                <input
                  type="checkbox"
                  checked={preferences.spellCheck}
                  onChange={(event) => update("spellCheck", event.target.checked)}
                />
                <span>{t.preferences.spellCheck}</span>
              </label>
              <label className="inline-setting">
                <span>{t.preferences.autoSaveDelay}</span>
                <select
                  value={preferences.autoSaveDelay}
                  disabled={!preferences.autoSave}
                  onChange={(event) => update("autoSaveDelay", Number(event.target.value))}
                >
                  <option value={500}>{t.preferences.delay500}</option>
                  <option value={1000}>{t.preferences.delay1000}</option>
                  <option value={3000}>{t.preferences.delay3000}</option>
                </select>
              </label>
            </section>}

            {section === "performance" && <section className="preference-group">
              <h3>{t.preferences.groups.performance}</h3>
              <label className="checkbox-setting">
                <input
                  type="checkbox"
                  checked={preferences.smoothScroll}
                  onChange={(event) => update("smoothScroll", event.target.checked)}
                />
                <span>{t.preferences.smoothScroll}</span>
              </label>
              <label className="checkbox-setting">
                <input
                  type="checkbox"
                  checked={preferences.preloadOutline}
                  onChange={(event) => update("preloadOutline", event.target.checked)}
                />
                <span>{t.preferences.preloadOutline}</span>
              </label>
            </section>}
          </div>
        </div>
      </section>
    </div>
  );
}
