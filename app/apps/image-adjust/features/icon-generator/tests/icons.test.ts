// @vitest-environment happy-dom
import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import {
  FAVICON_SVG_ID_PREFIX,
  isSvgFile,
  svgIntrinsicSize,
  utf8ToBase64,
  withIntrinsicSize,
  wrapFaviconSvg,
} from "../adapters/svg";
import { buildIconZip } from "../adapters/zip";
import { encodeIco, ICO_ENTRY_SIZE, ICO_HEADER_SIZE, readPngSize } from "../core/ico";
import {
  fitContain,
  iconContentRect,
  MASKABLE_SAFE_ZONE_DIAMETER,
  maskableContentRect,
  ogIconRect,
} from "../core/layout";
import { buildWebManifest, FALLBACK_APP_NAME, serializeWebManifest } from "../core/manifest";
import {
  DEFAULT_ICON_SETTINGS,
  type IconSettings,
  normalizeBasePath,
  sanitizeIconSettings,
} from "../core/settings";
import { buildHeadSnippet, escapeHtmlAttr, isAbsoluteUrl } from "../core/snippet";
import { OG_SPEC } from "../core/specs";

/** IHDR までを持つ最小限の PNG 風バイト列（ICO のテストでは中身は読まない） */
function fakePng(width: number, height: number, extra = 10): Uint8Array {
  const bytes = new Uint8Array(33 + extra);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  const view = new DataView(bytes.buffer);
  view.setUint32(8, 13);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12); // "IHDR"
  view.setUint32(16, width);
  view.setUint32(20, height);
  for (let i = 33; i < bytes.length; i++) bytes[i] = i & 0xff;
  return bytes;
}

const settings = (patch: Partial<IconSettings> = {}): IconSettings => ({
  ...DEFAULT_ICON_SETTINGS,
  ...patch,
});

describe("readPngSize", () => {
  it("IHDR から幅・高さを読む", () => {
    expect(readPngSize(fakePng(48, 32))).toEqual({ width: 48, height: 32 });
  });
  it("PNG でなければ null", () => {
    expect(readPngSize(new Uint8Array(40))).toBeNull();
    expect(readPngSize(fakePng(1, 1).slice(0, 10))).toBeNull();
  });
});

describe("encodeIco", () => {
  const pngs = [fakePng(16, 16, 5), fakePng(32, 32, 20), fakePng(48, 48, 7)];
  const ico = encodeIco(pngs);
  const view = new DataView(ico.buffer, ico.byteOffset, ico.byteLength);

  it("ICONDIR：reserved=0・type=1・枚数", () => {
    expect(view.getUint16(0, true)).toBe(0);
    expect(view.getUint16(2, true)).toBe(1);
    expect(view.getUint16(4, true)).toBe(3);
  });

  it("各エントリのサイズ・色数・プレーン・ビット数・データ長・オフセット", () => {
    let expectedOffset = ICO_HEADER_SIZE + ICO_ENTRY_SIZE * pngs.length;
    pngs.forEach((png, i) => {
      const e = ICO_HEADER_SIZE + ICO_ENTRY_SIZE * i;
      const size = [16, 32, 48][i];
      expect(view.getUint8(e)).toBe(size);
      expect(view.getUint8(e + 1)).toBe(size);
      expect(view.getUint8(e + 2)).toBe(0);
      expect(view.getUint8(e + 3)).toBe(0);
      expect(view.getUint16(e + 4, true)).toBe(1);
      expect(view.getUint16(e + 6, true)).toBe(32);
      expect(view.getUint32(e + 8, true)).toBe(png.length);
      expect(view.getUint32(e + 12, true)).toBe(expectedOffset);
      // オフセットの位置に PNG がそのまま入っている
      expect(ico.slice(expectedOffset, expectedOffset + png.length)).toEqual(png);
      expectedOffset += png.length;
    });
    expect(ico.length).toBe(expectedOffset);
  });

  it("256px は 0 として書く", () => {
    const big = encodeIco([fakePng(256, 256)]);
    expect(big[6]).toBe(0);
    expect(big[7]).toBe(0);
  });

  it("空・PNG 以外・範囲外のサイズは拒否する", () => {
    expect(() => encodeIco([])).toThrow();
    expect(() => encodeIco([new Uint8Array(40)])).toThrow();
    expect(() => encodeIco([fakePng(257, 257)])).toThrow();
  });
});

describe("配置の計算", () => {
  it("fitContain は縦横比を保って中央に置く", () => {
    expect(fitContain(200, 100, { x: 0, y: 0, width: 100, height: 100 })).toEqual({
      x: 0,
      y: 25,
      width: 100,
      height: 50,
    });
  });

  it("余白は一辺に対する割合", () => {
    expect(iconContentRect(100, 0.1, 50, 50)).toEqual({ x: 10, y: 10, width: 80, height: 80 });
  });

  it("maskable：余白 0 の正方形はセーフゾーンの円に内接するまで縮める", () => {
    const r = maskableContentRect(512, 0, 100, 100);
    const halfDiagonal = Math.hypot(r.width, r.height) / 2;
    expect(halfDiagonal).toBeCloseTo((512 * MASKABLE_SAFE_ZONE_DIAMETER) / 2, 6);
    expect(r.width).toBeCloseTo((512 * 0.8) / Math.SQRT2, 6);
    // 中央に置く
    expect(r.x + r.width / 2).toBeCloseTo(256, 6);
    expect(r.y + r.height / 2).toBeCloseTo(256, 6);
  });

  it("maskable：横長でも外接矩形がセーフゾーンに入る", () => {
    const r = maskableContentRect(512, 0, 300, 100);
    expect(Math.hypot(r.width, r.height) / 2).toBeLessThanOrEqual(512 * 0.4 + 1e-9);
    expect(r.width / r.height).toBeCloseTo(3, 6);
  });

  it("maskable：余白が十分なら通常と同じ大きさ（拡大しない）", () => {
    const normal = iconContentRect(512, 0.25, 100, 100);
    expect(maskableContentRect(512, 0.25, 100, 100)).toEqual(normal);
  });

  it("OGP のアイコンは中央に置く", () => {
    const r = ogIconRect(OG_SPEC);
    expect(r.width).toBe(r.height);
    expect(r.x * 2 + r.width).toBe(OG_SPEC.width);
    expect(r.y * 2 + r.height).toBe(OG_SPEC.height);
  });
});

describe("site.webmanifest", () => {
  it("名前・短い名前・テーマ色・背景色・アイコンが入る", () => {
    const m = buildWebManifest(
      settings({
        name: " My App ",
        shortName: "App",
        themeColor: "#112233",
        backgroundColor: "#ABCDEF",
      }),
    );
    expect(m).toEqual({
      name: "My App",
      short_name: "App",
      icons: [
        { src: "icon-192.png", sizes: "192x192", type: "image/png" },
        { src: "icon-512.png", sizes: "512x512", type: "image/png" },
        { src: "icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
      theme_color: "#112233",
      background_color: "#abcdef",
      display: "standalone",
    });
  });

  it("名前が空なら既定名、短い名前が空なら名前を使う。色が不正なら既定値", () => {
    const m = buildWebManifest(settings({ name: "", shortName: "", themeColor: "red" }));
    expect(m.name).toBe(FALLBACK_APP_NAME);
    expect(m.short_name).toBe(FALLBACK_APP_NAME);
    expect(m.theme_color).toBe(DEFAULT_ICON_SETTINGS.themeColor);
    expect(buildWebManifest(settings({ name: "Foo" })).short_name).toBe("Foo");
  });

  it("JSON として読める", () => {
    const text = serializeWebManifest(settings({ name: '"quoted" <name>' }));
    expect(JSON.parse(text).name).toBe('"quoted" <name>');
  });
});

describe("HTML スニペット", () => {
  it("既定（SVG なし・OGP なし）", () => {
    expect(buildHeadSnippet(settings({ themeColor: "#000000" }), { hasSvg: false })).toBe(
      [
        '<link rel="icon" href="/favicon.ico" sizes="48x48">',
        '<link rel="icon" href="/favicon-32x32.png" sizes="32x32" type="image/png">',
        '<link rel="icon" href="/favicon-16x16.png" sizes="16x16" type="image/png">',
        '<link rel="apple-touch-icon" href="/apple-touch-icon.png">',
        '<link rel="manifest" href="/site.webmanifest">',
        '<meta name="theme-color" content="#000000">',
        "",
      ].join("\n"),
    );
  });

  it("SVG・OGP・設置先", () => {
    const html = buildHeadSnippet(
      settings({ includeOg: true, basePath: "https://example.com/assets" }),
      { hasSvg: true },
    );
    expect(html).toContain(
      '<link rel="icon" href="https://example.com/assets/favicon.svg" type="image/svg+xml">',
    );
    expect(html).toContain(
      '<meta property="og:image" content="https://example.com/assets/og-image.png">',
    );
    expect(html).toContain('<meta property="og:image:width" content="1200">');
  });

  it("設置先の値はエスケープする", () => {
    const html = buildHeadSnippet(settings({ basePath: '/a"><script>' }), { hasSvg: false });
    expect(html).not.toContain("<script>");
    expect(html).toContain('href="/a&quot;&gt;&lt;script&gt;/favicon.ico"');
  });

  it("補助関数", () => {
    expect(escapeHtmlAttr(`&"<>`)).toBe("&amp;&quot;&lt;&gt;");
    expect(isAbsoluteUrl("https://example.com/")).toBe(true);
    expect(isAbsoluteUrl("/icons/")).toBe(false);
    expect(normalizeBasePath("")).toBe("/");
    expect(normalizeBasePath("/icons")).toBe("/icons/");
  });
});

describe("設定の正規化", () => {
  it("範囲外の値を丸める", () => {
    const s = sanitizeIconSettings(
      settings({ padding: 2, radius: -1, background: "nope", themeColor: "#FFF" }),
    );
    expect(s.padding).toBe(0.4);
    expect(s.radius).toBe(0);
    expect(s.background).toBe("#ffffff");
    expect(s.themeColor).toBe(DEFAULT_ICON_SETTINGS.themeColor);
    expect(sanitizeIconSettings(settings({ background: null })).background).toBeNull();
  });
});

describe("SVG", () => {
  it("SVG のファイルを判定する", () => {
    expect(isSvgFile({ name: "logo.svg", type: "" })).toBe(true);
    expect(isSvgFile({ name: "logo", type: "image/svg+xml" })).toBe(true);
    expect(isSvgFile({ name: "logo.png", type: "image/png" })).toBe(false);
  });

  it("width / height / viewBox から縦横比の元を得る", () => {
    expect(svgIntrinsicSize('<svg width="64" height="32px"></svg>')).toEqual({
      width: 64,
      height: 32,
    });
    expect(svgIntrinsicSize('<?xml?><svg viewBox="0 0 200 100"></svg>')).toEqual({
      width: 200,
      height: 100,
    });
    expect(svgIntrinsicSize("<svg width='100%' viewBox='0,0,30,60'></svg>")).toEqual({
      width: 30,
      height: 60,
    });
    expect(svgIntrinsicSize('<svg width="50" viewBox="0 0 200 100"></svg>')).toEqual({
      width: 50,
      height: 25,
    });
    expect(svgIntrinsicSize("<svg></svg>")).toBeNull();
    expect(svgIntrinsicSize("not svg")).toBeNull();
  });
});

describe("wrapFaviconSvg", () => {
  const src =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100"><circle id="a" r="5"/></svg>';
  const size = { width: 200, height: 100 };
  const parse = (text: string) => new DOMParser().parseFromString(text, "image/svg+xml");
  const noError = (doc: Document) => expect(doc.getElementsByTagName("parsererror").length).toBe(0);
  const imageOf = (doc: Document) => doc.getElementsByTagName("image")[0] as Element;
  const decode = (image: Element): string => {
    const href = image.getAttribute("href") ?? "";
    expect(href.startsWith("data:image/svg+xml;base64,")).toBe(true);
    const bin = atob(href.slice(href.indexOf(",") + 1));
    return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
  };

  it("余白なし・背景なし・角丸なし：背景 rect も clipPath も無く、元の SVG を全面に置く", () => {
    const out = wrapFaviconSvg(src, { padding: 0, background: null, radius: 0 }, size);
    const doc = parse(out);
    noError(doc);
    expect(doc.documentElement.getAttribute("viewBox")).toBe("0 0 512 512");
    expect(doc.getElementsByTagName("clipPath").length).toBe(0);
    expect(doc.getElementsByTagName("rect").length).toBe(0);
    const image = imageOf(doc);
    // 200x100 を 512 角に収める：幅 512・高さ 256・縦は中央
    expect(image.getAttribute("x")).toBe("0");
    expect(image.getAttribute("y")).toBe("128");
    expect(image.getAttribute("width")).toBe("512");
    expect(image.getAttribute("height")).toBe("256");
    expect(image.getAttribute("preserveAspectRatio")).toBe("xMidYMid meet");
    // 元の SVG は data URL の中（px の width / height が付く）
    expect(decode(image)).toContain('viewBox="0 0 200 100"');
    expect(decode(image)).toContain('width="200"');
  });

  it("余白：余白の分だけ縮めて中央に置く", () => {
    const doc = parse(wrapFaviconSvg(src, { padding: 0.25, background: null, radius: 0 }, size));
    noError(doc);
    const image = imageOf(doc);
    expect(image.getAttribute("width")).toBe("256");
    expect(image.getAttribute("height")).toBe("128");
    expect(image.getAttribute("x")).toBe("128");
    expect(image.getAttribute("y")).toBe("192");
  });

  it("背景色：rect を置く（透過なら置かない）", () => {
    const doc = parse(wrapFaviconSvg(src, { padding: 0, background: "#336699", radius: 0 }, size));
    noError(doc);
    const rect = doc.getElementsByTagName("rect")[0] as Element;
    expect(rect.getAttribute("fill")).toBe("#336699");
    expect(rect.getAttribute("width")).toBe("512");
    expect(rect.hasAttribute("rx")).toBe(false);
  });

  it("角丸：背景 rect の rx / ry と clipPath の両方に反映し、id に接頭辞を付ける", () => {
    const doc = parse(
      wrapFaviconSvg(src, { padding: 0, background: "#ffffff", radius: 0.25 }, size),
    );
    noError(doc);
    const rects = Array.from(doc.getElementsByTagName("rect"));
    expect(rects).toHaveLength(2);
    for (const r of rects) {
      expect(r.getAttribute("rx")).toBe("128");
      expect(r.getAttribute("ry")).toBe("128");
    }
    const clip = doc.getElementsByTagName("clipPath")[0] as Element;
    expect(clip.getAttribute("id")?.startsWith(FAVICON_SVG_ID_PREFIX)).toBe(true);
    const g = doc.getElementsByTagName("g")[0] as Element;
    expect(g.getAttribute("clip-path")).toBe(`url(#${clip.getAttribute("id")})`);
  });

  it("角丸だけ（背景なし）でも clipPath で切り抜く", () => {
    const doc = parse(wrapFaviconSvg(src, { padding: 0, background: null, radius: 0.5 }, size));
    noError(doc);
    expect(doc.getElementsByTagName("clipPath").length).toBe(1);
    expect(doc.getElementsByTagName("rect")).toHaveLength(1);
  });

  it("viewBox が無く width が 100% の SVG：配置は渡した size から計算する", () => {
    const doc = parse(
      wrapFaviconSvg(
        '<svg xmlns="http://www.w3.org/2000/svg" width="100%"><circle r="5"/></svg>',
        { padding: 0.1, background: null, radius: 0 },
        { width: 512, height: 512 },
      ),
    );
    noError(doc);
    const image = imageOf(doc);
    expect(image.getAttribute("x")).toBe("51.2");
    expect(image.getAttribute("y")).toBe("51.2");
    expect(image.getAttribute("width")).toBe("409.6");
    expect(image.getAttribute("height")).toBe("409.6");
    // 埋め込む側には px の大きさが付く
    expect(decode(image)).toContain('width="512" height="512"');
  });

  it("元の SVG の <style> は外側の文書に出ない（data URL の中だけ）", () => {
    const style = "<style>rect{fill:#000}svg{width:100%}</style>";
    const original = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">${style}<rect width="5" height="5"/></svg>`;
    const out = wrapFaviconSvg(
      original,
      { padding: 0, background: "#ffffff", radius: 0.2 },
      {
        width: 10,
        height: 10,
      },
    );
    const doc = parse(out);
    noError(doc);
    expect(doc.getElementsByTagName("style").length).toBe(0);
    expect(out).not.toContain("<style");
    expect(decode(imageOf(doc))).toContain(style);
  });

  it("日本語・絵文字を含む SVG を base64 から戻すと元と一致する", () => {
    const original =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" width="10" height="10"><title>日本語😀</title><text>あ</text></svg>';
    expect(utf8ToBase64("日本語😀")).toBe("5pel5pys6Kqe8J+YgA==");
    const doc = parse(
      wrapFaviconSvg(
        original,
        { padding: 0, background: null, radius: 0 },
        { width: 10, height: 10 },
      ),
    );
    expect(decode(imageOf(doc))).toBe(original);
  });

  it("<svg> が無ければ元の文字列を返す", () => {
    expect(wrapFaviconSvg("x", { padding: 0, background: null, radius: 0 }, size)).toBe("x");
  });
});

describe("ZIP", () => {
  it("ファイル名と中身がそのまま入る", () => {
    const zip = buildIconZip([
      { name: "favicon.ico", data: new Uint8Array([1, 2, 3]), type: "image/x-icon" },
      { name: "icon-192.png", data: fakePng(192, 192), type: "image/png" },
      {
        name: "site.webmanifest",
        data: new TextEncoder().encode("{}"),
        type: "application/manifest+json",
      },
    ]);
    const entries = unzipSync(zip);
    expect(Object.keys(entries).sort()).toEqual([
      "favicon.ico",
      "icon-192.png",
      "site.webmanifest",
    ]);
    expect(entries["favicon.ico"]).toEqual(new Uint8Array([1, 2, 3]));
    expect(strFromU8(entries["site.webmanifest"] as Uint8Array)).toBe("{}");
  });
});

describe("withIntrinsicSize", () => {
  it("width / height の無い SVG に px の大きさを付ける", () => {
    expect(
      withIntrinsicSize('<?xml?><svg viewBox="0 0 10 20" width="100%"><path/></svg>', {
        width: 10,
        height: 20,
      }),
    ).toBe('<?xml?><svg width="10" height="20" viewBox="0 0 10 20"><path/></svg>');
  });
  it("既に px で両方あればそのまま", () => {
    const svg = '<svg width="16" height="16"></svg>';
    expect(withIntrinsicSize(svg, { width: 1, height: 1 })).toBe(svg);
  });
});
