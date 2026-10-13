import { describe, expect, it } from "vitest";
import { createMarkdownItRenderer } from "./markdown-it-renderer";

describe("同梱 SVG のレンダリング", () => {
  it("相対パスの SVG を data: URL に置き換え、プレビュー用の img に使う", async () => {
    const renderer = await createMarkdownItRenderer();
    const svgUrl = "data:image/svg+xml;base64,PHN2Zy8+";
    const html = renderer.render("![ロゴ](./logo.svg)", {
      images: new Map([["logo.svg", svgUrl]]),
      blockedImageLabel: "画像を表示できません",
    });
    expect(html).toContain(`<img src="${svgUrl}" alt="ロゴ">`);
    expect(html).not.toContain("md-blocked-image");
  });
});
