/**
 * 生成した SVG を独立デコーダー jsQR で復号する。
 * 実際の SVG のパス（暗いモジュール）とアイコン領域をラスタライズし、
 * 余白・アイコン合成後も URL が読めることを確かめる（アイコンは最悪ケースとして濃く塗る）。
 */
import jsQR from "jsqr";
import { describe, expect, it } from "vitest";
import { DEFAULT_QR_SETTINGS } from "../../../domain/qr-settings";
import { createQrSvgGenerator, generateQrSvg, loadQrcodeEncoder } from "../adapters/generate";
import type { CenterIconInput } from "../core/icon";

const GITHUB_SVG =
  '<svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><title>GitHub</title><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04z"/></svg>';

const PNG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

/** SVG の viewBox の一辺（余白込みのモジュール数）を取り出す */
function extentOf(svg: string): number {
  const match = /viewBox="0 0 (\d+) \d+"/.exec(svg);
  if (!match) throw new Error("viewBox が見つかりません");
  return Number(match[1]);
}

/** SVG を画素へ描く（パスの暗いモジュールとアイコン領域だけ） */
function rasterize(svg: string): { data: Uint8ClampedArray; width: number } {
  const extent = extentOf(svg);
  const scale = Math.max(4, Math.round(1024 / extent));
  const width = extent * scale;
  const data = new Uint8ClampedArray(width * width * 4).fill(255);

  const paint = (mx: number, my: number) => {
    for (let dy = 0; dy < scale; dy++) {
      for (let dx = 0; dx < scale; dx++) {
        const px = mx * scale + dx;
        const py = my * scale + dy;
        const i = (py * width + px) * 4;
        data[i] = 0;
        data[i + 1] = 0;
        data[i + 2] = 0;
        data[i + 3] = 255;
      }
    }
  };

  const path = /<path[^>]*\sd="([^"]*)"/.exec(svg)?.[1] ?? "";
  for (const match of path.matchAll(/M(\d+) (\d+)h1v1h-1z/g)) {
    paint(Number(match[1]), Number(match[2]));
  }

  // 中央アイコンは最悪ケースとして本体の領域を濃く塗る
  const icon =
    /<(?:svg|image)\b[^>]*?x="(\d+)"[^>]*?y="(\d+)"[^>]*?width="(\d+)"[^>]*?height="(\d+)"/g;
  for (const match of svg.matchAll(icon)) {
    const x = Number(match[1]);
    const y = Number(match[2]);
    const w = Number(match[3]);
    const h = Number(match[4]);
    for (let my = y; my < y + h; my++) {
      for (let mx = x; mx < x + w; mx++) paint(mx, my);
    }
  }

  return { data, width };
}

function decode(svg: string): string | null {
  const { data, width } = rasterize(svg);
  return jsQR(data, width, width)?.data ?? null;
}

const ICONS: { name: string; icon: CenterIconInput }[] = [
  { name: "アイコン無し", icon: { kind: "none" } },
  { name: "組込 SVG", icon: { kind: "svg", svg: GITHUB_SVG } },
  { name: "アップロード PNG", icon: { kind: "png", dataUrl: PNG_DATA_URL } },
];

describe("generateQrSvg", () => {
  it("長さの違う URL を復号できる", async () => {
    const urls = [
      "https://example.com/",
      "https://ja.wikipedia.org/wiki/日本語",
      `https://example.com/search?q=${"keyword+".repeat(40)}`,
    ];
    for (const url of urls) {
      const { svg, moduleCount, extent, quietZone } = await generateQrSvg(url, DEFAULT_QR_SETTINGS);
      expect(svg).not.toContain("example.com"); // URL の文字列は SVG に入らない
      expect(extent).toBe(moduleCount + quietZone * 2);
      const decoded = decode(svg);
      expect(decoded, url).toBe(url);
    }
  });

  it("中央アイコンを合成しても URL を復号できる", async () => {
    const url = "https://example.com/icon";
    for (const { name, icon } of ICONS) {
      const { svg, hasIcon } = await generateQrSvg(url, DEFAULT_QR_SETTINGS, icon);
      expect(hasIcon, name).toBe(icon.kind !== "none");
      expect(decode(svg), name).toBe(url);
    }
  });

  it("不正なアイコンはアイコン無しとして扱う（SVG に混ざらない）", async () => {
    const url = "https://example.com/";
    const { svg, hasIcon } = await generateQrSvg(url, DEFAULT_QR_SETTINGS, {
      kind: "svg",
      svg: '<svg viewBox="0 0 24 24"><script>alert(1)</script></svg>',
    });
    expect(hasIcon).toBe(false);
    expect(svg).not.toContain("script");
    expect(decode(svg)).toBe(url);
  });

  it("符号化器を差し替えられる（port）", async () => {
    const encoder = {
      encode: () => ({
        size: 21,
        isDark: (row: number, col: number) => (row + col) % 2 === 0,
      }),
    };
    const generate = createQrSvgGenerator(async () => encoder);
    const { moduleCount, extent, svg } = await generate("anything", DEFAULT_QR_SETTINGS);
    expect(moduleCount).toBe(21);
    expect(extent).toBe(29);
    expect(svg).toContain('viewBox="0 0 29 29"');
  });

  it("既定の符号化器は誤り訂正 H を使う", async () => {
    const encoder = await loadQrcodeEncoder();
    // H は M より大きい（モジュール数が増える）
    expect(encoder.encode("https://example.com/").size).toBe(29);
    expect(encoder.encode("a".repeat(200)).size).toBeGreaterThan(encoder.encode("a").size);
  });
});

/** SVG の g transform を反映して、指定画素数で描く（PNG 出力の整数画素を再現する） */
function rasterizeAt(svg: string, pixels: number): { data: Uint8ClampedArray; width: number } {
  const extent = extentOf(svg);
  const match = /<g transform="translate\(([\d.]+) [\d.]+\) scale\(([\d.]+)\)">/.exec(svg);
  const offset = match ? Number(match[1]) : 0;
  const scale = match ? Number(match[2]) : 1;
  const width = pixels;
  const data = new Uint8ClampedArray(width * width * 4).fill(255);
  const toDevice = (unit: number) => ((offset + unit * scale) * pixels) / extent;
  const paint = (x0: number, y0: number, x1: number, y1: number) => {
    for (let py = y0; py < y1; py++) {
      for (let px = x0; px < x1; px++) {
        const i = (py * width + px) * 4;
        data[i] = 0;
        data[i + 1] = 0;
        data[i + 2] = 0;
        data[i + 3] = 255;
      }
    }
  };

  const path = /<path[^>]*\sd="([^"]*)"/.exec(svg)?.[1] ?? "";
  for (const m of path.matchAll(/M(\d+) (\d+)h1v1h-1z/g)) {
    const x = Number(m[1]);
    const y = Number(m[2]);
    paint(
      Math.round(toDevice(x)),
      Math.round(toDevice(y)),
      Math.round(toDevice(x + 1)),
      Math.round(toDevice(y + 1)),
    );
  }

  const icon =
    /<(?:svg|image)\b[^>]*?x="(\d+)"[^>]*?y="(\d+)"[^>]*?width="(\d+)"[^>]*?height="(\d+)"/g;
  for (const m of svg.matchAll(icon)) {
    const x = Number(m[1]);
    const y = Number(m[2]);
    const w = Number(m[3]);
    const h = Number(m[4]);
    paint(
      Math.round(toDevice(x)),
      Math.round(toDevice(y)),
      Math.round(toDevice(x + w)),
      Math.round(toDevice(y + h)),
    );
  }

  return { data, width };
}

describe("PNG の整数画素（選択サイズでスキャンできる）", () => {
  it("998 バイトの日本語 URL でも 1024px で復号できる", async () => {
    const url = `https://example.com/${"日".repeat(326)}`; // 20 + 978 = 998 バイト
    const settings = { ...DEFAULT_QR_SETTINGS, pngSize: 1024 as const };
    const { svg, moduleCount, extent } = await generateQrSvg(url, settings);
    expect(moduleCount).toBe(161);
    expect(extent).toBe(169);

    const match = /<g transform="translate\(([\d.]+) [\d.]+\) scale\(([\d.]+)\)">/.exec(svg);
    expect(match).not.toBeNull();
    const offset = Number(match?.[1]);
    const scale = Number(match?.[2]);
    const modulePixels = Math.floor(1024 / extent);
    expect(modulePixels).toBe(6);

    // すべてのモジュール境界が整数画素に乗る
    for (let i = 0; i <= extent; i++) {
      const device = ((offset + i * scale) * 1024) / extent;
      expect(device).toBeCloseTo(Math.round(device), 9);
    }
    // QR 実寸 1014px を左右 5px の白余白で中央へ
    expect(((offset + 0 * scale) * 1024) / extent).toBeCloseTo(5, 9);
    expect(1024 - ((offset + extent * scale) * 1024) / extent).toBeCloseTo(5, 9);

    // PNG 出力と同じ整数画素で描いて復号する
    const { data, width } = rasterizeAt(svg, 1024);
    expect(jsQR(data, width, width)?.data).toBe(url);
  });
});
