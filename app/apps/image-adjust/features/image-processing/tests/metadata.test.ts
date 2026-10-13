import { beforeAll, describe, expect, it } from "vitest";
import { readGifInfo } from "../../../tests/helpers/gif-info";
import {
  embedIcc,
  extractIcc,
  hasExif,
  isAnimatedWebp,
  stripMetadata,
} from "../adapters/codecs/metadata";
import { decodeRaster } from "../adapters/codecs/raster";
import { initCodecsForNode, readFixture } from "./helpers/codecs-node";

/** generate-fixtures.ts の DUMMY_ICC と同じ */
const DUMMY_ICC = Uint8Array.from({ length: 600 }, (_, i) => (i * 31 + 7) & 0xff);

beforeAll(async () => {
  await initCodecsForNode();
}, 60_000);

describe("JPEG", () => {
  it("EXIF（GPS 付き）を取り除き、ICC は残す。画像としても壊れない", async () => {
    const original = readFixture("exif.jpg");
    expect(hasExif("jpeg", original)).toBe(true);
    expect(extractIcc("jpeg", original)).toEqual(DUMMY_ICC);

    const stripped = stripMetadata("jpeg", original);
    expect(hasExif("jpeg", stripped)).toBe(false);
    expect(new TextDecoder("latin1").decode(stripped)).not.toContain("Exif");
    expect(extractIcc("jpeg", stripped)).toEqual(DUMMY_ICC);
    expect(stripped.byteLength).toBeLessThan(original.byteLength);
    const decoded = await decodeRaster("jpeg", stripped);
    expect(decoded.width * decoded.height).toBe(160 * 120);
  });

  it("ICC を埋め込み直せる（既存のものは置き換える）", () => {
    const plain = readFixture("sample.jpg");
    expect(extractIcc("jpeg", plain)).toBeNull();
    const withIcc = embedIcc("jpeg", plain, DUMMY_ICC);
    expect(extractIcc("jpeg", withIcc)).toEqual(DUMMY_ICC);
    // 大きなプロファイルは複数の APP2 に分割される
    const big = Uint8Array.from({ length: 150_000 }, (_, i) => i & 0xff);
    const withBig = embedIcc("jpeg", withIcc, big);
    expect(extractIcc("jpeg", withBig)).toEqual(big);
    expect(
      new Uint8Array(withBig).filter((_, i, a) => a[i] === 0xff && a[i + 1] === 0xe2).length,
    ).toBe(3);
  });
});

describe("PNG", () => {
  it("iCCP の埋め込みと取り出し", () => {
    const png = readFixture("sample.png");
    expect(extractIcc("png", png)).toBeNull();
    const withIcc = embedIcc("png", png, DUMMY_ICC);
    expect(extractIcc("png", withIcc)).toEqual(DUMMY_ICC);
    // iCCP は IHDR の直後
    // iCCP は IHDR（25 バイト）の直後のチャンク
    expect(new TextDecoder("latin1").decode(withIcc.slice(8, 48))).toMatch(/IHDR.*iCCP/s);
  });

  it("tEXt / eXIf を取り除く", () => {
    const png = new Uint8Array(readFixture("sample.png"));
    // IHDR（8 + 25 バイト）の後ろに tEXt を差し込む
    const text = new TextEncoder().encode("Comment\0hello");
    const chunk = new Uint8Array(12 + text.byteLength);
    new DataView(chunk.buffer).setUint32(0, text.byteLength);
    chunk.set(new TextEncoder().encode("tEXt"), 4);
    chunk.set(text, 8);
    const withText = new Uint8Array([...png.subarray(0, 33), ...chunk, ...png.subarray(33)]);
    expect(new TextDecoder("latin1").decode(withText)).toContain("tEXt");
    const stripped = stripMetadata("png", withText);
    expect(new TextDecoder("latin1").decode(stripped)).not.toContain("tEXt");
    expect(stripped.byteLength).toBe(png.byteLength);
  });
});

describe("WebP", () => {
  it("単純な WebP を VP8X に包んで ICCP を入れ、取り出せる", async () => {
    const webp = readFixture("sample.webp");
    expect(extractIcc("webp", webp)).toBeNull();
    const withIcc = embedIcc("webp", webp, DUMMY_ICC);
    expect(extractIcc("webp", withIcc)).toEqual(DUMMY_ICC);
    expect(new TextDecoder("latin1").decode(withIcc.slice(12, 16))).toBe("VP8X");
    // RIFF のサイズが合っていてデコードできる
    expect(new DataView(withIcc).getUint32(4, true)).toBe(withIcc.byteLength - 8);
    const decoded = await decodeRaster("webp", withIcc);
    expect([decoded.width, decoded.height]).toEqual([160, 120]);
    // 既に VP8X なら ICCP を置き換える
    const again = embedIcc("webp", withIcc, Uint8Array.from([1, 2, 3]));
    expect(extractIcc("webp", again)).toEqual(Uint8Array.from([1, 2, 3]));
  });

  it("EXIF / XMP チャンクを取り除き、VP8X のフラグも直す", () => {
    const base = new Uint8Array(embedIcc("webp", readFixture("sample.webp"), DUMMY_ICC));
    // EXIF チャンクを末尾に足し、VP8X の EXIF フラグ（0x08）を立てる
    const exif = new Uint8Array(8 + 4);
    exif.set(new TextEncoder().encode("EXIF"), 0);
    new DataView(exif.buffer).setUint32(4, 4, true);
    const withExif = new Uint8Array([...base, ...exif]);
    new DataView(withExif.buffer).setUint32(4, withExif.byteLength - 8, true);
    withExif[20] = (withExif[20] ?? 0) | 0x08;
    expect(hasExif("webp", withExif)).toBe(true);
    const stripped = new Uint8Array(stripMetadata("webp", withExif));
    expect(hasExif("webp", stripped)).toBe(false);
    expect((stripped[20] ?? 0) & 0x08).toBe(0);
    expect(extractIcc("webp", stripped)).toEqual(DUMMY_ICC);
  });

  it("アニメーション（VP8X の ANIM フラグ）を判定する", () => {
    const base = new Uint8Array(embedIcc("webp", readFixture("sample.webp"), DUMMY_ICC));
    expect(isAnimatedWebp(readFixture("sample.webp"))).toBe(false);
    expect(isAnimatedWebp(base)).toBe(false);
    base[20] = (base[20] ?? 0) | 0x02;
    expect(isAnimatedWebp(base)).toBe(true);
  });
});

describe("GIF", () => {
  it("コメント拡張と NETSCAPE 以外のアプリ拡張を取り除き、フレームは保つ", () => {
    const gif = new Uint8Array(readFixture("animated.gif"));
    // ヘッダー 13 ＋ グローバルカラーテーブル（128 色 × 3）の後ろに挿入する
    const insertAt = 13 + 128 * 3;
    const comment = [0x21, 0xfe, 5, ...new TextEncoder().encode("hello"), 0];
    const xmp = [0x21, 0xff, 11, ...new TextEncoder().encode("XMP DataXMP"), 3, 1, 2, 3, 0];
    const withMeta = new Uint8Array([
      ...gif.subarray(0, insertAt),
      ...comment,
      ...xmp,
      ...gif.subarray(insertAt),
    ]);
    expect(readGifInfo(withMeta)?.frames).toBe(4);
    const stripped = new Uint8Array(stripMetadata("gif", withMeta));
    expect(stripped.byteLength).toBe(gif.byteLength);
    expect(new TextDecoder("latin1").decode(stripped)).not.toContain("hello");
    expect(new TextDecoder("latin1").decode(stripped)).not.toContain("XMP Data");
    expect(new TextDecoder("latin1").decode(stripped)).toContain("NETSCAPE2.0");
    expect(readGifInfo(stripped)?.frames).toBe(4);
  });
});

describe("SVG", () => {
  it("metadata 要素を取り除く", () => {
    const svg = new TextDecoder().decode(readFixture("sample.svg"));
    expect(svg).toContain("<metadata");
    const stripped = new TextDecoder().decode(stripMetadata("svg", new TextEncoder().encode(svg)));
    expect(stripped).not.toContain("<metadata");
    expect(stripped).not.toContain("rdf:RDF");
    expect(stripped).toContain("<circle");
  });
});
