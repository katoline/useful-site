import { readFile } from "node:fs/promises";
import { deflateSync } from "node:zlib";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { strFromU8, unzipSync } from "fflate";

const isMobile = (page: Page) => (page.viewportSize()?.width ?? 1280) < 768;

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

/** テスト用の RGBA PNG（中央に黒い四角、周りは透過） */
function makePng(width: number, height = width): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.set([8, 6, 0, 0, 0], 8);
  const stride = 1 + width * 4;
  const raw = Buffer.alloc(stride * height);
  for (let y = Math.floor(height / 4); y < (height * 3) / 4; y++) {
    for (let x = Math.floor(width / 4); x < (width * 3) / 4; x++)
      raw[y * stride + 1 + x * 4 + 3] = 255;
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", new Uint8Array()),
  ]);
}

/** ZIP 保存のボタン（PC はカード内、スマホは画面下の固定バー） */
const downloadButton = (page: Page) =>
  page.getByTestId(isMobile(page) ? "icons-download-zip-mobile" : "icons-download-zip");

/** 設定パネル（PC はカード、スマホは下から出るシートを開く） */
async function openSettings(page: Page) {
  if (!isMobile(page)) return page.getByTestId("icon-tool");
  await page.getByTestId("icons-open-settings").click();
  return page.getByTestId("icons-settings-sheet");
}

async function closeSettings(page: Page) {
  if (isMobile(page)) await page.keyboard.press("Escape");
}

/** 「サイト情報（マニフェスト・HTML）」の折りたたみを開く（既定は閉じている） */
async function openSiteInfo(settings: Locator) {
  await settings.getByTestId("icons-site-info").locator("summary").click();
}

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><!-- comment --><circle cx="32" cy="32" r="28" fill="#e11d48"/></svg>`;

async function downloadZip(page: Page): Promise<Record<string, Uint8Array>> {
  const button = downloadButton(page);
  await expect(button).toBeEnabled({ timeout: 20_000 });
  const [download] = await Promise.all([page.waitForEvent("download"), button.click()]);
  expect(download.suggestedFilename()).toBe("favicons.zip");
  const path = await download.path();
  return unzipSync(new Uint8Array(await readFile(path)));
}

test("PNG からアイコン一式を ZIP で保存でき、favicon.ico がブラウザで表示できる", async ({
  page,
}) => {
  await page.goto("/image-adjust/icons/");
  await expect(downloadButton(page)).toBeDisabled();
  await page.getByTestId("icons-file-input").setInputFiles({
    name: "logo.png",
    mimeType: "image/png",
    buffer: makePng(256),
  });
  await expect(page.getByTestId("icons-source-info")).toContainText("logo.png");
  await expect(page.getByTestId("icons-preview-16")).toBeVisible();
  const settings = await openSettings(page);
  await openSiteInfo(settings);
  await settings.getByTestId("icons-include-og").click();
  await closeSettings(page);

  const files = await downloadZip(page);
  expect(Object.keys(files).sort()).toEqual(
    [
      "apple-touch-icon.png",
      "favicon-16x16.png",
      "favicon-32x32.png",
      "favicon.ico",
      "icon-192.png",
      "icon-512.png",
      "icon-maskable-512.png",
      "og-image.png",
      "site.webmanifest",
    ].sort(),
  );

  const manifest = JSON.parse(strFromU8(files["site.webmanifest"] as Uint8Array));
  expect(manifest.icons).toHaveLength(3);

  // 生成した ICO を <img> で読み込めること（フェーズ 8 の完了条件）
  const ico = Buffer.from(files["favicon.ico"] as Uint8Array).toString("base64");
  const size = await page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/x-icon;base64,${b64}`;
    await img.decode();
    return { width: img.naturalWidth, height: img.naturalHeight };
  }, ico);
  expect(size.width).toBeGreaterThan(0);
  expect(size.height).toBeGreaterThan(0);

  // PNG の寸法も確認する（IHDR）
  const dims = (name: string) => {
    const png = files[name] as Uint8Array;
    const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
    return [view.getUint32(16), view.getUint32(20)];
  };
  expect(dims("apple-touch-icon.png")).toEqual([180, 180]);
  expect(dims("icon-maskable-512.png")).toEqual([512, 512]);
  expect(dims("og-image.png")).toEqual([1200, 630]);
});

test("SVG を入れると favicon.svg と SVG 用の link が付く", async ({ page }) => {
  // 作られた Blob URL の型と、解放されたかを記録する
  await page.addInitScript(() => {
    const created: { url: string; type: string }[] = [];
    const revoked = new Set<string>();
    const create = URL.createObjectURL.bind(URL);
    const revoke = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = (obj: Blob | MediaSource) => {
      const url = create(obj);
      created.push({ url, type: obj instanceof Blob ? obj.type : "" });
      return url;
    };
    URL.revokeObjectURL = (url: string) => {
      revoked.add(url);
      revoke(url);
    };
    (window as unknown as { __blobs: unknown }).__blobs = { created, revoked };
  });
  await page.goto("/image-adjust/en/icons/");
  await page.getByTestId("icons-file-input").setInputFiles({
    name: "logo.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from(SVG),
  });
  await expect(page.getByTestId("icons-snippet")).toHaveValue(/favicon\.svg/);
  await expect(downloadButton(page)).toBeEnabled({ timeout: 20_000 });

  // 元の SVG の Blob URL は読み込み後すぐ解放され、画面（<img> / <a>）には SVG の Blob URL が出ない
  // （blob: はこのサイトのオリジンを受け継ぐので、新しいタブで開かれると SVG 内のスクリプトが動くため）
  const blobs = await page.evaluate(() => {
    const { created, revoked } = (
      window as unknown as {
        __blobs: { created: { url: string; type: string }[]; revoked: Set<string> };
      }
    ).__blobs;
    const inDom = [
      ...[...document.querySelectorAll("img")].map((el) => el.src),
      ...[...document.querySelectorAll("a")].map((el) => el.href),
    ].filter((url) => url.startsWith("blob:"));
    const typeOf = (url: string) => created.find((c) => c.url === url)?.type ?? "unknown";
    return {
      svgCreated: created.filter((c) => c.type === "image/svg+xml").length,
      svgNotRevoked: created.filter((c) => c.type === "image/svg+xml" && !revoked.has(c.url))
        .length,
      domTypes: [...new Set(inDom.map(typeOf))],
    };
  });
  expect(blobs.svgCreated).toBeGreaterThan(0);
  expect(blobs.svgNotRevoked).toBe(0);
  expect(blobs.domTypes).toEqual(["image/png"]);

  const files = await downloadZip(page);
  expect(Object.keys(files)).toContain("favicon.svg");
  const svg = strFromU8(files["favicon.svg"] as Uint8Array);
  // 元の SVG（最適化済み）は <image> の data URL の中に入っている
  const dataUrl = /href="data:image\/svg\+xml;base64,([^"]+)"/.exec(svg)?.[1] ?? "";
  const embedded = Buffer.from(dataUrl, "base64").toString("utf8");
  expect(embedded).toContain("<circle");
  expect(embedded).not.toContain("comment");
});

test("言語を切り替えても元画像と設定が残る", async ({ page }) => {
  await page.goto("/image-adjust/icons/");
  await page.getByTestId("icons-file-input").setInputFiles({
    name: "logo.png",
    mimeType: "image/png",
    buffer: makePng(64),
  });
  const settings = await openSettings(page);
  await openSiteInfo(settings);
  await settings.getByLabel("サイト名").fill("Keep Me");
  await closeSettings(page);
  await expect(downloadButton(page)).toBeEnabled({ timeout: 20_000 });

  if (isMobile(page)) await page.getByTestId("mobile-menu-button").click();
  else await page.getByTestId("lang-menu").click();
  await page.getByTestId("lang-en").filter({ visible: true }).click();
  await expect(page).toHaveURL(/\/image-adjust\/en\/icons\/$/);
  await expect(page.getByTestId("icons-source-info")).toContainText("logo.png");
  await expect(downloadButton(page)).toBeEnabled();
  const enSettings = await openSettings(page);
  await openSiteInfo(enSettings);
  await expect(enSettings.getByLabel("Site name")).toHaveValue("Keep Me");
});

test("ページに FAQ の構造化データと使い方がある", async ({ page }) => {
  await page.goto("/image-adjust/icons/");
  const types = await page
    .locator('script[type="application/ld+json"]')
    .evaluateAll((els) => els.map((el) => JSON.parse(el.textContent ?? "{}")["@type"]));
  expect(types).toEqual(expect.arrayContaining(["WebApplication", "FAQPage", "BreadcrumbList"]));
  await expect(page.getByRole("heading", { level: 2, name: "よくある質問" })).toBeVisible();
});

test("ピクセル数の上限を超える画像は、ヘッダーで判定して読み込まない", async ({ page }) => {
  await page.goto("/image-adjust/icons/");
  // IHDR だけ 20000×20000（本体は無い）。デコードせずに上限超過と分かること
  const header = makePng(1).subarray(0, 33);
  header.writeUInt32BE(20_000, 16);
  header.writeUInt32BE(20_000, 20);
  await page.getByTestId("icons-file-input").setInputFiles({
    name: "huge.png",
    mimeType: "image/png",
    buffer: header,
  });
  await expect(page.getByRole("alert").filter({ hasText: "大きすぎます" })).toBeVisible();
  await expect(page.getByTestId("icons-source-info")).toHaveCount(0);
});

test("大きな画像でも作業用 canvas は 1 回だけ縮め、生成のたびに大きな canvas を作らない", async ({
  page,
}) => {
  // 作られた canvas の大きさを記録する
  await page.addInitScript(() => {
    const sizes: number[][] = [];
    (window as unknown as { __canvases: number[][] }).__canvases = sizes;
    const Native = OffscreenCanvas;
    (globalThis as unknown as { OffscreenCanvas: typeof OffscreenCanvas }).OffscreenCanvas =
      class extends Native {
        constructor(w: number, h: number) {
          super(w, h);
          sizes.push([w, h]);
        }
      };
    const create = document.createElement.bind(document);
    document.createElement = ((tag: string, options?: ElementCreationOptions) => {
      const el = create(tag, options);
      if (tag.toLowerCase() === "canvas") {
        const canvas = el as HTMLCanvasElement;
        queueMicrotask(() => sizes.push([canvas.width, canvas.height]));
      }
      return el;
    }) as typeof document.createElement;
  });
  await page.goto("/image-adjust/icons/");
  await page.getByTestId("icons-file-input").setInputFiles({
    name: "photo.png",
    mimeType: "image/png",
    buffer: makePng(3000, 2000),
  });
  await expect(page.getByTestId("icons-source-info")).toContainText("3000");
  await expect(downloadButton(page)).toBeEnabled({ timeout: 30_000 });

  const read = () =>
    page.evaluate(() => (window as unknown as { __canvases: number[][] }).__canvases.slice());
  const afterLoad = await read();
  // 元の大きさ（3000×2000）の canvas は作らない
  expect(afterLoad.every(([w, h]) => (w ?? 0) * (h ?? 0) < 3000 * 2000)).toBe(true);

  // 設定を変えて作り直したときに作る canvas は、作業用（長辺 1024）以下で数も限られる
  const settings = await openSettings(page);
  await settings.getByTestId("icons-transparent").click();
  await closeSettings(page);
  await expect(downloadButton(page)).toBeEnabled({ timeout: 30_000 });
  await expect.poll(async () => (await read()).length).toBeGreaterThan(afterLoad.length);
  const regenerated = (await read()).slice(afterLoad.length);
  expect(regenerated.length).toBeLessThanOrEqual(25);
  expect(regenerated.every(([w, h]) => (w ?? 0) <= 1200 && (h ?? 0) <= 1024)).toBe(true);
});

test("設置先にスキームの無いドメインを入れると注意を出し、HTML には反映しない", async ({
  page,
}) => {
  await page.goto("/image-adjust/icons/");
  const settings = await openSettings(page);
  await openSiteInfo(settings);
  await settings.getByTestId("icons-base-path").fill("example.com");
  await expect(settings.getByTestId("icons-base-path-error")).toContainText("https://");
  await settings.getByTestId("icons-base-path").fill("https://example.com/");
  await expect(settings.getByTestId("icons-base-path-error")).toBeEmpty();
  await settings.getByTestId("icons-base-path").fill("example.com");
  await closeSettings(page);
  // 最後に正しかった値のまま
  await expect(page.getByTestId("icons-snippet")).toHaveValue(
    /href="https:\/\/example\.com\/favicon\.ico"/,
  );
});
