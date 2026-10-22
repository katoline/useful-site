import { readFileSync } from "node:fs";
import path from "node:path";
import { type Download, expect, type Locator, type Page, test } from "@playwright/test";
import { unzipSync } from "fflate";
import { detectFormat } from "../../domain/format";
import { readGifInfo } from "../helpers/gif-info";

const FIXTURES = path.resolve(import.meta.dirname, "../fixtures");
const fixture = (name: string) => path.join(FIXTURES, name);

const isMobile = (page: Page) => (page.viewportSize()?.width ?? 1280) < 768;

// WASM の読み込みと処理を含むので、他のテストと並列に走っても足りる時間にする
test.describe.configure({ timeout: 90_000 });

/** 出力形式を選ぶ（スマホは設定シートの中。PC のカードは非表示なので visible なものだけ押す） */
async function chooseOutput(page: Page, format: "png" | "jpeg" | "webp") {
  if (isMobile(page)) await page.getByTestId("open-settings").click();
  await page.locator(`[data-testid=output-${format}]:visible`).click();
  if (isMobile(page)) await page.keyboard.press("Escape");
}

async function openSettingsIfMobile(page: Page) {
  if (isMobile(page)) await page.getByTestId("open-settings").click();
}
async function closeSettingsIfMobile(page: Page) {
  if (isMobile(page)) await page.keyboard.press("Escape");
}

async function addFiles(page: Page, ...names: string[]) {
  await page.getByTestId("file-input").setInputFiles(names.map(fixture));
}

async function expectDone(card: Locator) {
  await expect(card).toHaveAttribute("data-status", "done", { timeout: 90_000 });
}

async function downloadBytes(download: Download): Promise<Uint8Array> {
  const file = await download.path();
  return new Uint8Array(readFileSync(file as string));
}

function saveAllButton(page: Page) {
  return page.getByTestId(isMobile(page) ? "save-all-mobile" : "save-all");
}

/** ページ内の <img> の blob: URL がすべて SVG でないこと（プレビューはラスタライズ済み） */
async function expectNoSvgBlobInDom(page: Page) {
  const types = await page.evaluate(async () => {
    const urls = [...document.querySelectorAll<HTMLImageElement>("img")]
      .map((img) => img.getAttribute("src") ?? "")
      .filter((src) => src.startsWith("blob:"));
    const hrefs = [...document.querySelectorAll<HTMLAnchorElement>("a[href^='blob:']")].length;
    const types: string[] = [];
    for (const url of urls) {
      const blob = await fetch(url).then((r) => r.blob());
      types.push(blob.type);
    }
    return { types, hrefs };
  });
  expect(types.types.length).toBeGreaterThan(0);
  for (const type of types.types) expect(type).not.toMatch(/svg/);
  expect(types.hrefs).toBe(0);
}

test("トップで PNG を入れて WebP に変換・保存できる", async ({ page }) => {
  await page.goto("/image-adjust/");
  await expect(page.getByTestId("results-empty")).toBeVisible();
  await chooseOutput(page, "webp");
  await addFiles(page, "sample.png");

  const card = page.getByTestId("result-card").first();
  await expectDone(card);
  await expect(card.getByTestId("result-name")).toHaveText("sample.png");
  await expect(card.getByTestId("reduction")).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await card.getByTestId("result-save").first().click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("sample.webp");
  const bytes = await downloadBytes(download);
  expect(detectFormat(bytes)).toBe("webp");
  expect(bytes.byteLength).toBeLessThan(readFileSync(fixture("sample.png")).byteLength);
});

test("修正版WebPで可逆圧縮し、同じ画像をPNGへ戻せる", async ({ page }) => {
  await page.goto("/image-adjust/");
  await chooseOutput(page, "webp");
  await openSettingsIfMobile(page);
  await page.locator('[data-testid="advanced-settings"]:visible > summary').click();
  await page.locator('[id$="-webplossless"]:visible').click();
  await closeSettingsIfMobile(page);
  await addFiles(page, "sample.png");
  const card = page.getByTestId("result-card").first();
  await expectDone(card);
  const webpDownload = page.waitForEvent("download");
  await card.getByTestId("result-save").first().click();
  const webp = await downloadBytes(await webpDownload);
  expect(detectFormat(webp)).toBe("webp");
  expect(new TextDecoder().decode(webp.subarray(12, 16))).toBe("VP8L");

  await page.reload();
  await chooseOutput(page, "png");
  await page.getByTestId("file-input").setInputFiles({
    name: "roundtrip.webp",
    mimeType: "image/webp",
    buffer: Buffer.from(webp),
  });
  const restored = page.getByTestId("result-card").first();
  await expectDone(restored);
  const pngDownload = page.waitForEvent("download");
  await restored.getByTestId("result-save").first().click();
  const png = await downloadBytes(await pngDownload);
  expect(detectFormat(png)).toBe("png");
  const header = new DataView(png.buffer, png.byteOffset, png.byteLength);
  expect([header.getUint32(16), header.getUint32(20)]).toEqual([160, 120]);
});

test("ZIP を入れると構成を保って全件変換され、ZIP で保存できる", async ({ page }) => {
  await page.goto("/image-adjust/en/");
  await chooseOutput(page, "webp");
  await addFiles(page, "sample.zip");

  const cards = page.getByTestId("result-card");
  await expect(cards).toHaveCount(3, { timeout: 30_000 });
  for (let i = 0; i < 3; i++) await expectDone(cards.nth(i));
  await expect(
    page.getByTestId("result-name").filter({ hasText: "photos/sub/b.jpg" }),
  ).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await saveAllButton(page).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^image-adjust-\d{4}-\d{2}-\d{2}\.zip$/);
  const zip = unzipSync(await downloadBytes(download));
  expect(Object.keys(zip).sort()).toEqual([
    "photos/a.webp",
    "photos/sub/b.webp",
    "photos/sub/c.gif",
  ]);
  expect(detectFormat(zip["photos/a.webp"] as Uint8Array)).toBe("webp");
  expect(detectFormat(zip["photos/sub/b.webp"] as Uint8Array)).toBe("webp");
  // GIF は形式変換の対象外なので GIF のまま（フレームは維持）
  expect(readGifInfo(zip["photos/sub/c.gif"] as Uint8Array)?.frames).toBe(4);
});

test("アニメーション GIF を圧縮してもフレームが保たれる", async ({ page }) => {
  await page.goto("/image-adjust/compress/gif/");
  await addFiles(page, "animated.gif");
  const card = page.getByTestId("result-card").first();
  await expectDone(card);

  const downloadPromise = page.waitForEvent("download");
  await card.getByTestId("result-save").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("animated.gif");
  const info = readGifInfo(await downloadBytes(download));
  expect(info).toMatchObject({ width: 48, height: 32, frames: 4, animated: true });
});

test("ZIP 由来の処理済み項目でも比較の処理前画像を読み込める", async ({ page }) => {
  await page.goto("/image-adjust/en/");
  await chooseOutput(page, "webp");
  await addFiles(page, "sample.zip");
  const card = page.getByTestId("result-card").filter({ hasText: "photos/a.png" });
  await expectDone(card);
  await card.getByTestId("result-compare").click();

  const before = page
    .getByTestId("compare-stage")
    .getByRole("img", { name: "Before", exact: true });
  await expect(before).toBeVisible();
  await expect
    .poll(() => before.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0))
    .toBe(true);
  const bytes = await before.evaluate(async (img: HTMLImageElement): Promise<number[]> => {
    const response = await fetch(img.src);
    const buffer = await response.arrayBuffer();
    return Array.from(new Uint8Array(buffer));
  });
  expect(new Uint8Array(bytes)).toEqual(
    unzipSync(new Uint8Array(readFileSync(fixture("sample.zip"))))["photos/a.png"],
  );

  await page.keyboard.press("Escape");
  await card.getByTestId("result-compare").click();
  await expect(before).toBeVisible();
  await expect
    .poll(() => before.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0))
    .toBe(true);
});

test("GIF の比較は処理前後ともアニメーションのデータを表示する", async ({ page }) => {
  await page.goto("/image-adjust/en/compress/gif/");
  await addFiles(page, "animated.gif");
  const card = page.getByTestId("result-card").first();
  await expectDone(card);
  await card.getByTestId("result-compare").click();
  const stage = page.getByTestId("compare-stage");
  await expect(stage.locator("img")).toHaveCount(2);
  for (const name of ["Before", "After"]) {
    const image = stage.getByRole("img", { name, exact: true });
    await expect
      .poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0))
      .toBe(true);
    const bytes = await image.evaluate(async (img: HTMLImageElement): Promise<number[]> => {
      const response = await fetch(img.src);
      const buffer = await response.arrayBuffer();
      return Array.from(new Uint8Array(buffer));
    });
    expect(readGifInfo(new Uint8Array(bytes))).toMatchObject({ frames: 4, animated: true });
  }
  await expect(page.getByRole("radiogroup", { name: "Output width" })).toHaveCount(0);
});

test("複数幅の比較は最大幅で開き、比較する出力を切り替えられる", async ({ page }) => {
  await page.goto("/image-adjust/en/");
  await chooseOutput(page, "webp");
  await openSettingsIfMobile(page);
  await page.locator("summary:visible").filter({ hasText: "Advanced" }).click();
  await page.getByRole("checkbox", { name: "640px", exact: true }).check();
  await page.getByRole("checkbox", { name: "1280px", exact: true }).check();
  await closeSettingsIfMobile(page);

  // 設定の幅より大きな元画像を用意し、異なる幅の出力を作る
  const png = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1600;
    canvas.height = 800;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("canvas context unavailable");
    context.fillStyle = "#4678ab";
    context.fillRect(0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png").split(",")[1] as string;
  });
  await page
    .getByTestId("file-input")
    .setInputFiles({ name: "wide.png", mimeType: "image/png", buffer: Buffer.from(png, "base64") });
  const card = page.getByTestId("result-card").first();
  await expectDone(card);
  await card.getByTestId("result-compare").click();
  const widths = page.getByRole("radiogroup", { name: "Output width" });
  await expect(widths.getByRole("radio", { name: "1280px", exact: true })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  const after = page.getByTestId("compare-stage").getByRole("img", { name: "After", exact: true });
  await expect.poll(() => after.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(1280);
  await widths.getByRole("radio", { name: "640px", exact: true }).click();
  await expect(widths.getByRole("radio", { name: "640px", exact: true })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await expect.poll(() => after.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(640);
});

test("SVG を最適化でき、プレビューに SVG の blob: URL を出さない", async ({ page }) => {
  await page.goto("/image-adjust/compress/svg/");
  await addFiles(page, "sample.svg", "script.svg");
  const cards = page.getByTestId("result-card");
  await expect(cards).toHaveCount(2);
  await expectDone(cards.nth(0));
  await expectDone(cards.nth(1));
  await expect(cards.nth(0).getByTestId("reduction")).toContainText(/削減|smaller/);

  // サムネイルが出てから確認する
  await expect(cards.nth(0).locator("img")).toBeVisible();
  await expect(cards.nth(1).locator("img")).toBeVisible();
  await expectNoSvgBlobInDom(page);
  expect(
    await page.evaluate(() => (window as { __svgScriptRan?: boolean }).__svgScriptRan),
  ).toBeUndefined();

  // 比較表示でも同じ
  await cards.nth(1).getByTestId("result-compare").click();
  await expect(page.getByTestId("compare-stage").locator("img")).toHaveCount(2);
  await expectNoSvgBlobInDom(page);
  await page.keyboard.press("Escape");

  const downloadPromise = page.waitForEvent("download");
  await cards.nth(0).getByTestId("result-save").click();
  const text = new TextDecoder().decode(await downloadBytes(await downloadPromise));
  expect(text).toContain("<svg");
  expect(text).not.toContain("<!--");
  expect(text).not.toContain("inkscape");
});

test("目標サイズ指定で上限以下に圧縮される", async ({ page }) => {
  await page.goto("/image-adjust/compress/jpeg/");
  await openSettingsIfMobile(page);
  await page.locator("[data-testid=mode-target]:visible").click();
  await page.locator("[data-testid=target-kb]:visible").fill("4");
  // 目標サイズは Enter / blur で確定する
  await page.keyboard.press("Enter");
  await closeSettingsIfMobile(page);
  await addFiles(page, "sample.jpg");
  const card = page.getByTestId("result-card").first();
  await expectDone(card);

  const downloadPromise = page.waitForEvent("download");
  await card.getByTestId("result-save").click();
  const bytes = await downloadBytes(await downloadPromise);
  expect(detectFormat(bytes)).toBe("jpeg");
  expect(bytes.byteLength).toBeLessThanOrEqual(4 * 1024);
});

test("変換ページは出力形式の初期値と FAQ の JSON-LD を持つ", async ({ page }) => {
  await page.goto("/image-adjust/en/convert/jpeg-to-png/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Convert JPEG to PNG");
  const ld = await page.locator('script[type="application/ld+json"]').allTextContents();
  expect(ld.some((s) => s.includes('"FAQPage"'))).toBe(true);
  await addFiles(page, "sample.jpg");
  const card = page.getByTestId("result-card").first();
  await expectDone(card);
  const downloadPromise = page.waitForEvent("download");
  await card.getByTestId("result-save").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("sample.png");
  expect(detectFormat(await downloadBytes(download))).toBe("png");
});
