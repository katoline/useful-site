/** 配置（余白・アイコン領域）と SVG の組み立て。 */
import { describe, expect, it } from "vitest";
import { SVG_INTRINSIC_SIZE } from "../../../domain/qr-settings";
import { normalizeCenterIcon } from "../core/icon";
import { buildQrLayout, computeIconBox, type QrMatrixLike } from "../core/layout";
import { buildQrSvg, pixelGridTransform } from "../core/svg";

const ALL_DARK: QrMatrixLike = { size: 21, isDark: () => true };
const CHECKER: QrMatrixLike = { size: 21, isDark: (row, col) => (row + col) % 2 === 0 };

const ICON_SVG = normalizeCenterIcon({
  kind: "svg",
  svg: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M0 0h24v24H0z"/></svg>',
});

function countModules(svg: string): number {
  return [...svg.matchAll(/M\d+ \d+h1v1h-1z/g)].length;
}

describe("computeIconBox", () => {
  it("中央に置き、台座込みで収まる範囲にする", () => {
    expect(computeIconBox(21, 16)).toEqual({ x: 9, y: 9, size: 3, pad: 1 });
    expect(computeIconBox(177, 16)).toEqual({ x: 74, y: 74, size: 28, pad: 1 });
  });

  it("小さすぎる・大きすぎる場合は置かない", () => {
    expect(computeIconBox(21, 0)).toBeNull();
    expect(computeIconBox(0, 16)).toBeNull();
    expect(computeIconBox(5, 16)).toBeNull();
  });
});

describe("buildQrLayout", () => {
  it("余白を 4 モジュールずつ足す", () => {
    const layout = buildQrLayout(CHECKER);
    expect(layout.extent).toBe(29);
    expect(layout.icon).toBeNull();
  });

  it("アイコン領域のモジュールは消す（暗い行列でも描かない）", () => {
    const plain = buildQrLayout(ALL_DARK);
    const withIcon = buildQrLayout(ALL_DARK, { iconSizePercent: 16 });
    let plainCount = 0;
    let iconCount = 0;
    for (let y = 0; y < 21; y++) {
      for (let x = 0; x < 21; x++) {
        if (plain.isDark(x, y)) plainCount++;
        if (withIcon.isDark(x, y)) iconCount++;
      }
    }
    expect(plainCount).toBe(441);
    expect(iconCount).toBe(441 - 25); // 5×5（アイコン 3 + 台座 1×2）を消す
    expect(withIcon.isDark(9, 9)).toBe(false);
    expect(withIcon.isDark(17, 9)).toBe(true);
  });

  it("記号の外は常に白", () => {
    const layout = buildQrLayout(ALL_DARK);
    expect(layout.isDark(-1, 0)).toBe(false);
    expect(layout.isDark(0, 21)).toBe(false);
  });
});

describe("buildQrSvg", () => {
  it("viewBox・背景・暗いモジュールのパスを出す", () => {
    const layout = buildQrLayout(CHECKER);
    const svg = buildQrSvg({ layout, foreground: "#000000" });
    expect(svg).toContain('viewBox="0 0 29 29"');
    expect(svg).toContain('<rect width="29" height="29" fill="#ffffff"/>');
    expect(svg).toContain('<path fill="#000000" d="M4 4h1v1h-1z');
    expect(countModules(svg)).toBe(221);
  });

  it("アイコンの台座と本体を埋め込む", () => {
    const layout = buildQrLayout(ALL_DARK, { iconSizePercent: 16 });
    const svg = buildQrSvg({
      layout,
      foreground: "#1e3a8a",
      icon: ICON_SVG,
      intrinsicSize: SVG_INTRINSIC_SIZE,
    });
    expect(svg).toContain('width="1024" height="1024"');
    expect(svg).toContain('<rect x="12" y="12" width="5" height="5" fill="#ffffff"/>');
    expect(svg).toContain(
      '<svg x="13" y="13" width="3" height="3" viewBox="0 0 24 24" fill="#1e3a8a" preserveAspectRatio="xMidYMid meet">',
    );
    expect(countModules(svg)).toBe(441 - 25);
  });

  it("PNG data URL のアイコンは image で埋め込む", () => {
    const layout = buildQrLayout(ALL_DARK, { iconSizePercent: 16 });
    const dataUrl = "data:image/png;base64,AAAA";
    const svg = buildQrSvg({
      layout,
      foreground: "#000000",
      icon: normalizeCenterIcon({ kind: "png", dataUrl }),
    });
    expect(svg).toContain(`<image x="13" y="13" width="3" height="3" href="${dataUrl}"`);
  });

  it("アイコンが無いときはアイコン領域も予約しない", () => {
    const layout = buildQrLayout(ALL_DARK);
    const svg = buildQrSvg({ layout, foreground: "#000000", icon: { kind: "none" } });
    expect(countModules(svg)).toBe(441);
    expect(svg).not.toContain("<image");
  });

  it("不正な色は組み立てを拒否する", () => {
    const layout = buildQrLayout(ALL_DARK);
    expect(() => buildQrSvg({ layout, foreground: 'red" onload="x' })).toThrow();
    expect(() => buildQrSvg({ layout, foreground: "#fff" })).toThrow();
  });
});

describe("pixelGridSize（PNG の整数画素へ揃える）", () => {
  it("未指定なら従来どおり変換を付けない", () => {
    const layout = buildQrLayout(ALL_DARK);
    const svg = buildQrSvg({ layout, foreground: "#000000" });
    expect(svg).not.toContain("<g transform=");
    expect(svg).toContain('<path fill="#000000" d="M4 4h1v1h-1z');
  });

  it("選択サイズでモジュール幅が整数画素になる縮小率と中央寄せを返す", () => {
    // extent 29・1024px: 35 画素 × 29 = 1015px、余り 9px（左 4px・右 5px）
    const big = pixelGridTransform(29, 1024);
    expect(big).toEqual({ scale: (35 * 29) / 1024, offset: (4 * 29) / 1024 });
    // extent 169・1024px: 6 画素 × 169 = 1014px、余り 10px を左右 5px ずつ
    expect(pixelGridTransform(169, 1024)).toEqual({
      scale: (6 * 169) / 1024,
      offset: (5 * 169) / 1024,
    });
    // extent 29・256px: 8 画素 × 29 = 232px、余り 24px を左右 12px ずつ
    expect(pixelGridTransform(29, 256)).toEqual({
      scale: (8 * 29) / 256,
      offset: (12 * 29) / 256,
    });
  });

  it("縮小できないときは変換しない", () => {
    expect(pixelGridTransform(29, undefined)).toBeNull();
    expect(pixelGridTransform(29, 0)).toBeNull();
    expect(pixelGridTransform(29, Number.NaN)).toBeNull();
    expect(pixelGridTransform(300, 256)).toBeNull(); // モジュールが 1 画素未満
    expect(pixelGridTransform(0, 256)).toBeNull();
  });

  it("出力では全モジュールの境界が整数画素に乗り、中央へ寄る", () => {
    const layout = buildQrLayout(ALL_DARK); // extent 29
    const pixels = 1024;
    const svg = buildQrSvg({ layout, foreground: "#000000", pixelGridSize: pixels });
    const match = /<g transform="translate\(([\d.]+) ([\d.]+)\) scale\(([\d.]+)\)">/.exec(svg);
    expect(match).not.toBeNull();
    const offset = Number(match?.[1]);
    const scale = Number(match?.[3]);
    const toDevice = (unit: number) => ((offset + unit * scale) * pixels) / layout.extent;

    for (let i = 0; i <= layout.extent; i++) {
      expect(toDevice(i)).toBeCloseTo(Math.round(toDevice(i)), 9);
    }
    expect(toDevice(0)).toBeCloseTo(4, 9);
    // 余り 9px は floor で左へ寄せるので、右は 5px
    expect(pixels - toDevice(layout.extent)).toBeCloseTo(5, 9);
    // モジュール 1 つ分が 35 画素
    expect(toDevice(1) - toDevice(0)).toBeCloseTo(35, 9);
  });

  it("白背景は変換の外側、暗いモジュールとアイコンは内側に置く", () => {
    const layout = buildQrLayout(ALL_DARK, { iconSizePercent: 16 });
    const svg = buildQrSvg({
      layout,
      foreground: "#000000",
      icon: ICON_SVG,
      pixelGridSize: 512,
    });
    const group = svg.indexOf("<g transform=");
    expect(svg.indexOf('<rect width="29" height="29" fill="#ffffff"/>')).toBeLessThan(group);
    expect(svg.indexOf('<path fill="#000000"')).toBeGreaterThan(group);
    expect(svg.indexOf('<rect x="12" y="12" width="5" height="5"')).toBeGreaterThan(group);
    expect(svg.indexOf('<svg x="13" y="13"')).toBeGreaterThan(group);
    expect(svg.indexOf("</g>")).toBeGreaterThan(svg.indexOf('<path fill="#000000"'));
    expect(countModules(svg)).toBe(441 - 25);
  });
});
