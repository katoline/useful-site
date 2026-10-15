import { expect, test } from "@playwright/test";
import { download, isMobile, makePng, switchToEnglish, waitForReady } from "./helpers";

const URL = "https://example.com/hello";

test("日本語と英語のページが表示され、言語を切り替えられる", async ({ page }) => {
  await page.goto("/qr-code/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("QRコード生成");
  await switchToEnglish(page);
  await expect(page).toHaveURL(/\/qr-code\/en\/$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("QR Code Generator");
});

test("空欄では案内が出て、無効な URL ではエラーになり、直すとプレビューが出る", async ({
  page,
}) => {
  await page.goto("/qr-code/");
  await expect(page.getByTestId("qr-empty")).toBeVisible();
  await expect(page.getByTestId("qr-save-png")).toBeDisabled();

  const input = page.getByTestId("qr-url");
  await input.fill("ftp://example.com/");
  await expect(page.getByTestId("qr-url-error")).toBeVisible();
  await expect(page.getByTestId("qr-empty")).toHaveCount(0);
  await expect(page.getByTestId("qr-save-svg")).toBeDisabled();

  await input.fill(URL);
  await expect(page.getByTestId("qr-url-error")).toHaveCount(0);
  await waitForReady(page);
  await expect(page.getByTestId("qr-save-png")).toBeEnabled();
});

test("言語を切り替えても URL と設定・アイコンの選択が残る", async ({ page }) => {
  await page.goto("/qr-code/");
  await page.getByTestId("qr-url").fill(URL);
  await page.getByTestId("qr-color-navy").click();
  await page.getByTestId("icon-tab-generic").click();
  await page.getByTestId("icon-option-heart").click();
  await waitForReady(page);

  await switchToEnglish(page);
  await expect(page).toHaveURL(/\/qr-code\/en\/$/);
  await expect(page.getByTestId("qr-url")).toHaveValue(URL);
  await expect(page.getByTestId("qr-color-navy")).toHaveAttribute("aria-pressed", "true");
  // 選択中の組込アイコンが見えるタブへ復元される（アイコンなしタブに化けない）
  await expect(page.getByTestId("icon-tab-generic")).toHaveAttribute("data-state", "active");
  await expect(page.getByTestId("icon-option-heart")).toHaveAttribute("aria-pressed", "true");
  await waitForReady(page);
});

test("ブランドのロゴを選んでから言語を切り替えても選択と表示が残る", async ({ page }) => {
  await page.goto("/qr-code/");
  await page.getByTestId("qr-url").fill(URL);
  await page.getByTestId("icon-tab-brand").click();
  await page.getByTestId("icon-option-github").click();
  await waitForReady(page);

  await switchToEnglish(page);
  await expect(page.getByTestId("icon-tab-brand")).toHaveAttribute("data-state", "active");
  await expect(page.getByTestId("icon-option-github")).toHaveAttribute("aria-pressed", "true");
});

test("アイコンの読み込みに失敗したら保存できず、復旧すると再び保存できる", async ({ page }) => {
  await page.goto("/qr-code/");
  await page.getByTestId("qr-url").fill(URL);
  await page.getByTestId("icon-tab-generic").click();
  await page.getByTestId("icon-option-heart").click();
  await waitForReady(page);
  await expect(page.getByTestId("qr-save-png")).toBeEnabled();

  // 未対応の画像を選ぶとエラーになり、古い結果でも PNG・SVG とも保存できない
  const badFile = { name: "bad.svg", mimeType: "image/svg+xml", buffer: Buffer.from("<svg/>") };
  await page.getByTestId("icon-tab-upload").click();
  await page.getByTestId("icon-upload").setInputFiles(badFile);
  await expect(page.getByTestId("icon-error")).toBeVisible();
  await expect(page.getByTestId("qr-icon-blocked")).toBeVisible();
  await expect(page.getByTestId("qr-save-png")).toBeDisabled();
  await expect(page.getByTestId("qr-save-svg")).toBeDisabled();

  // エラーを閉じれば、元の選択のまま再び保存できる
  await page.getByTestId("icon-error").getByRole("button").click();
  await expect(page.getByTestId("icon-error")).toHaveCount(0);
  await waitForReady(page);
  await expect(page.getByTestId("qr-save-png")).toBeEnabled();

  // アイコンなしへ切り替えても復旧する
  await page.getByTestId("icon-upload").setInputFiles(badFile);
  await expect(page.getByTestId("qr-save-svg")).toBeDisabled();
  await page.getByTestId("icon-tab-none").click();
  await page.getByTestId("icon-none").click();
  await waitForReady(page);
  await expect(page.getByTestId("qr-save-svg")).toBeEnabled();
});

test("自分の画像をアイコンにしてプレビューと保存ができる", async ({ page }, testInfo) => {
  await page.goto("/qr-code/en/");
  await page.getByTestId("qr-url").fill(URL);
  await page.getByTestId("icon-tab-upload").click();
  await page.getByTestId("icon-upload").setInputFiles({
    name: "icon.png",
    mimeType: "image/png",
    buffer: makePng(64),
  });
  await waitForReady(page);
  await expect(page.getByTestId("icon-remove")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("upload-preview.png") });

  const png = await download(page, "qr-save-png");
  expect(png.suggestedFilename()).toBe("example.com.png");
  const svg = await download(page, "qr-save-svg");
  expect(svg.suggestedFilename()).toBe("example.com.svg");
});

test("レイアウトは PC が2列、スマホが1列で、保存ボタンは 44px 以上", async ({ page }) => {
  await page.goto("/qr-code/");
  const settings = await page.getByTestId("qr-settings").boundingBox();
  const result = await page.getByTestId("qr-result").boundingBox();
  expect(settings).not.toBeNull();
  expect(result).not.toBeNull();

  if (isMobile(page)) {
    expect(result?.y ?? 0).toBeGreaterThan((settings?.y ?? 0) + (settings?.height ?? 0) - 1);
  } else {
    expect(result?.x ?? 0).toBeGreaterThan(settings?.x ?? 0);
  }

  const button = await page.getByTestId("qr-save-svg").boundingBox();
  expect(button?.height ?? 0).toBeGreaterThanOrEqual(44);
});
