import { expect, type Page, test } from "@playwright/test";

const isMobile = (page: Page) => (page.viewportSize()?.width ?? 1280) < 768;

/** テーマを選ぶ（PC はヘッダーのメニュー、スマホはメニュー内のボタン） */
async function chooseTheme(page: Page, theme: "light" | "dark" | "system") {
  if (isMobile(page)) {
    await page.getByTestId("mobile-menu-button").click();
    const labels = { light: /ライト|Light/, dark: /ダーク|Dark/, system: /端末|System/ };
    await page.getByRole("dialog").getByRole("radio", { name: labels[theme] }).click();
    await page.keyboard.press("Escape");
  } else {
    await page.getByTestId("theme-menu").click();
    await page.getByTestId(`theme-${theme}`).click();
  }
}

test("日本語トップがプリレンダリングされて表示される", async ({ page }) => {
  await page.goto("/image-adjust/");
  await expect(page.locator("html")).toHaveAttribute("lang", "ja");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("画像の変換・圧縮ツール");
  await expect(page).toHaveTitle(/画像変換・圧縮ツール/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/image-adjust\/$/);
});

test("英語トップが表示される", async ({ page }) => {
  await page.goto("/image-adjust/en/");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Image Converter & Compressor");
  await expect(page.locator('link[rel="alternate"][hreflang="ja"]')).toHaveAttribute(
    "href",
    /\/image-adjust\/$/,
  );
});

test("JavaScript なしでも本文と meta が入っている", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/image-adjust/en/convert/png-to-webp/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Convert PNG to WebP");
  await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /WebP/);
  await context.close();
});

test("テーマの選択が再読み込み後も保たれ、描画前に適用される", async ({ page }) => {
  // body が作られた時点の data-theme を記録する（ちらつき防止の確認）
  await page.addInitScript(() => {
    const record = () => {
      const w = window as unknown as { __themeAtBody?: string | null };
      if (document.body && w.__themeAtBody === undefined) {
        w.__themeAtBody = document.documentElement.getAttribute("data-theme");
      }
    };
    new MutationObserver(record).observe(document, { childList: true, subtree: true });
  });
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/image-adjust/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

  await chooseTheme(page, "dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(await page.evaluate(() => localStorage.getItem("image-adjust:theme"))).toBe("dark");

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(await page.evaluate(() => (window as { __themeAtBody?: string }).__themeAtBody)).toBe(
    "dark",
  );
  await expect(page.locator('meta[name="theme-color"]').first()).toHaveAttribute(
    "content",
    "#0a0a0a",
  );
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).toBe("rgb(10, 10, 10)");
});

test("端末の設定に従う（既定）では prefers-color-scheme に追従する", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/image-adjust/en/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("言語切り替えは同じページの他言語版へクライアント側で遷移する", async ({ page }) => {
  await page.goto("/image-adjust/about/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("使い方・運営者情報");
  // ページ全体の再読み込みが起きないこと（＝ツールの状態を失わない）を目印で確かめる
  await page.evaluate(() => ((window as { __marker?: number }).__marker = 1));
  if (isMobile(page)) await page.getByTestId("mobile-menu-button").click();
  await page.getByTestId("lang-en").filter({ visible: true }).click();
  await expect(page).toHaveURL(/\/image-adjust\/en\/about\/$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("How to Use & About");
  expect(await page.evaluate(() => (window as { __marker?: number }).__marker)).toBe(1);
  expect(await page.evaluate(() => localStorage.getItem("image-adjust:lang"))).toBe("en");
});

test("ヘッダーのリンクとフッターのリンクがある", async ({ page }) => {
  await page.goto("/image-adjust/en/");
  if (isMobile(page)) {
    await expect(page.getByTestId("mobile-menu-button")).toBeVisible();
    await page.getByTestId("mobile-menu-button").click();
    const menu = page.getByRole("dialog");
    await expect(menu.getByRole("link", { name: "Icon Generator" })).toBeVisible();
    await menu.getByRole("link", { name: "Guides" }).click();
  } else {
    await page.getByRole("banner").getByRole("link", { name: "Guides" }).click();
  }
  await expect(page).toHaveURL(/\/image-adjust\/en\/guide\/$/);
  const footer = page.getByRole("contentinfo");
  await expect(footer.getByRole("link", { name: "Privacy Policy" })).toHaveAttribute(
    "href",
    "/image-adjust/en/privacy/",
  );
});

test("存在しないパスは 404", async ({ page }) => {
  const res = await page.goto("/image-adjust/en/no-such-page/");
  expect(res?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Page not found");
});

test("API の health が応答する", async ({ request }) => {
  const res = await request.get("/image-adjust/api/health");
  expect(res.ok()).toBe(true);
  expect(await res.json()).toEqual({ ok: true });
});

test("ハイドレーションでコンソールエラーが出ない", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (msg) => msg.type() === "error" && errors.push(msg.text()));
  page.on("pageerror", (err) => errors.push(err.message));
  for (const path of ["/image-adjust/", "/image-adjust/en/compress/png/", "/image-adjust/guide/"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
  }
  expect(errors).toEqual([]);
});
