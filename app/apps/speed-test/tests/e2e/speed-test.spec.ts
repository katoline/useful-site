import { expect, test } from "@playwright/test";

// 1 回の測定は 20 秒ほど（Ping・下り 8 秒・上り 8 秒）
test.setTimeout(90_000);

test("ボタンで測定し、結果・目安・履歴を表示する", async ({ page }) => {
  await page.goto("/speed-test/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("回線速度テスト");
  await page.getByTestId("start").click();
  await expect(page.getByTestId("speed-meter")).toBeVisible();
  await expect(page.getByTestId("cancel")).toBeVisible();
  // 下りの測定中は速度が出る
  await expect(page.getByTestId("live-speed")).toHaveText(/\d/, { timeout: 20_000 });

  await expect(page.getByTestId("start")).toHaveText(/もう一度測定/, { timeout: 60_000 });
  for (const id of ["result-download", "result-upload", "result-ping", "result-jitter"]) {
    await expect(page.getByTestId(id)).toHaveText(/\d/);
  }
  await expect(page.getByTestId("result-meta")).toContainText("総合：");
  await expect(page.getByTestId("usage-list").getByRole("listitem")).toHaveCount(7);
  await expect(page.getByTestId("history").locator("tbody tr")).toHaveCount(1);

  // 履歴は再読み込みしても残り、消せる
  await page.reload();
  await expect(page.getByTestId("history").locator("tbody tr")).toHaveCount(1);
  await page.getByRole("button", { name: "履歴を消す" }).click();
  await expect(page.getByTestId("history")).toHaveCount(0);
});

test("測定を中止できる", async ({ page }) => {
  await page.goto("/speed-test/");
  await page.getByTestId("start").click();
  await expect(page.getByTestId("cancel")).toBeVisible();
  await page.getByTestId("cancel").click();
  await expect(page.getByTestId("test-error")).toContainText("中止しました");
  await expect(page.getByTestId("start")).toBeEnabled();
});

test("回数制限にかかったら案内を出す", async ({ page }) => {
  await page.route("**/speed-test/api/info", (route) =>
    route.fulfill({
      status: 429,
      contentType: "application/json",
      body: '{"error":"rate_limited"}',
    }),
  );
  await page.goto("/speed-test/");
  await page.getByTestId("start").click();
  await expect(page.getByTestId("test-error")).toContainText("少し時間をおいて");
});

test("英語版", async ({ page }) => {
  await page.goto("/speed-test/en/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Internet Speed Test");
  await expect(page.getByTestId("start")).toHaveText(/Start test/);
});
