/**
 * テスト用画像の生成スクリプト（決定的。再生成しても同じ内容になる）。
 *   nix develop -c node app/apps/image-adjust/tests/fixtures/generate-fixtures.ts
 * 生成物：sample.png（透過あり）・sample.jpg・sample.webp・animated.gif（4 フレーム）・
 *         sample.svg（コメント・メタデータ付き）・script.svg（<script> 入り）・sample.zip（フォルダ構成）
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { zipSync } from "fflate";

const require = createRequire(import.meta.url);
const here = import.meta.dirname;

function wasm(pkg: string, file: string): WebAssembly.Module {
  const root = path.dirname(require.resolve(`${pkg}/package.json`));
  return new WebAssembly.Module(readFileSync(path.join(root, file)));
}

// Node の型除去はパラメータプロパティに対応しないので、明示的に代入する
class NodeImageData {
  data: Uint8ClampedArray;
  width: number;
  height: number;
  constructor(data: Uint8ClampedArray, width: number, height: number) {
    this.data = data;
    this.width = width;
    this.height = height;
  }
}
(globalThis as unknown as { ImageData: unknown }).ImageData ??= NodeImageData;

function makeImage(width: number, height: number, alpha: boolean) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      data[i] = Math.round((x / (width - 1)) * 255);
      data[i + 1] = Math.round((y / (height - 1)) * 255);
      data[i + 2] = (x * 7 + y * 13) % 256;
      data[i + 3] = alpha && y < height / 4 ? 96 : 255;
    }
  }
  return new NodeImageData(data, width, height) as unknown as ImageData;
}

/**
 * アニメーション GIF（4 フレーム）。LZW 最小コードサイズ 7（コードが 8 ビット＝1 バイト）にして、
 * 120 画素ごとに CLEAR を入れることで圧縮せずに正しい LZW ストリームを書く。
 */
function makeAnimatedGif(width: number, height: number, frames: number): Uint8Array {
  const out: number[] = [];
  const u16 = (v: number) => out.push(v & 0xff, (v >> 8) & 0xff);
  out.push(...[...("GIF89a" as string)].map((c) => c.charCodeAt(0)));
  u16(width);
  u16(height);
  out.push(0xf6, 0, 0); // グローバルカラーテーブル 128 色
  for (let i = 0; i < 128; i++) out.push((i * 2) & 0xff, (255 - i * 2) & 0xff, (i * 5) & 0xff);
  // NETSCAPE ループ拡張
  out.push(
    0x21,
    0xff,
    0x0b,
    ...[...("NETSCAPE2.0" as string)].map((c) => c.charCodeAt(0)),
    3,
    1,
    0,
    0,
    0,
  );
  for (let f = 0; f < frames; f++) {
    out.push(0x21, 0xf9, 0x04, 0x00, 10, 0, 0, 0); // GCE：遅延 10/100 秒
    out.push(0x2c);
    u16(0);
    u16(0);
    u16(width);
    u16(height);
    out.push(0); // ローカルカラーテーブルなし
    out.push(7); // LZW 最小コードサイズ
    const codes: number[] = [];
    let sinceClear = 0;
    codes.push(128);
    for (let p = 0; p < width * height; p++) {
      if (sinceClear >= 120) {
        codes.push(128);
        sinceClear = 0;
      }
      const x = p % width;
      const y = Math.floor(p / width);
      codes.push((x + y + f * 16) % 128);
      sinceClear++;
    }
    codes.push(129);
    for (let i = 0; i < codes.length; i += 255) {
      const chunk = codes.slice(i, i + 255);
      out.push(chunk.length, ...chunk);
    }
    out.push(0);
  }
  out.push(0x3b);
  return Uint8Array.from(out);
}

/**
 * EXIF の APP1 セグメント：Orientation=6（時計回りに 90° 回転して表示）と GPS IFD（緯度）を持つ。
 * TIFF はリトルエンディアン。IFD0 → GPS IFD の順に置く。
 */
function buildExifApp1(): Uint8Array {
  const tiff: number[] = [];
  const u16 = (v: number) => tiff.push(v & 0xff, (v >> 8) & 0xff);
  const u32 = (v: number) =>
    tiff.push(v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >>> 24) & 0xff);
  const entry = (tag: number, type: number, count: number, value: number) => {
    u16(tag);
    u16(type);
    u32(count);
    u32(value);
  };
  // ヘッダー 8 バイト
  tiff.push(0x49, 0x49); // "II"
  u16(42);
  u32(8);
  // IFD0：2 エントリ（Orientation, GPSInfo）。IFD0 = 8 + 2 + 2*12 + 4 = 38 バイト → GPS IFD は 46
  const gpsIfdOffset = 46;
  u16(2);
  entry(0x0112, 3, 1, 6); // Orientation SHORT = 6
  entry(0x8825, 4, 1, gpsIfdOffset); // GPSInfo IFD pointer
  u32(0);
  // GPS IFD：2 エントリ（LatitudeRef, Latitude）。= 2 + 2*12 + 4 = 30 → RATIONAL の値は 76 から
  const latOffset = gpsIfdOffset + 30;
  u16(2);
  entry(0x0001, 2, 2, 0x004e); // "N\0"（ASCII 2 バイトは値フィールドに直接）
  entry(0x0002, 5, 3, latOffset); // RATIONAL × 3
  u32(0);
  for (const [n, d] of [
    [35, 1],
    [41, 1],
    [1234, 100],
  ] as const) {
    u32(n);
    u32(d);
  }
  const body = [...("Exif\0\0" as string)].map((c) => c.charCodeAt(0)).concat(tiff);
  const len = body.length + 2;
  return Uint8Array.from([0xff, 0xe1, (len >> 8) & 0xff, len & 0xff, ...body]);
}

/** ダミーの ICC プロファイル（中身は検証しない。往復で同じバイト列が戻るかを見る） */
const DUMMY_ICC = Uint8Array.from({ length: 600 }, (_, i) => (i * 31 + 7) & 0xff);

function buildIccApp2(icc: Uint8Array): Uint8Array {
  const sig = [...("ICC_PROFILE\0" as string)].map((c) => c.charCodeAt(0));
  const len = 2 + sig.length + 2 + icc.length;
  return Uint8Array.from([0xff, 0xe2, (len >> 8) & 0xff, len & 0xff, ...sig, 1, 1, ...icc]);
}

/** SOI の直後に APP セグメントを差し込む */
function withSegments(jpeg: Uint8Array, segments: Uint8Array[]): Uint8Array {
  const out: number[] = [0xff, 0xd8];
  for (const s of segments) out.push(...s);
  out.push(...jpeg.subarray(2));
  return Uint8Array.from(out);
}

const SAMPLE_SVG = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<!-- Created with a vector editor -->
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="200" height="120" viewBox="0 0 200 120" inkscape:version="1.2">
  <title>Sample</title>
  <metadata id="metadata1">
    <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description>sample</rdf:Description></rdf:RDF>
  </metadata>
  <!-- background -->
  <rect x="0.000001" y="0" width="200.00000" height="120.0000" fill="#ffffff" stroke="none"/>
  <g id="g1" inkscape:label="Layer 1">
    <circle cx="60.0001" cy="60.00" r="40.000" fill="#ff0000"/>
    <path d="M 120.0000,20.0000 L 180.0000,20.0000 L 180.0000,100.0000 L 120.0000,100.0000 Z" fill="#0000ff"/>
  </g>
</svg>
`;

const SCRIPT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <title>script</title>
  <script>window.__svgScriptRan = true;</script>
  <rect width="64" height="64" fill="#00aa00"/>
</svg>
`;

async function main() {
  const [pngEnc, jpegEnc, webpEnc] = await Promise.all([
    import("@jsquash/png/encode.js"),
    import("@jsquash/jpeg/encode.js"),
    import("@jsquash/webp/encode.js"),
  ]);
  await pngEnc.init(wasm("@jsquash/png", "codec/pkg/squoosh_png_bg.wasm"));
  await jpegEnc.init(wasm("@jsquash/jpeg", "codec/enc/mozjpeg_enc.wasm"));
  await webpEnc.init(wasm("@jsquash/webp", "codec/enc/webp_enc.wasm"));

  const png = new Uint8Array(await pngEnc.default(makeImage(160, 120, true)));
  const jpg = new Uint8Array(await jpegEnc.default(makeImage(160, 120, false), { quality: 92 }));
  const webp = new Uint8Array(await webpEnc.default(makeImage(160, 120, true), { quality: 90 }));
  const gif = makeAnimatedGif(48, 32, 4);
  const svg = new TextEncoder().encode(SAMPLE_SVG);
  const scriptSvg = new TextEncoder().encode(SCRIPT_SVG);

  const write = (name: string, data: Uint8Array) => writeFileSync(path.join(here, name), data);
  write("sample.png", png);
  write("sample.jpg", jpg);
  write("sample.webp", webp);
  // EXIF（向き 6・GPS）と ICC 付き。向きの反映・メタデータ除去・ICC の引き継ぎのテスト用
  write("exif.jpg", withSegments(jpg, [buildExifApp1(), buildIccApp2(DUMMY_ICC)]));
  write("animated.gif", gif);
  write("sample.svg", svg);
  write("script.svg", scriptSvg);
  // フォルダ構成＋画像以外のファイル
  write(
    "sample.zip",
    zipSync(
      {
        "photos/a.png": png,
        "photos/sub/b.jpg": jpg,
        "photos/sub/c.gif": gif,
        "notes.txt": new TextEncoder().encode("not an image"),
      },
      { level: 0, mtime: new Date("2024-01-01T00:00:00Z") },
    ),
  );
  console.log("fixtures written");
}

await main();
