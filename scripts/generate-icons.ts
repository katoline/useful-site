/**
 * 仮のアプリアイコンを public/ に生成する（`nix develop -c node scripts/generate-icons.ts`）。
 * サイト自身のアイコン生成機能（/icons/）が完成したら、そちらで作り直して置き換える（plan.md §6.1）。
 *
 * 依存を増やさないため、図形（黒地に白い「写真」記号）を数式で塗り、PNG は node:zlib で自前エンコードする。
 * 同じ図形を favicon.svg にも書く。
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { deflateSync } from "node:zlib";
// ICO の組み立てはアイコン生成機能と共通（Node でも動く純粋関数）
import { encodeIco } from "../app/lib/icons/ico.ts";

const PUBLIC_DIR = path.resolve(import.meta.dirname, "../public");

const BG = [10, 10, 10] as const; // #0a0a0a（tokens.css のダークの背景）
const FG = [255, 255, 255] as const;

// ---- 図形（単位正方形 [0,1]² 上） ----

function inRoundRect(
  x: number,
  y: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  r: number,
) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = Math.min(Math.max(x, x0 + r), x1 - r);
  const cy = Math.min(Math.max(y, y0 + r), y1 - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}

function inTriangle(x: number, y: number, a: number[], b: number[], c: number[]) {
  const s = (p: number[], q: number[]) =>
    (x - (q[0] ?? 0)) * ((p[1] ?? 0) - (q[1] ?? 0)) -
    ((p[0] ?? 0) - (q[0] ?? 0)) * (y - (q[1] ?? 0));
  const d1 = s(a, b);
  const d2 = s(b, c);
  const d3 = s(c, a);
  const neg = d1 < 0 || d2 < 0 || d3 < 0;
  const pos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(neg && pos);
}

/** 白い記号（写真の枠・太陽・山）。中心 0.5 を基準に scale で縮める */
function inGlyph(px: number, py: number, scale: number) {
  const x = (px - 0.5) / scale + 0.5;
  const y = (py - 0.5) / scale + 0.5;
  const frame =
    inRoundRect(x, y, 0.18, 0.24, 0.82, 0.76, 0.07) &&
    !inRoundRect(x, y, 0.24, 0.3, 0.76, 0.7, 0.03);
  const sun = (x - 0.38) ** 2 + (y - 0.42) ** 2 <= 0.055 ** 2;
  const mountain =
    inTriangle(x, y, [0.27, 0.7], [0.47, 0.46], [0.67, 0.7]) ||
    inTriangle(x, y, [0.5, 0.7], [0.62, 0.55], [0.76, 0.7]);
  return frame || sun || (mountain && y <= 0.7);
}

interface IconStyle {
  /** 背景の角丸（0 なら全面塗り） */
  radius: number;
  /** 記号の大きさ（maskable はセーフゾーンに収めるため小さく） */
  scale: number;
}

/** RGBA の画素列を作る（4×4 のスーパーサンプリングで縁を滑らかにする） */
function render(size: number, style: IconStyle): Uint8Array {
  const data = new Uint8Array(size * size * 4);
  const ss = 4;
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      let bg = 0;
      let fg = 0;
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const x = (i + (sx + 0.5) / ss) / size;
          const y = (j + (sy + 0.5) / ss) / size;
          if (style.radius > 0 && !inRoundRect(x, y, 0, 0, 1, 1, style.radius)) continue;
          bg++;
          if (inGlyph(x, y, style.scale)) fg++;
        }
      }
      const n = ss * ss;
      const alpha = bg / n;
      const t = bg > 0 ? fg / bg : 0;
      const o = (j * size + i) * 4;
      for (let c = 0; c < 3; c++) {
        data[o + c] = Math.round((BG[c] ?? 0) * (1 - t) + (FG[c] ?? 0) * t);
      }
      data[o + 3] = Math.round(alpha * 255);
    }
  }
  return data;
}

// ---- PNG・ICO のエンコード ----

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of buf) c = (CRC_TABLE[(c ^ b) & 0xff] ?? 0) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, body: Uint8Array): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(body.length);
  const typeAndBody = Buffer.concat([Buffer.from(type, "ascii"), body]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndBody));
  return Buffer.concat([len, typeAndBody, crc]);
}

export function encodePng(size: number, rgba: Uint8Array): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // ビット深度
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // フィルタなし
    Buffer.from(rgba.buffer, rgba.byteOffset + y * size * 4, size * 4).copy(
      raw,
      y * (size * 4 + 1) + 1,
    );
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", new Uint8Array()),
  ]);
}

const ROUNDED: IconStyle = { radius: 0.22, scale: 1 };
const FULL: IconStyle = { radius: 0, scale: 1 };
/** maskable：中央の直径 80% の円に記号が収まるように縮める */
const MASKABLE: IconStyle = { radius: 0, scale: 0.72 };

const png = (size: number, style: IconStyle) => encodePng(size, render(size, style));

const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <title>Image Adjust</title>
  <rect width="100" height="100" rx="22" fill="#0a0a0a"/>
  <path fill="#fff" fill-rule="evenodd" d="M25 24h50a7 7 0 0 1 7 7v38a7 7 0 0 1-7 7H25a7 7 0 0 1-7-7V31a7 7 0 0 1 7-7zm2 6a3 3 0 0 0-3 3v34a3 3 0 0 0 3 3h46a3 3 0 0 0 3-3V33a3 3 0 0 0-3-3z"/>
  <circle cx="38" cy="42" r="5.5" fill="#fff"/>
  <path fill="#fff" d="M27 70l20-24 13 15.6L62 55l14 15z"/>
</svg>
`;

function main() {
  mkdirSync(path.join(PUBLIC_DIR, "pwa"), { recursive: true });
  const write = (file: string, data: Uint8Array | string) => {
    writeFileSync(path.join(PUBLIC_DIR, file), data);
    console.log(`public/${file}`);
  };
  write("pwa/icon-192.png", png(192, ROUNDED));
  write("pwa/icon-512.png", png(512, ROUNDED));
  write("pwa/icon-maskable-512.png", png(512, MASKABLE));
  // iOS は角を自分で丸めるので全面塗り（透過は黒くなる）
  write("apple-touch-icon.png", png(180, FULL));
  write("favicon.ico", encodeIco([16, 32, 48].map((size) => png(size, ROUNDED))));
  write("favicon.svg", FAVICON_SVG);
}

main();
