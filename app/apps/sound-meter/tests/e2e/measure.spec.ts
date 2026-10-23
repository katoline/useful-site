import { expect, test } from "@playwright/test";

// Chromium の偽のマイク（ビープ音を出す）を使い、許可の確認も自動で通す
test.use({
  launchOptions: {
    args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
  },
  permissions: ["microphone"],
});

test("ボタンで計測し、停止すると結果を数値で表示する", async ({ page }) => {
  await page.goto("/sound-meter/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("音響解析");
  // 偽のマイクはビープの合間が無音なので、数値が出るまで待っても終わらない長さにする
  await page.getByTestId("setting-duration").getByRole("radio", { name: "30 秒" }).click();
  await page.getByTestId("start").click();
  await expect(page.getByTestId("stop")).toBeVisible();
  await expect(page.getByTestId("measure-status")).toContainText("残り");
  await expect(page.getByTestId("live-level")).toHaveText(/\d+\.\d/, { timeout: 15_000 });
  await page.getByTestId("stop").click();

  const result = page.getByTestId("result");
  await expect(result).toBeVisible();
  await expect(page.getByTestId("result-leq")).toHaveText(/\d+\.\d\s*dB\(A\)/);
  await expect(page.getByTestId("result-max")).toHaveText(/\d+\.\d/);
  await expect(page.getByTestId("result-bands").getByRole("listitem")).toHaveCount(4);
  await expect(page.getByTestId("start")).toHaveText(/もう一度計測/);

  const download = page.waitForEvent("download");
  await page.getByTestId("save-csv").click();
  expect((await download).suggestedFilename()).toMatch(/^sound-analysis-\d{8}-\d{4}\.csv$/);
});

test("時間が来ると自動で終わり、言語を切り替えても結果が残る", async ({ page }) => {
  await page.goto("/sound-meter/");
  await page.getByTestId("setting-duration").getByRole("radio", { name: "5 秒" }).click();
  await page.getByTestId("start").click();
  await expect(page.getByTestId("result")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("result")).toContainText("5 秒間の計測");

  await page.goto("/sound-meter/en/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Sound Analyzer");
});

test("マイクが許可されないときは案内を出す", async ({ browser }) => {
  const context = await browser.newContext({ permissions: [] });
  const page = await context.newPage();
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () =>
      Promise.reject(new DOMException("denied", "NotAllowedError"));
  });
  await page.goto("/sound-meter/");
  await page.getByTestId("start").click();
  await expect(page.getByTestId("measure-error")).toContainText("許可されていません");
  await context.close();
});

test("補正値は入力の途中で丸めず、欄を離れたら範囲に収める", async ({ page }) => {
  await page.goto("/sound-meter/");
  const input = page.getByTestId("setting-calibration");
  await input.fill("95");
  await expect(input).toHaveValue("95");
  await input.fill("");
  await input.blur();
  await expect(input).toHaveValue("95");
  await input.fill("200");
  await input.press("Enter");
  await expect(input).toHaveValue("140");
  await page.reload();
  await expect(page.getByTestId("setting-calibration")).toHaveValue("140");
});

test.describe("マイクの扱い", () => {
  test.beforeEach(async ({ page }) => {
    // 開いたストリームを数えられるようにする
    await page.addInitScript(() => {
      const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      const streams: MediaStream[] = [];
      Object.assign(window, { __streams: streams });
      navigator.mediaDevices.getUserMedia = async (constraints) => {
        const stream = await original(constraints);
        streams.push(stream);
        return stream;
      };
    });
  });
  const streamCount = () => window.__streams.length;

  test("ボタンを連打してもマイクは 1 回だけ開く", async ({ page }) => {
    await page.goto("/sound-meter/");
    await page.getByTestId("start").dblclick();
    await expect(page.getByTestId("stop")).toBeVisible();
    await page.waitForTimeout(500);
    expect(await page.evaluate(streamCount)).toBe(1);
  });

  test("マイクが途中で切れたら、そこで計測を終える", async ({ page }) => {
    await page.goto("/sound-meter/");
    await page.getByTestId("setting-duration").getByRole("radio", { name: "60 秒" }).click();
    await page.getByTestId("start").click();
    await expect(page.getByTestId("stop")).toBeVisible();
    await page.waitForTimeout(1500);
    await page.evaluate(() => {
      for (const stream of window.__streams) for (const track of stream.getTracks()) track.stop();
    });
    await expect(page.getByTestId("result")).toBeVisible({ timeout: 5_000 });
  });
});

declare global {
  interface Window {
    __streams: MediaStream[];
  }
}
