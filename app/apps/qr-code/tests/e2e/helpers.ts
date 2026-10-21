/**
 * QR コード E2E の共通処理。
 *
 * 保存した PNG / SVG をブラウザの Image と Canvas で実際にラスタライズし、RGBA を
 * Node へ返して独立デコーダー jsQR で復号する（生成側の実装をなぞらない検証）。
 */
import { readFile } from "node:fs/promises";
import { deflateSync } from "node:zlib";
import { type Download, expect, type Page } from "@playwright/test";
import jsQR from "jsqr";

export function isMobile(page: Page): boolean {
  return (page.viewportSize()?.width ?? 1280) < 768;
}

/** ヘッダー（PC）またはメニュー（スマホ）から英語版へ切り替える */
export async function switchToEnglish(page: Page): Promise<void> {
  if (isMobile(page)) await page.getByTestId("mobile-menu-button").click();
  else await page.getByTestId("lang-menu").click();
  await page.getByTestId("lang-en").filter({ visible: true }).click();
}

/** 生成が終わって保存できる状態になるまで待つ */
export async function waitForReady(page: Page): Promise<void> {
  await expect(page.getByTestId("qr-preview")).toBeVisible();
  await expect(page.getByTestId("qr-save-svg")).toBeEnabled();
}

/** 保存ボタンを押してダウンロードを得る */
export async function download(page: Page, testId: string): Promise<Download> {
  const button = page.getByTestId(testId);
  await expect(button).toBeEnabled();
  const [download] = await Promise.all([page.waitForEvent("download"), button.click()]);
  return download;
}

type RasterSource =
  | { readonly kind: "png"; readonly base64: string }
  | { readonly kind: "svg"; readonly text: string };

/**
 * ブラウザで白背景の Canvas へ描き、RGBA を base64 で受け取る。
 * size はラスタライズする一辺（上限で頭打ちにして巨大な配列を避ける）。
 */
async function rasterize(
  page: Page,
  source: RasterSource,
  size: number,
): Promise<Uint8ClampedArray> {
  const base64 = await page.evaluate(
    async ({ source, size }) => {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("2D コンテキストを取得できません");

      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, size, size);

      const blob = new Blob(
        [
          source.kind === "png"
            ? Uint8Array.from(atob(source.base64), (c) => c.charCodeAt(0))
            : source.text,
        ],
        { type: source.kind === "png" ? "image/png" : "image/svg+xml" },
      );
      const objectUrl = URL.createObjectURL(blob);
      try {
        const image = new Image();
        await new Promise<void>((resolve, reject) => {
          image.onload = () => resolve();
          image.onerror = () => reject(new Error("画像として読み込めません"));
          image.src = objectUrl;
        });
        context.drawImage(image, 0, 0, size, size);
      } finally {
        URL.revokeObjectURL(objectUrl);
      }

      const { data } = context.getImageData(0, 0, size, size);
      let binary = "";
      const chunk = 0x8000;
      for (let i = 0; i < data.length; i += chunk) {
        binary += String.fromCharCode.apply(
          null,
          data.subarray(i, i + chunk) as unknown as number[],
        );
      }
      return btoa(binary);
    },
    { source, size },
  );

  const buffer = Buffer.from(base64, "base64");
  return new Uint8ClampedArray(buffer.buffer, buffer.byteOffset, buffer.byteLength);
}

/** 保存した PNG をラスタライズし、jsQR で復号した文字列を返す */
export async function decodeSavedPng(
  page: Page,
  file: Download,
  rasterSize: number,
): Promise<string> {
  const path = await file.path();
  if (!path) throw new Error("ダウンロードしたファイルのパスがありません");
  const base64 = (await readFile(path)).toString("base64");
  const size = Math.min(rasterSize, 1024);
  const data = await rasterize(page, { kind: "png", base64 }, size);
  return jsQR(data, size, size)?.data ?? "";
}

/** 保存した SVG をラスタライズし、jsQR で復号した文字列を返す */
export async function decodeSavedSvg(
  page: Page,
  file: Download,
  rasterSize: number,
): Promise<string> {
  const path = await file.path();
  if (!path) throw new Error("ダウンロードしたファイルのパスがありません");
  const text = await readFile(path, "utf8");
  const size = Math.min(rasterSize, 1024);
  const data = await rasterize(page, { kind: "svg", text }, size);
  return jsQR(data, size, size)?.data ?? "";
}

/** PNG の IHDR から幅と高さを読む */
export async function readPngSize(file: Download): Promise<{ width: number; height: number }> {
  const path = await file.path();
  if (!path) throw new Error("ダウンロードしたファイルのパスがありません");
  const bytes = await readFile(path);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

/** CRC32（PNG のチャンク用） */
function crc32(bytes: Uint8Array): number {
  let crc = -1;
  for (const byte of bytes) {
    crc ^= byte;
    for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ -1) >>> 0;
}

function chunk(type: string, data: Uint8Array): Buffer {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, "ascii");
  const body = Buffer.concat([head.subarray(4), Buffer.from(data)]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([head.subarray(0, 4), body, crc]);
}

/** テスト用の RGBA PNG（中央に不透明な色の四角、周りは透過） */
export function makePng(width = 64): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(width, 4);
  ihdr.set([8, 6, 0, 0, 0], 8);
  const stride = 1 + width * 4;
  const raw = Buffer.alloc(stride * width);
  for (let y = Math.floor(width / 4); y < (width * 3) / 4; y++) {
    for (let x = Math.floor(width / 4); x < (width * 3) / 4; x++) {
      const i = y * stride + 1 + x * 4;
      raw[i] = 220;
      raw[i + 1] = 38;
      raw[i + 2] = 38;
      raw[i + 3] = 255;
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", new Uint8Array()),
  ]);
}
