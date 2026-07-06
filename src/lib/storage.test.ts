import { beforeEach, describe, expect, it } from "vitest";
import { defaultPreferences, loadPreferences, savePreferences } from "./storage";

describe("preference storage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns defaults when nothing has been saved", () => {
    expect(loadPreferences()).toEqual(defaultPreferences);
  });

  it("persists user preferences", () => {
    savePreferences({ ...defaultPreferences, autoSave: true, languageMode: "en-US", fontSize: 18 });

    expect(loadPreferences()).toMatchObject({
      autoSave: true,
      languageMode: "en-US",
      fontSize: 18
    });
  });

  it("falls back to defaults when stored data is invalid", () => {
    localStorage.setItem("marklens-preferences-v1", "{broken");

    expect(loadPreferences()).toEqual(defaultPreferences);
  });
});
