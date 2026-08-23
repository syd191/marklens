import { beforeEach, describe, expect, it } from "vitest";
import {
  buildEpubDocumentStyles,
  clampFontSize,
  flattenToc,
  getEpubErrorMessage,
  getEpubWheelTurn,
  loadEpubReadingState,
  normalizeEpubWheelDelta,
  normalizeLocalizedValue,
  saveEpubReadingState
} from "./epub";

describe("EPUB helpers", () => {
  beforeEach(() => localStorage.clear());

  it("selects localized metadata and contributor names without stringifying objects", () => {
    expect(normalizeLocalizedValue({ en: "English title", zh: "中文标题" }, ["zh-CN", "en"])).toBe("中文标题");
    expect(normalizeLocalizedValue([{ name: { ja: "夏目漱石", en: "Soseki Natsume" } }], ["ja", "en"])).toBe("夏目漱石");
  });

  it("flattens nested EPUB navigation while preserving its hierarchy", () => {
    expect(flattenToc([
      { label: "Part I", href: "part.xhtml", subitems: [{ label: "Chapter 1", href: "ch1.xhtml" }] },
      { label: "Part II", href: "part2.xhtml" }
    ])).toEqual([
      expect.objectContaining({ label: "Part I", depth: 0 }),
      expect.objectContaining({ label: "Chapter 1", depth: 1 }),
      expect.objectContaining({ label: "Part II", depth: 0 })
    ]);
  });

  it("clamps corrupt preferences and safely restores reading state", () => {
    localStorage.setItem("book", JSON.stringify({ flow: "unknown", fontSize: 100, tocOpen: false, cfi: 42 }));
    expect(loadEpubReadingState("book")).toEqual({ flow: "paginated", fontSize: 32, tocOpen: false });
    expect(clampFontSize(Number.NaN)).toBe(18);
    expect(clampFontSize(8)).toBe(13);
  });

  it("persists the CFI, flow and reader preferences", () => {
    saveEpubReadingState("book", { cfi: "epubcfi(/6/2)", flow: "scrolled", fontSize: 20, tocOpen: true });
    expect(loadEpubReadingState("book")).toEqual({
      cfi: "epubcfi(/6/2)",
      flow: "scrolled",
      fontSize: 20,
      tocOpen: true
    });
  });

  it("classifies common malformed EPUB failures into actionable messages", () => {
    expect(getEpubErrorMessage(new Error("EPUB_INVALID_CONTAINER"), "zh-CN")).toContain("有效的 EPUB 容器");
    expect(getEpubErrorMessage(new Error("META-INF/container.xml missing"), "en-US")).toContain("container or OPF");
    expect(getEpubErrorMessage(new Error("encrypted resource"), "zh-TW")).toContain("DRM");
  });

  it("builds readable theme CSS without touching the book's fixed-layout dimensions", () => {
    const css = buildEpubDocumentStyles("night", 20);
    expect(css).toContain("font-size: 20px");
    expect(css).toContain("background: #1f1f1f");
    expect(css).not.toContain("width: 100vw");
    expect(css).not.toContain("height: 100vh");
  });

  it("normalizes mouse-wheel and trackpad input before turning a page", () => {
    expect(normalizeEpubWheelDelta(5, 40, 0)).toBe(40);
    expect(normalizeEpubWheelDelta(-6, 2, 1)).toBe(-96);
    expect(normalizeEpubWheelDelta(0, 1, 2)).toBe(800);
    expect(getEpubWheelTurn(39)).toBe(0);
    expect(getEpubWheelTurn(40)).toBe(1);
    expect(getEpubWheelTurn(-40)).toBe(-1);
  });
});
