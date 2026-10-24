import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, test } from "@playwright/test";

/** 偽のマイクに入れる音：440Hz の正弦波（-12dBFS、1 秒をくり返す）のモノラル 16bit WAV */
function writeToneWav(): string {
  const sampleRate = 48000;
  const samples = sampleRate;
  const data = Buffer.alloc(samples * 2);
  for (let i = 0; i < samples; i++) {
    data.writeInt16LE(
      Math.round(0.25 * 32767 * Math.sin((2 * Math.PI * 440 * i) / sampleRate)),
      i * 2,
    );
  }
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVEfmt ", 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // モノラル
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(data.length, 40);
  const dir = path.join(tmpdir(), "sound-meter-e2e");
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "tone-440.wav");
  writeFileSync(file, Buffer.concat([header, data]));
  return file;
}

// Chromium の偽のマイクを使い、許可の確認も自動で通す。既定のビープは鳴り始めるまでに数秒かかり、
// 遅い CI では待っている間に一度も鳴らないことがあるので、鳴り続ける音のファイルを入れる
test.use({
  launchOptions: {
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      `--use-file-for-fake-audio-capture=${writeToneWav()}`,
    ],
  },
  permissions: ["microphone"],
});

test("ボタンで計測し、停止すると結果を数値で表示する", async ({ page }) => {
  await page.goto("/sound-meter/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("騒音計");
  // 遅い環境でも数値が出る前に終わらない長さにする
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
  // 入れた音は 440Hz（A4）
  await expect(page.getByTestId("result-dominant")).toHaveText(/^4[34]\d Hz/);
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
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Sound Level Meter");
});

test("重み付けなし（Z）では、入れた音の実効値どおりの値になる", async ({ page }) => {
  await page.goto("/sound-meter/");
  await page.getByTestId("setting-duration").getByRole("radio", { name: "5 秒" }).click();
  await page.getByTestId("setting-frequency-weighting").getByRole("radio", { name: "Z" }).click();
  await page.getByTestId("start").click();
  await expect(page.getByTestId("result")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("result-weighting")).toContainText("Z");
  // 振幅 0.25 の正弦波の実効値は -15.05dBFS。パソコン（iOS 以外）の既定の補正値 +100 で 85.0dB(Z)
  const text = (await page.getByTestId("result-leq").textContent()) ?? "";
  expect(text).toMatch(/dB\(Z\)/);
  const value = Number.parseFloat(text);
  expect(value).toBeGreaterThan(84);
  expect(value).toBeLessThan(86);
  // 変わらない音なので、最大は平均とほぼ同じ（マイクの準備中の無音から音が届いた瞬間の揺れを数えない）
  const max = Number.parseFloat((await page.getByTestId("result-max").textContent()) ?? "");
  expect(Math.abs(max - value)).toBeLessThan(0.5);
});

test("基準の値に合わせると、平均がその値になり、補正値が保存される", async ({ page }) => {
  await page.goto("/sound-meter/");
  await page.getByTestId("setting-duration").getByRole("radio", { name: "5 秒" }).click();
  await page.getByTestId("start").click();
  await expect(page.getByTestId("result")).toBeVisible({ timeout: 15_000 });
  await page.getByTestId("reference-value").fill("42");
  await page.getByTestId("reference-apply").click();
  await expect(page.getByTestId("result-leq")).toHaveText(/^42\.0\s*dB\(A\)/);
  const calibration = await page.getByTestId("setting-calibration").inputValue();
  expect(calibration).not.toBe("100");
  await page.reload();
  await expect(page.getByTestId("setting-calibration")).toHaveValue(calibration);
  await page.getByTestId("setting-calibration-reset").click();
  await expect(page.getByTestId("setting-calibration")).toHaveValue("100");
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
