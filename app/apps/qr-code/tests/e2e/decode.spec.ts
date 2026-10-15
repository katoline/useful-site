/**
 * 生成した QR を、実際に保存したファイルから独立デコーダー jsQR で復号する。
 * PNG も SVG もブラウザの Image / Canvas でラスタライズし、RGBA を Node へ戻して検証する
 * （アプリの生成ロジックをなぞらない独立した確認）。
 */
import { expect, test } from "@playwright/test";
import {
  decodeSavedPng,
  decodeSavedSvg,
  download,
  makePng,
  readPngSize,
  waitForReady,
} from "./helpers";

const CASES = [
  { name: "通常の URL", url: "https://example.com/", icon: null, size: 512, raster: 512 },
  {
    name: "日本語を含む URL",
    url: "https://ja.wikipedia.org/wiki/日本語",
    icon: "globe",
    size: 512,
    raster: 512,
  },
  {
    name: "長い URL",
    url: `https://example.com/search?q=${"keyword+".repeat(40)}`,
    icon: "link",
    size: 1024,
    raster: 1024,
  },
] as const;

/**
 * 998 バイト（UTF-8）ちょうどの日本語 URL。
 * `https://example.com/`（20 バイト）＋ 日本語 326 文字 × 3 バイト = 998 バイト。
 * 正規化（パーセントエンコード）すると 3000 バイト近くになり、上限も QR の容量も超える。
 * 入力をそのまま符号化できているかを PNG 1024px / SVG の実復号で確かめる。
 */
const JAPANESE_998_BYTE_URL = `https://example.com/${"日".repeat(326)}`;

test("998 バイトの日本語 URL を正規化せずそのまま復号できる", async ({ page }) => {
  await page.goto("/qr-code/en/");
  await page.getByTestId("qr-url").fill(JAPANESE_998_BYTE_URL);
  await page.getByTestId("qr-size-1024").click();
  await waitForReady(page);

  const png = await download(page, "qr-save-png");
  expect(await decodeSavedPng(page, png, 1024)).toBe(JAPANESE_998_BYTE_URL);
  const svg = await download(page, "qr-save-svg");
  expect(await decodeSavedSvg(page, svg, 1024)).toBe(JAPANESE_998_BYTE_URL);
});

for (const testCase of CASES) {
  test(`保存した PNG と SVG を復号できる（${testCase.name}）`, async ({ page }, testInfo) => {
    await page.goto("/qr-code/en/");
    await page.getByTestId("qr-url").fill(testCase.url);
    if (testCase.icon) {
      await page.getByTestId("icon-tab-generic").click();
      await page.getByTestId(`icon-option-${testCase.icon}`).click();
    }
    await page.getByTestId(`qr-size-${testCase.size}`).click();
    await waitForReady(page);
    await page.screenshot({ path: testInfo.outputPath(`preview-${testCase.size}.png`) });

    const png = await download(page, "qr-save-png");
    expect(await decodeSavedPng(page, png, testCase.raster)).toBe(testCase.url);
    const svg = await download(page, "qr-save-svg");
    expect(await decodeSavedSvg(page, svg, testCase.raster)).toBe(testCase.url);
  });
}

test("複数の組込アイコンを合成しても復号できる", async ({ page }) => {
  const url = "https://example.com/icons";
  await page.goto("/qr-code/en/");
  await page.getByTestId("qr-url").fill(url);

  await page.getByTestId("icon-tab-generic").click();
  for (const id of ["link", "heart", "mail", "camera", "map-pin"]) {
    await page.getByTestId(`icon-option-${id}`).click();
    await waitForReady(page);
    const png = await download(page, "qr-save-png");
    expect(await decodeSavedPng(page, png, 512), id).toBe(url);
  }

  await page.getByTestId("icon-tab-brand").click();
  for (const id of ["github", "youtube"]) {
    await page.getByTestId(`icon-option-${id}`).click();
    await waitForReady(page);
    const svg = await download(page, "qr-save-svg");
    expect(await decodeSavedSvg(page, svg, 512), id).toBe(url);
  }
});

test("アップロード画像を合成しても復号できる", async ({ page }) => {
  const url = "https://example.com/upload";
  await page.goto("/qr-code/en/");
  await page.getByTestId("qr-url").fill(url);
  await page.getByTestId("icon-tab-upload").click();
  await page.getByTestId("icon-upload").setInputFiles({
    name: "icon.png",
    mimeType: "image/png",
    buffer: makePng(64),
  });
  await waitForReady(page);

  const png = await download(page, "qr-save-png");
  expect(await decodeSavedPng(page, png, 512)).toBe(url);
  const svg = await download(page, "qr-save-svg");
  expect(await decodeSavedSvg(page, svg, 512)).toBe(url);
});

test("上限（PNG 2048px・アイコン 20%）でも復号できる", async ({ page }, testInfo) => {
  const url = "https://example.com/max";
  await page.goto("/qr-code/en/");
  await page.getByTestId("qr-url").fill(url);
  await page.getByTestId("icon-tab-brand").click();
  await page.getByTestId("icon-option-x").click();

  await page.getByTestId("qr-icon-size").getByRole("slider").press("End");
  await expect(page.getByTestId("qr-icon-size-value")).toContainText("20");
  await page.getByTestId("qr-size-2048").click();
  await waitForReady(page);
  await page.screenshot({ path: testInfo.outputPath("max-preview.png") });

  const png = await download(page, "qr-save-png");
  expect(await readPngSize(png)).toEqual({ width: 2048, height: 2048 });
  expect(await decodeSavedPng(page, png, 2048)).toBe(url);
  const svg = await download(page, "qr-save-svg");
  expect(await decodeSavedSvg(page, svg, 2048)).toBe(url);
});

test("大きさが足りないときは案内が出て PNG だけ保存できない", async ({ page }) => {
  const url = `https://example.com/${"a".repeat(280)}`;
  await page.goto("/qr-code/en/");
  await page.getByTestId("qr-url").fill(url);
  await page.getByTestId("qr-size-256").click();
  await waitForReady(page);

  await expect(page.getByTestId("qr-resolution-hint")).toBeVisible();
  await expect(page.getByTestId("qr-save-png")).toBeDisabled();
  await expect(page.getByTestId("qr-save-svg")).toBeEnabled();

  await page.getByTestId("qr-size-512").click();
  await waitForReady(page);
  await expect(page.getByTestId("qr-resolution-hint")).toHaveCount(0);
  await expect(page.getByTestId("qr-save-png")).toBeEnabled();
});
