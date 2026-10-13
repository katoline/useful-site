// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "../../../domain/document-settings";
import { buildPrintDocument } from "../core/document";
import { printFrame } from "./frame";

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe("data: URL の SVG の印刷", () => {
  it("印刷文書の SVG の data: URL を保ったまま iframe を印刷する", () => {
    const svgUrl = "data:image/svg+xml;base64,PHN2Zy8+";
    const html = buildPrintDocument({
      bodyHtml: `<img src="${svgUrl}" alt="ロゴ">`,
      settings: DEFAULT_SETTINGS,
      title: "文書",
      lang: "ja",
    });
    const frame = document.createElement("iframe");
    document.body.append(frame);
    const doc = frame.contentDocument;
    const win = frame.contentWindow;
    if (!doc || !win) throw new Error("iframe の文書がありません");
    doc.write(html);
    const print = vi.fn(() => {
      expect(doc.querySelector("img")?.getAttribute("src")).toBe(svgUrl);
      expect(doc.querySelector("meta")?.getAttribute("content")).toContain("img-src data: blob:");
    });
    // happy-dom の iframe は印刷 API を持たないので、ブラウザの窓口を補う
    Object.defineProperty(win, "print", { value: print });
    expect(printFrame(frame, "保存名")).toBe(true);
    expect(print).toHaveBeenCalledOnce();
  });
});
