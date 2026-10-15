/** icon-selection の純粋な部分（受け入れ判定・先頭バイト・縮小・SVG の組み立て・i18n との対応）を DOM なしで検証する。 */
import { describe, expect, it } from "vitest";
import {
  BRAND_ICON_IDS,
  BUILTIN_ICON_IDS,
  GENERIC_ICON_IDS,
  imageIcon,
  MAX_ICON_ARTWORK_DIMENSION,
  MAX_ICON_SOURCE_BYTES,
  MAX_ICON_SOURCE_DIMENSION,
  noIcon,
} from "../../../domain/icons";
import { ja } from "../../../i18n/ja";
import { artworkForSelection, builtinIconDefinition } from "../adapters/builtin-icons";
import { ICON_VIEW_BOX, iconSvg } from "../core/artwork";
import {
  checkIconFile,
  fitWithinLimit,
  iconImageType,
  isWithinSourceDimensions,
  sniffIconImageType,
} from "../core/validate";

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
const webp = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
]);
const gif = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0, 0, 0, 0, 0, 0]);
const svg = new Uint8Array(
  [...'<svg xmlns="http://www.w3.org/2000/svg">'].map((c) => c.charCodeAt(0)),
);

describe("先頭バイトでの形式判定", () => {
  it("PNG・JPEG・WebP だけを受け付ける", () => {
    expect(sniffIconImageType(png)).toBe("image/png");
    expect(sniffIconImageType(jpeg)).toBe("image/jpeg");
    expect(sniffIconImageType(webp)).toBe("image/webp");
  });

  it("GIF・SVG・短すぎるデータは拒否する", () => {
    expect(sniffIconImageType(gif)).toBeUndefined();
    expect(sniffIconImageType(svg)).toBeUndefined();
    expect(sniffIconImageType(new Uint8Array([0x89, 0x50]))).toBeUndefined();
    expect(sniffIconImageType(new Uint8Array())).toBeUndefined();
  });
});

describe("アップロードの受け入れ判定", () => {
  it("MIME、無ければ拡張子で形式を決める", () => {
    expect(iconImageType({ name: "a.png", type: "image/png" })).toBe("image/png");
    expect(iconImageType({ name: "a.PNG", type: "" })).toBe("image/png");
    expect(iconImageType({ name: "a.jpeg", type: "" })).toBe("image/jpeg");
    expect(iconImageType({ name: "a.jpg", type: "image/jpg" })).toBe("image/jpeg");
    expect(iconImageType({ name: "a.webp", type: "image/webp" })).toBe("image/webp");
  });

  it("SVG・GIF・拡張子なしは種類として拒否する", () => {
    expect(iconImageType({ name: "a.svg", type: "image/svg+xml" })).toBeUndefined();
    expect(iconImageType({ name: "a.gif", type: "image/gif" })).toBeUndefined();
    expect(iconImageType({ name: "a.png", type: "text/plain" })).toBeUndefined();
    expect(checkIconFile({ name: "a.svg", size: 10, type: "image/svg+xml" })).toEqual({
      ok: false,
      reason: "type",
    });
  });

  it("2 MiB を超えると大きさとして拒否する（境界はちょうどまで許可）", () => {
    expect(
      checkIconFile({ name: "a.png", size: MAX_ICON_SOURCE_BYTES, type: "image/png" }),
    ).toEqual({
      ok: true,
      type: "image/png",
    });
    expect(
      checkIconFile({ name: "a.png", size: MAX_ICON_SOURCE_BYTES + 1, type: "image/png" }),
    ).toEqual({ ok: false, reason: "size" });
  });
});

describe("縮小と寸法の上限", () => {
  it("4096px までを上限にする", () => {
    expect(isWithinSourceDimensions(MAX_ICON_SOURCE_DIMENSION, MAX_ICON_SOURCE_DIMENSION)).toBe(
      true,
    );
    expect(isWithinSourceDimensions(MAX_ICON_SOURCE_DIMENSION + 1, 10)).toBe(false);
    expect(isWithinSourceDimensions(0, 10)).toBe(false);
    expect(isWithinSourceDimensions(Number.NaN, 10)).toBe(false);
  });

  it("縦横比を保って最大 512px へ縮小し、拡大はしない", () => {
    expect(fitWithinLimit(1024, 512, MAX_ICON_ARTWORK_DIMENSION)).toEqual({
      width: 512,
      height: 256,
    });
    expect(fitWithinLimit(4096, 2048, MAX_ICON_ARTWORK_DIMENSION)).toEqual({
      width: 512,
      height: 256,
    });
    expect(fitWithinLimit(100, 80, MAX_ICON_ARTWORK_DIMENSION)).toEqual({ width: 100, height: 80 });
    expect(fitWithinLimit(3000, 3000, MAX_ICON_ARTWORK_DIMENSION)).toEqual({
      width: 512,
      height: 512,
    });
  });
});

/** 生成エンジン（parseTrustedSvgIcon）と同じく、外側の svg を外して中身だけを取り出す */
function innerOf(svg: string): string {
  return svg.slice(svg.indexOf(">") + 1, svg.lastIndexOf("</svg>"));
}
function outerOf(svg: string): string {
  return svg.slice(0, svg.indexOf(">") + 1);
}

describe("組込アイコンの SVG", () => {
  it("すべての ID が図形を持ち、固定の SVG になる", () => {
    expect(BUILTIN_ICON_IDS).toHaveLength(GENERIC_ICON_IDS.length + BRAND_ICON_IDS.length);
    for (const id of BUILTIN_ICON_IDS) {
      const definition = builtinIconDefinition(id);
      expect(definition.shapes.length, id).toBeGreaterThan(0);
      const markup = iconSvg(definition);
      expect(markup.startsWith("<svg "), id).toBe(true);
      expect(markup).toContain(`viewBox="${ICON_VIEW_BOX}"`);
      // 生成エンジンは外側の svg を捨てるので、描画属性を外側に置かない
      expect(outerOf(markup), id).not.toContain("fill=");
      expect(outerOf(markup), id).not.toContain("stroke=");
      // 中身に svg が入れ子にならない（エンジンは svg を 1 つだけ許す）
      expect(innerOf(markup), id).not.toContain("<svg");
      // 外部参照やスクリプトを混ぜない
      expect(markup).not.toContain("<script");
      expect(markup).not.toContain("href");
      expect(markup).not.toContain("javascript:");
      expect(markup).not.toContain("url(");
    }
  });

  it("外側の svg を外しても、線画と塗りの指定が中身に残る", () => {
    const stroke = iconSvg(builtinIconDefinition("link"));
    expect(innerOf(stroke)).toContain('fill="none"');
    expect(innerOf(stroke)).toContain('stroke="#000000"');
    expect(innerOf(stroke)).toContain("stroke-width");

    const solid = iconSvg(builtinIconDefinition("github"));
    expect(innerOf(solid)).toContain("<path");
    // 塗りつぶしは生成エンジンの入れ子 svg の fill（QR の前景色）を継承させる
    expect(innerOf(solid)).not.toContain('fill="none"');
    expect(innerOf(solid)).not.toContain("stroke=");
  });

  it("選択を親へ渡す絵に変換する", () => {
    expect(artworkForSelection(noIcon())).toBeNull();
    expect(artworkForSelection({ kind: "builtin", id: "star" })).toMatchObject({ kind: "svg" });
    expect(artworkForSelection(imageIcon("data:image/png;base64,AAAA", 512, 256))).toEqual({
      kind: "png",
      dataUrl: "data:image/png;base64,AAAA",
    });
  });
});

describe("i18n のアイコン名", () => {
  it("domain の ID と ja の icon.icons が一致する", () => {
    expect(Object.keys(ja.icon.icons).sort()).toEqual([...BUILTIN_ICON_IDS].sort());
    for (const id of BUILTIN_ICON_IDS) expect(ja.icon.icons[id].trim()).not.toBe("");
  });
});
