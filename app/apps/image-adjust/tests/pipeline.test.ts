import { beforeAll, describe, expect, it } from "vitest";
import { readDimensions } from "~/apps/image-adjust/lib/codecs/dimensions";
import {
  detectFormat,
  detectFormatWithHints,
  type RasterFormat,
} from "~/apps/image-adjust/lib/codecs/format";
import { readGifInfo } from "~/apps/image-adjust/lib/codecs/gif-info";
import {
  embedIcc,
  extractIcc,
  hasExif,
  isAnimatedWebp,
} from "~/apps/image-adjust/lib/codecs/metadata";
import {
  decodeRaster,
  flattenOnColor,
  hasTransparency,
  parseHexColor,
} from "~/apps/image-adjust/lib/codecs/raster";
import { optimizeSvg } from "~/apps/image-adjust/lib/codecs/svg";
import {
  pngColorsForLevel,
  processImage,
  resolveResize,
} from "~/apps/image-adjust/lib/pipeline/process";
import { searchTargetSize } from "~/apps/image-adjust/lib/pipeline/target-size";
import { DEFAULT_SETTINGS, type ProcessSettings } from "~/apps/image-adjust/lib/pipeline/types";
import { initCodecsForNode, makeImage, readFixture } from "./helpers/codecs-node";

beforeAll(async () => {
  await initCodecsForNode();
}, 60_000);

const FIXTURE: Record<RasterFormat, string> = {
  png: "sample.png",
  jpeg: "sample.jpg",
  webp: "sample.webp",
};

function input(name: string, bytes = readFixture(name)) {
  return { id: name, name, path: name, bytes };
}

function settings(patch: Partial<ProcessSettings> = {}): ProcessSettings {
  return { ...DEFAULT_SETTINGS, ...patch };
}

describe("形式の判定", () => {
  it("マジックナンバーで PNG / JPEG / WebP / GIF / SVG を判定する", () => {
    expect(detectFormat(readFixture("sample.png"))).toBe("png");
    expect(detectFormat(readFixture("sample.jpg"))).toBe("jpeg");
    expect(detectFormat(readFixture("sample.webp"))).toBe("webp");
    expect(detectFormat(readFixture("animated.gif"))).toBe("gif");
    expect(detectFormat(readFixture("sample.svg"))).toBe("svg");
    expect(detectFormat(new TextEncoder().encode("hello"))).toBeNull();
  });

  it("拡張子は SVG の補助にだけ使う", () => {
    const text = new TextEncoder().encode("<?xml version='1.0'?><!DOCTYPE x>");
    expect(detectFormatWithHints(text, { name: "a.svg" })).toBe("svg");
    expect(detectFormatWithHints(text, { name: "a.png" })).toBeNull();
  });

  it("ヘッダーから幅・高さを読む", () => {
    expect(readDimensions("png", readFixture("sample.png"))).toEqual({ width: 160, height: 120 });
    expect(readDimensions("jpeg", readFixture("sample.jpg"))).toEqual({ width: 160, height: 120 });
    expect(readDimensions("webp", readFixture("sample.webp"))).toEqual({ width: 160, height: 120 });
    expect(readDimensions("gif", readFixture("animated.gif"))).toEqual({ width: 48, height: 32 });
  });
});

describe("相互変換（PNG / JPEG / WebP）", () => {
  const formats: RasterFormat[] = ["png", "jpeg", "webp"];
  for (const from of formats) {
    for (const to of formats) {
      if (from === to) continue;
      it(`${from} → ${to}`, async () => {
        const result = await processImage(input(FIXTURE[from]), settings({ output: to }));
        expect(result.inputFormat).toBe(from);
        expect(result.outputs).toHaveLength(1);
        const out = result.outputs[0];
        expect(out?.format).toBe(to);
        expect(out?.name).toBe(`sample.${to === "jpeg" ? "jpg" : to}`);
        expect(detectFormat(out?.bytes ?? new ArrayBuffer(0))).toBe(to);
        const decoded = await decodeRaster(to, out?.bytes ?? new ArrayBuffer(0));
        expect(decoded.width).toBe(160);
        expect(decoded.height).toBe(120);
        // JPEG は透過を持てないので不透明になっている
        if (to === "jpeg") expect(hasTransparency(decoded)).toBe(false);
      }, 30_000);
    }
  }

  it("透過 PNG → JPEG は背景色で塗られる", async () => {
    const result = await processImage(
      input("sample.png"),
      settings({ output: "jpeg", jpegBackground: "#ff0000", quality: 95 }),
    );
    const decoded = await decodeRaster("jpeg", result.outputs[0]?.bytes ?? new ArrayBuffer(0));
    // 左上は元が半透明（alpha 96）の緑っぽい色なので、赤い背景が混ざって R が高い
    const r = decoded.data[0] ?? 0;
    expect(r).toBeGreaterThan(100);
  });

  it("stripMetadata がオフでも再エンコードで落ちることを警告する", async () => {
    const result = await processImage(
      input("sample.jpg"),
      settings({ output: "webp", stripMetadata: false }),
    );
    expect(result.warnings).toContain("metadata_dropped");
  });
});

describe("圧縮", () => {
  it("目標サイズ指定で上限以下になる（JPEG）", async () => {
    const original = readFixture("sample.jpg");
    const target = Math.floor(original.byteLength / 3);
    const result = await processImage(
      input("sample.jpg", original),
      settings({ output: "same", sizeMode: "target", targetBytes: target }),
    );
    const out = result.outputs[0];
    expect(out?.bytes.byteLength).toBeLessThanOrEqual(target);
    expect(result.warnings).not.toContain("target_unreachable");
    expect(out?.quality).toBeGreaterThanOrEqual(5);
  }, 30_000);

  it("目標サイズ指定で上限以下になる（WebP）", async () => {
    const result = await processImage(
      input("sample.png"),
      settings({ output: "webp", sizeMode: "target", targetBytes: 3000 }),
    );
    expect(result.outputs[0]?.bytes.byteLength).toBeLessThanOrEqual(3000);
  }, 30_000);

  it("届かない目標は最小品質の結果と target_unreachable を返す", async () => {
    const result = await processImage(
      input("sample.jpg"),
      settings({ output: "same", sizeMode: "target", targetBytes: 10 }),
    );
    expect(result.warnings).toContain("target_unreachable");
    expect(result.outputs[0]?.quality).toBe(5);
  }, 30_000);

  it("PNG の減色で小さくなる", async () => {
    const original = readFixture("sample.png");
    const result = await processImage(
      input("sample.png", original),
      settings({ output: "same", pngLossless: false, quality: 50 }),
    );
    expect(result.outputs[0]?.bytes.byteLength).toBeLessThan(original.byteLength);
    expect(detectFormat(result.outputs[0]?.bytes ?? new ArrayBuffer(0))).toBe("png");
  }, 30_000);

  it("リサイズ（px / % / アスペクト維持）", async () => {
    expect(
      resolveResize(1600, 1200, {
        mode: "none",
        width: null,
        height: null,
        percent: 50,
        keepAspect: true,
        noEnlarge: false,
      }),
    ).toEqual({ width: 1600, height: 1200 });
    expect(
      resolveResize(1600, 1200, {
        mode: "percent",
        width: null,
        height: null,
        percent: 50,
        keepAspect: true,
        noEnlarge: false,
      }),
    ).toEqual({ width: 800, height: 600 });
    expect(
      resolveResize(1600, 1200, {
        mode: "px",
        width: 800,
        height: null,
        percent: 50,
        keepAspect: true,
        noEnlarge: false,
      }),
    ).toEqual({ width: 800, height: 600 });
    expect(
      resolveResize(1600, 1200, {
        mode: "px",
        width: null,
        height: 300,
        percent: 50,
        keepAspect: true,
        noEnlarge: false,
      }),
    ).toEqual({ width: 400, height: 300 });
    expect(
      resolveResize(1600, 1200, {
        mode: "px",
        width: 800,
        height: 800,
        percent: 50,
        keepAspect: true,
        noEnlarge: false,
      }),
    ).toEqual({ width: 800, height: 600 });
    expect(
      resolveResize(1600, 1200, {
        mode: "px",
        width: 800,
        height: 800,
        percent: 50,
        keepAspect: false,
        noEnlarge: false,
      }),
    ).toEqual({ width: 800, height: 800 });

    const result = await processImage(
      input("sample.png"),
      settings({
        output: "webp",
        resize: {
          mode: "px",
          width: 80,
          height: null,
          percent: 100,
          keepAspect: true,
          noEnlarge: false,
        },
      }),
    );
    expect(result.outputs[0]?.width).toBe(80);
    expect(result.outputs[0]?.height).toBe(60);
    const decoded = await decodeRaster("webp", result.outputs[0]?.bytes ?? new ArrayBuffer(0));
    expect([decoded.width, decoded.height]).toEqual([80, 60]);
  }, 30_000);

  it("レスポンシブ幅は元より小さい幅だけ書き出す", async () => {
    const result = await processImage(
      input("sample.png"),
      settings({ output: "webp", responsiveWidths: [40, 80, 1920] }),
    );
    // 1920 は元（160）より広いので、代わりに元の幅の版が入る
    expect(result.outputs.map((o) => o.variantWidth)).toEqual([40, 80, 160]);
    expect(result.outputs.map((o) => o.name)).toEqual([
      "sample-40w.webp",
      "sample-80w.webp",
      "sample-160w.webp",
    ]);
  }, 30_000);

  it("ピクセル数の上限を超えると too_many_pixels", async () => {
    await expect(
      processImage(input("sample.png"), settings(), { maxPixels: 100 }),
    ).rejects.toMatchObject({ code: "too_many_pixels" });
  });

  it("対応していない形式は unsupported", async () => {
    await expect(
      processImage(
        input("x.bin", new TextEncoder().encode("nope").buffer as ArrayBuffer),
        settings(),
      ),
    ).rejects.toMatchObject({ code: "unsupported" });
  });
});

describe("SVG", () => {
  it("SVGO でメタデータ・コメントが消え、小さくなる", async () => {
    const original = readFixture("sample.svg");
    const result = await processImage(input("sample.svg", original), settings({ output: "webp" }));
    const out = result.outputs[0];
    expect(out?.format).toBe("svg");
    expect(out?.bytes.byteLength).toBeLessThan(original.byteLength);
    const text = new TextDecoder().decode(out?.bytes);
    expect(text).not.toContain("<!--");
    expect(text).not.toContain("<metadata");
    expect(text).not.toContain("inkscape");
    expect(text).toContain("viewBox");
    expect(result.warnings).toContain("svg_kept");
  });

  it("3 段階で出力サイズが単調に小さくなるか同じ", async () => {
    const src = new TextDecoder().decode(readFixture("sample.svg"));
    const safe = await optimizeSvg(src, "safe");
    const standard = await optimizeSvg(src, "standard");
    const aggressive = await optimizeSvg(src, "aggressive");
    expect(safe.length).toBeLessThan(src.length);
    expect(standard.length).toBeLessThanOrEqual(safe.length);
    expect(aggressive.length).toBeLessThanOrEqual(standard.length);
    // 安全モードでは id を残す
    expect(safe).toContain('id="g1"');
  });
});

describe("GIF の情報", () => {
  it("フレーム数とサイズを読む", () => {
    expect(readGifInfo(readFixture("animated.gif"))).toEqual({
      width: 48,
      height: 32,
      frames: 4,
      animated: true,
    });
  });
});

describe("目標サイズの二分探索", () => {
  it("目標以下で最も高いレベルを選ぶ", async () => {
    const calls: number[] = [];
    const encodeAt = async (level: number) => {
      calls.push(level);
      return new ArrayBuffer(level * 10);
    };
    const r = await searchTargetSize(encodeAt, 555, { min: 1, max: 100 });
    expect(r.level).toBe(55);
    expect(r.reached).toBe(true);
    expect(calls.length).toBeLessThanOrEqual(8);
  });

  it("届かなければ最小レベルを返す", async () => {
    const r = await searchTargetSize(async (level) => new ArrayBuffer(1000 + level), 10, {
      min: 5,
      max: 100,
    });
    expect(r.level).toBe(5);
    expect(r.reached).toBe(false);
  });

  it("PNG の色数対応", () => {
    expect(pngColorsForLevel(100)).toBe(256);
    expect(pngColorsForLevel(1)).toBe(2);
    expect(pngColorsForLevel(50)).toBeGreaterThan(2);
    expect(pngColorsForLevel(50)).toBeLessThan(256);
  });
});

describe("ピクセル操作", () => {
  it("色の解釈と背景の塗りつぶし", () => {
    expect(parseHexColor("#fff")).toEqual([255, 255, 255]);
    expect(parseHexColor("#102030")).toEqual([16, 32, 48]);
    expect(parseHexColor("zzz")).toEqual([255, 255, 255]);
    const img = makeImage(4, 4, true);
    expect(hasTransparency(img)).toBe(true);
    const flat = flattenOnColor(img, "#000000");
    expect(hasTransparency(flat)).toBe(false);
    expect(flat.width).toBe(4);
  });
});

const DUMMY_ICC = Uint8Array.from({ length: 600 }, (_, i) => (i * 31 + 7) & 0xff);

describe("メタデータと ICC（レビュー指摘 1・3・11・16）", () => {
  it("EXIF の向き（Orientation=6）を反映して幅と高さが入れ替わる", async () => {
    const result = await processImage(input("exif.jpg"), settings({ output: "webp" }));
    expect(result.outputs[0]?.width).toBe(120);
    expect(result.outputs[0]?.height).toBe(160);
    const decoded = await decodeRaster("webp", result.outputs[0]?.bytes ?? new ArrayBuffer(0));
    expect([decoded.width, decoded.height]).toEqual([120, 160]);
  }, 30_000);

  it("元のまま返る経路（kept_original）でも EXIF が無く、ICC は残る", async () => {
    // 品質 100 の再エンコードは元（品質 92）より大きいので、元のまま返る
    const result = await processImage(
      input("exif.jpg"),
      settings({ output: "same", quality: 100, stripMetadata: true }),
    );
    expect(result.warnings).toContain("kept_original");
    const bytes = result.outputs[0]?.bytes ?? new ArrayBuffer(0);
    expect(hasExif("jpeg", bytes)).toBe(false);
    expect(extractIcc("jpeg", bytes)).toEqual(DUMMY_ICC);
    expect(bytes.byteLength).toBeLessThan(readFixture("exif.jpg").byteLength);
  }, 30_000);

  it("stripMetadata がオフなら元のまま返る経路では EXIF が残る", async () => {
    const result = await processImage(
      input("exif.jpg"),
      settings({ output: "same", quality: 100, stripMetadata: false }),
    );
    expect(result.warnings).toContain("kept_original");
    expect(hasExif("jpeg", result.outputs[0]?.bytes ?? new ArrayBuffer(0))).toBe(true);
  }, 30_000);

  it("ICC は出力形式に合わせて埋め込み直される（JPEG → PNG / WebP / JPEG）", async () => {
    for (const to of ["png", "webp", "jpeg"] as const) {
      const result = await processImage(input("exif.jpg"), settings({ output: to, quality: 50 }));
      expect(result.warnings).not.toContain("kept_original");
      const bytes = result.outputs[0]?.bytes ?? new ArrayBuffer(0);
      expect(detectFormat(bytes)).toBe(to);
      expect(extractIcc(to, bytes)).toEqual(DUMMY_ICC);
      expect(hasExif(to, bytes)).toBe(false);
      const decoded = await decodeRaster(to, bytes);
      expect([decoded.width, decoded.height]).toEqual([120, 160]);
    }
  }, 60_000);

  it("アニメーション WebP は警告を出して元のまま返す", async () => {
    const animated = new Uint8Array(embedIcc("webp", readFixture("sample.webp"), DUMMY_ICC));
    animated[20] = (animated[20] ?? 0) | 0x02; // VP8X の ANIM
    const result = await processImage(
      input("anim.webp", animated.buffer as ArrayBuffer),
      settings({ output: "png" }),
    );
    expect(result.warnings).toContain("animated_webp");
    expect(result.outputs[0]?.format).toBe("webp");
    expect(isAnimatedWebp(result.outputs[0]?.bytes ?? new ArrayBuffer(0))).toBe(true);
    expect(extractIcc("webp", result.outputs[0]?.bytes ?? new ArrayBuffer(0))).toEqual(DUMMY_ICC);
  });
});

describe("リサイズの上限とレスポンシブ（レビュー指摘 5・12・15）", () => {
  const px = (
    width: number | null,
    height: number | null,
    noEnlarge: boolean,
    keepAspect = true,
  ) => ({ mode: "px" as const, width, height, percent: 100, keepAspect, noEnlarge });

  it("noEnlarge なら元より大きくしない", () => {
    expect(resolveResize(100, 50, px(200, null, true))).toEqual({ width: 100, height: 50 });
    expect(resolveResize(100, 50, px(200, null, false))).toEqual({ width: 200, height: 100 });
    expect(resolveResize(100, 50, px(null, 200, true))).toEqual({ width: 100, height: 50 });
    expect(resolveResize(100, 50, px(300, 80, true, false))).toEqual({ width: 100, height: 50 });
    expect(resolveResize(100, 50, px(60, 60, true))).toEqual({ width: 60, height: 30 });
    expect(
      resolveResize(100, 50, {
        mode: "percent",
        width: null,
        height: null,
        percent: 50,
        keepAspect: true,
        noEnlarge: true,
      }),
    ).toEqual({ width: 50, height: 25 });
  });

  it("リサイズ後のピクセル数が上限を超えたら too_many_pixels", async () => {
    await expect(
      processImage(input("sample.png"), settings({ resize: px(1000, null, false) }), {
        maxPixels: 100_000,
      }),
    ).rejects.toMatchObject({ code: "too_many_pixels" });
    // 元のサイズなら通る
    const ok = await processImage(input("sample.png"), settings(), { maxPixels: 100_000 });
    expect(ok.outputs).toHaveLength(1);
  }, 30_000);

  it("元の幅が最大の指定幅より狭いときは、元の幅の版も出す", async () => {
    const result = await processImage(
      input("sample.png"),
      settings({ output: "webp", responsiveWidths: [80, 1920] }),
    );
    expect(result.outputs.map((o) => o.variantWidth)).toEqual([80, 160]);
    expect(result.outputs.map((o) => o.name)).toEqual(["sample-80w.webp", "sample-160w.webp"]);
  }, 30_000);

  it("warnings は重複しない", async () => {
    const result = await processImage(
      input("sample.png"),
      settings({ output: "webp", responsiveWidths: [40, 80], sizeMode: "target", targetBytes: 10 }),
    );
    expect(result.warnings.filter((w) => w === "target_unreachable")).toHaveLength(1);
  }, 30_000);

  it("PNG 出力では品質が色数に対応づけられ、低い品質ほど小さい", async () => {
    const low = await processImage(input("sample.png"), settings({ output: "same", quality: 10 }));
    const high = await processImage(input("sample.png"), settings({ output: "same", quality: 90 }));
    expect(low.outputs[0]?.quality).toBe(10);
    expect(high.outputs[0]?.quality).toBe(90);
    expect(low.outputs[0]?.bytes.byteLength).toBeLessThan(high.outputs[0]?.bytes.byteLength ?? 0);
  }, 30_000);
});
