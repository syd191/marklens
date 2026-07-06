import { describe, expect, it } from "vitest";
import { i18n, resolveLanguage } from "./i18n";

describe("i18n", () => {
  it("resolves system language to supported locales", () => {
    expect(resolveLanguage("system", "zh-CN")).toBe("zh-CN");
    expect(resolveLanguage("system", "en-US")).toBe("en-US");
    expect(resolveLanguage("system", "fr-FR")).toBe("en-US");
  });

  it("keeps Chinese and English core labels available", () => {
    expect(i18n["zh-CN"].drawer.outline).toBe("大纲");
    expect(i18n["en-US"].drawer.outline).toBe("Outline");
    expect(i18n["zh-CN"].language.label).toBe("界面语言");
    expect(i18n["en-US"].language.label).toBe("Interface Language");
  });
});
