import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Limits } from "~/apps/image-adjust/domain/limits";
import { mipSizes, pickLevel } from "../adapters/render";
import { IconSourceError, loadIconSource, WORKING_SIZE, workingSize } from "../adapters/source";
import { exceedsPixels, readImageSize } from "../core/image-header";
import { DEFAULT_ICON_SETTINGS, isValidBasePath, normalizeBasePath } from "../core/settings";
import { buildHeadSnippet } from "../core/snippet";

function pngHeader(width: number, height: number): Uint8Array {
  const b = new Uint8Array(33);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  const v = new DataView(b.buffer);
  v.setUint32(16, width);
  v.setUint32(20, height);
  return b;
}

function jpegHeader(width: number, height: number): Uint8Array {
  // SOI → APP0（長さ 16）→ SOF0
  const app0 = [0xff, 0xe0, 0x00, 0x10, ...new Array(14).fill(0)];
  const sof = [
    0xff,
    0xc0,
    0x00,
    0x11,
    0x08,
    height >> 8,
    height & 0xff,
    width >> 8,
    width & 0xff,
    3,
  ];
  return new Uint8Array([0xff, 0xd8, ...app0, ...sof, ...new Array(10).fill(0)]);
}

function riff(chunk: string, payload: number[]): Uint8Array {
  const b = new Uint8Array(40);
  b.set(
    [..."RIFF"].map((c) => c.charCodeAt(0)),
    0,
  );
  b.set(
    [..."WEBP"].map((c) => c.charCodeAt(0)),
    8,
  );
  b.set(
    [...chunk].map((c) => c.charCodeAt(0)),
    12,
  );
  b.set(payload, 20);
  return b;
}

describe("readImageSize（ヘッダーから寸法を読む）", () => {
  it("PNG", () => {
    expect(readImageSize(pngHeader(12000, 8000))).toEqual({ width: 12000, height: 8000 });
  });
  it("JPEG（APP の後ろの SOF）", () => {
    expect(readImageSize(jpegHeader(6000, 4000))).toEqual({ width: 6000, height: 4000 });
  });
  it("WebP（VP8 / VP8L / VP8X）", () => {
    // VP8：フレームタグ 3 バイト＋開始コード＋幅・高さ
    expect(
      readImageSize(riff("VP8 ", [0, 0, 0, 0x9d, 0x01, 0x2a, 0x70, 0x17, 0xa0, 0x0f])),
    ).toEqual({ width: 6000, height: 4000 });
    // VP8L：幅-1・高さ-1 を 14 ビットずつ（ここでは 100×50）
    const w = 99;
    const h = 49;
    const bits = w | (h << 14);
    expect(
      readImageSize(
        riff("VP8L", [
          0x2f,
          bits & 0xff,
          (bits >> 8) & 0xff,
          (bits >> 16) & 0xff,
          (bits >> 24) & 0xff,
        ]),
      ),
    ).toEqual({ width: 100, height: 50 });
    // VP8X：フラグ 4 バイトの後に幅-1・高さ-1（24 ビット）
    const vw = 20000 - 1;
    const vh = 3000 - 1;
    expect(
      readImageSize(
        riff("VP8X", [
          0,
          0,
          0,
          0,
          vw & 0xff,
          (vw >> 8) & 0xff,
          vw >> 16,
          vh & 0xff,
          (vh >> 8) & 0xff,
          vh >> 16,
        ]),
      ),
    ).toEqual({ width: 20000, height: 3000 });
  });
  it("GIF", () => {
    expect(
      readImageSize(new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x10, 0x27, 0x10, 0x27])),
    ).toEqual({ width: 10000, height: 10000 });
  });
  it("読めなければ null", () => {
    expect(readImageSize(new Uint8Array(64))).toBeNull();
    expect(readImageSize(new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0, 0]))).toBeNull();
  });
  it("exceedsPixels", () => {
    expect(exceedsPixels({ width: 8000, height: 5001 }, 40_000_000)).toBe(true);
    expect(exceedsPixels({ width: 8000, height: 5000 }, 40_000_000)).toBe(false);
  });
});

describe("作業用 canvas と縮小版", () => {
  it("ラスター画像は長辺 1024 に縮め、小さければそのまま。SVG は長辺を 1024 にする", () => {
    expect(workingSize(6000, 4000, false)).toEqual({ width: WORKING_SIZE, height: 683 });
    expect(workingSize(300, 200, false)).toEqual({ width: 300, height: 200 });
    expect(workingSize(24, 24, true)).toEqual({ width: WORKING_SIZE, height: WORKING_SIZE });
  });

  it("縮小版は半分ずつ、作業用 canvas から 1 列だけ（元画像の大きさに依らず数が抑えられる）", () => {
    const sizes = mipSizes(1024, 1024);
    expect(sizes.map((s) => s.width)).toEqual([1024, 512, 256, 128, 64, 32, 16, 8, 4]);
    // 合計のピクセル数は元の 4/3 未満
    const total = sizes.reduce((sum, s) => sum + s.width * s.height, 0);
    expect(total).toBeLessThan((1024 * 1024 * 4) / 3);
  });

  it("描く大きさ以上のうち最も小さい縮小版を選ぶ", () => {
    const levels = mipSizes(1024, 1024);
    expect(pickLevel(levels, 16, 16).width).toBe(16);
    expect(pickLevel(levels, 180, 180).width).toBe(256);
    expect(pickLevel(levels, 2000, 2000).width).toBe(1024);
  });
});

describe("設置先の検証", () => {
  it("/・./・../・http(s):// で始まる値だけ使える", () => {
    for (const ok of ["/", "/icons/", "./", "../a/", "https://example.com/", "HTTP://a"]) {
      expect(isValidBasePath(ok)).toBe(true);
    }
    for (const ng of ["", "example.com", "icons/", "javascript:alert(1)"]) {
      expect(isValidBasePath(ng)).toBe(false);
    }
  });
  it("使えない値はスニペットに入らない（/ になる）", () => {
    expect(normalizeBasePath("example.com")).toBe("/");
    const html = buildHeadSnippet(
      { ...DEFAULT_ICON_SETTINGS, basePath: "example.com" },
      { hasSvg: false },
    );
    expect(html).toContain('href="/favicon.ico"');
    expect(html).not.toContain("example.com");
  });
});

describe("loadIconSource のピクセル数上限", () => {
  const limits = { maxPixels: 40_000_000, maxFileBytes: 50 * 1024 * 1024 } as Limits;
  const decode = vi.fn(async () => {});
  let created = 0;

  class FakeImage {
    naturalWidth = 10_000;
    naturalHeight = 10_000;
    decoding = "";
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    decode = decode;
    constructor() {
      created++;
    }
    set src(value: string) {
      if (value) queueMicrotask(() => this.onload?.());
    }
  }

  beforeEach(() => {
    created = 0;
    decode.mockClear();
    vi.stubGlobal("Image", FakeImage);
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:fake");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("ヘッダーで上限超過が分かれば <img> を作らずに弾く", async () => {
    const file = new File([pngHeader(20_000, 20_000) as Uint8Array<ArrayBuffer>], "big.png", {
      type: "image/png",
    });
    await expect(loadIconSource(file, limits)).rejects.toMatchObject({ code: "tooLarge" });
    expect(created).toBe(0);
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it("ヘッダーで読めなくても、onload の寸法で decode() の前に弾く", async () => {
    const file = new File([new Uint8Array(64)], "unknown.png", { type: "image/png" });
    const error = await loadIconSource(file, limits).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(IconSourceError);
    expect((error as IconSourceError).code).toBe("tooLarge");
    expect(created).toBe(1);
    expect(decode).not.toHaveBeenCalled();
    // Blob URL はすぐ解放する
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:fake");
  });
});
