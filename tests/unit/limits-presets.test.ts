import { describe, expect, it } from "vitest";
import { needsRasterPreview } from "~/components/tools/preview";
import {
  checkFileSize,
  checkPixels,
  checkZipSize,
  detectDeviceClass,
  LIMITS,
  limitsFor,
  workerCount,
} from "~/lib/limits";
import {
  outputFileName,
  outputPath,
  reductionPercent,
  sanitizeFileName,
  sanitizePath,
} from "~/lib/pipeline/naming";
import {
  findPreset,
  PRESETS,
  pictureSnippet,
  responsiveFileName,
  srcsetSnippet,
} from "~/lib/pipeline/presets";

describe("端末の判定と上限", () => {
  it("deviceMemory があればそれで決める", () => {
    expect(detectDeviceClass({ deviceMemory: 8, userAgent: "iPhone" })).toBe("desktop");
    expect(detectDeviceClass({ deviceMemory: 4, userAgent: "Windows" })).toBe("mobile");
  });

  it("deviceMemory が無ければ UA で決める", () => {
    expect(detectDeviceClass({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)" })).toBe(
      "mobile",
    );
    expect(detectDeviceClass({ userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 7)" })).toBe(
      "mobile",
    );
    expect(detectDeviceClass({ userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" })).toBe(
      "desktop",
    );
    expect(detectDeviceClass({})).toBe("desktop");
  });

  it("PC とスマホで上限が違い、plan.md §5 の値になっている", () => {
    expect(LIMITS.desktop.maxPixels).toBe(100_000_000);
    expect(LIMITS.mobile.maxPixels).toBe(40_000_000);
    expect(LIMITS.desktop.maxFileBytes).toBe(200 * 1024 * 1024);
    expect(LIMITS.mobile.maxFileBytes).toBe(50 * 1024 * 1024);
    expect(LIMITS.desktop.maxZipEntries).toBe(5000);
    expect(LIMITS.mobile.maxZipEntries).toBe(1000);
    expect(limitsFor("mobile")).toBe(LIMITS.mobile);
  });

  it("超えたファイル・ピクセル数・ZIP を検出する", () => {
    const l = LIMITS.mobile;
    expect(checkFileSize(l.maxFileBytes, l)).toBeNull();
    expect(checkFileSize(l.maxFileBytes + 1, l)).toBe("file_too_large");
    expect(checkPixels(7000, 5000, l)).toBeNull();
    expect(checkPixels(8000, 6000, l)).toBe("too_many_pixels");
    expect(checkZipSize(l.maxZipBytes + 1, l)).toBe("zip_too_large");
  });

  it("Worker 数は hardwareConcurrency から決め、スマホでは最大 2", () => {
    expect(workerCount("mobile", 8)).toBe(2);
    expect(workerCount("mobile", 1)).toBe(1);
    expect(workerCount("desktop", 16)).toBe(LIMITS.desktop.maxWorkers);
    expect(workerCount("desktop", 2)).toBe(1);
    expect(workerCount("desktop", 1)).toBe(1);
  });
});

describe("ファイル名", () => {
  it("拡張子を付け替え、フォルダ構成を保つ", () => {
    expect(outputFileName("photo.PNG", "webp")).toBe("photo.webp");
    expect(outputFileName("photo", "jpeg")).toBe("photo.jpg");
    expect(outputFileName("photo.png", "webp", 640)).toBe("photo-640w.webp");
    expect(outputPath("photos/sub/a.png", "jpeg")).toBe("photos/sub/a.jpg");
    expect(outputPath("a.png", "png")).toBe("a.png");
  });

  it('ZIP・ドロップ由来のファイル名からも " < > などを除く（URL 入力と同じ規則）', () => {
    expect(sanitizeFileName('a"b<c>d|e?f*g.png')).toBe("a_b_c_d_e_f_g.png");
    expect(sanitizeFileName("..hidden")).toBe("hidden");
    expect(sanitizeFileName("")).toBe("image");
    expect(sanitizePath('photos/sub dir/a"b.png')).toBe("photos/sub dir/a_b.png");
  });

  it("削減率", () => {
    expect(reductionPercent(1000, 250)).toBe(75);
    expect(reductionPercent(1000, 1100)).toBe(-10);
    expect(reductionPercent(0, 10)).toBe(0);
  });
});

describe("プリセットとスニペット", () => {
  it("LP ヒーローは 1920 / WebP / 300KB 以下", () => {
    const hero = findPreset("lp-hero");
    expect(hero?.settings.output).toBe("webp");
    expect(hero?.settings.resize?.width).toBe(1920);
    expect(hero?.settings.sizeMode).toBe("target");
    expect(PRESETS.every((p) => p.settings.resize?.noEnlarge === true)).toBe(true);
    expect(hero?.settings.targetBytes).toBe(300 * 1024);
    expect(PRESETS.map((p) => p.id)).toContain("blog-thumb");
  });

  it("srcset スニペット（実ファイル名と実寸、属性のエスケープ）", () => {
    expect(responsiveFileName("hero.png", "webp", 640)).toBe("hero-640w.webp");
    const snippet = srcsetSnippet({
      format: "webp",
      variants: [
        { file: "my hero-1920w.webp", width: 1920, height: 1080 },
        { file: "my hero-640w.webp", width: 640, height: 360 },
        { file: "my hero-1280w.webp", width: 1280, height: 720 },
      ],
      sizes: "(max-width: 640px) 100vw, 1280px",
      alt: 'He said "hi" <b>',
    });
    expect(snippet).toContain(
      'srcset="my%20hero-640w.webp 640w, my%20hero-1280w.webp 1280w, my%20hero-1920w.webp 1920w"',
    );
    expect(snippet).toContain('src="my%20hero-1920w.webp"');
    expect(snippet).toContain('sizes="(max-width: 640px) 100vw, 1280px"');
    expect(snippet).toContain('width="1920"');
    expect(snippet).toContain('height="1080"');
    expect(snippet).toContain('alt="He said &quot;hi&quot; &lt;b&gt;"');
    expect(snippet).toContain('loading="lazy"');
  });

  it("ファイル名の \" ' < > & は属性に素のまま出ない", () => {
    const snippet = srcsetSnippet({
      format: "webp",
      variants: [{ file: `a"b'c<d>e&f-640w.webp`, width: 640, height: null }],
    });
    const src = /src="([^"]*)"/.exec(snippet)?.[1] ?? "";
    expect(src).not.toMatch(/['<>]/);
    expect(src).toContain("%22");
    expect(src).toContain("&#39;");
    expect(src).toContain("&amp;");
    expect(snippet).not.toContain("height=");
  });

  it("<picture> スニペットは書き出した形式の source と、実際に書き出した最大幅の img を持つ", () => {
    const snippet = pictureSnippet({
      format: "webp",
      variants: [
        { file: "hero-640w.webp", width: 640, height: 360 },
        { file: "hero-1280w.webp", width: 1280, height: 720 },
      ],
    });
    expect(snippet.startsWith("<picture>")).toBe(true);
    expect(snippet).toContain(
      '<source type="image/webp" srcset="hero-640w.webp 640w, hero-1280w.webp 1280w" sizes="100vw">',
    );
    expect(snippet).toContain('<img src="hero-1280w.webp" width="1280" height="720"');
    expect(snippet).not.toContain(".jpg");
    expect(snippet.trim().endsWith("</picture>")).toBe(true);
  });
});

describe("プレビューの方針（SVG の blob: URL を DOM に出さない）", () => {
  it("SVG だけラスタライズが要る", () => {
    expect(needsRasterPreview("svg")).toBe(true);
    expect(needsRasterPreview(null, "image/svg+xml")).toBe(true);
    expect(needsRasterPreview("png")).toBe(false);
    expect(needsRasterPreview(null, "image/png")).toBe(false);
  });
});
