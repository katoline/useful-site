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
  expect(await page.evaluate(() => localStorage.getItem("site:theme"))).toBe("dark");

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
  else await page.getByTestId("lang-menu").click();
  await page.getByTestId("lang-en").filter({ visible: true }).click();
  await expect(page).toHaveURL(/\/image-adjust\/en\/about\/$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("How to Use & About");
  expect(await page.evaluate(() => (window as { __marker?: number }).__marker)).toBe(1);
  expect(await page.evaluate(() => localStorage.getItem("site:lang"))).toBe("en");
});

test("ヘッダーのロゴのマークは読み上げず、テーマで白黒が反転する", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/image-adjust/");
  const logo = page.getByTestId("logo");
  // リンク名はサイト名だけ（マークは読み上げない）
  await expect(logo).toHaveAccessibleName("画像の変換・圧縮");
  const mark = logo.getByTestId("logo-mark");
  await expect(mark).toHaveAttribute("aria-hidden", "true");
  const box = await mark.boundingBox();
  expect(box?.width).toBe(24);
  expect(box?.height).toBe(24);

  const colors = () =>
    mark.evaluate((svg) => ({
      tile: getComputedStyle(svg.querySelector("rect") as Element).fill,
      glyph: getComputedStyle(svg.querySelector("path") as Element).fill,
    }));
  expect(await colors()).toEqual({ tile: "rgb(10, 10, 10)", glyph: "rgb(255, 255, 255)" });
  await chooseTheme(page, "dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect.poll(colors).toEqual({ tile: "rgb(250, 250, 250)", glyph: "rgb(10, 10, 10)" });
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
    // アプリ内のページはヘッダーの直下のタブにある
    const tabs = page.getByRole("navigation", { name: "Pages in this app" });
    await expect(tabs.getByRole("link", { name: "Guides" })).toBeVisible();
    await tabs.getByRole("link", { name: "Guides" }).click();
  }
  await expect(page).toHaveURL(/\/image-adjust\/en\/guide\/$/);
  const footer = page.getByRole("contentinfo");
  await expect(footer.getByRole("link", { name: /Privacy policy/i })).toHaveAttribute(
    "href",
    "/en/privacy/",
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

/** コンソールエラーと例外を集める。404 の文書そのものの読み込み失敗（Failed to load resource）は除く */
function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const isDocument404 = msg.text().includes("status of 404") && msg.location().url === page.url();
    if (!isDocument404) errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(err.message));
  return errors;
}

test("存在しない URL は共通 404 で、ハイドレーションでエラーが出ない", async ({ page }) => {
  const errors = collectErrors(page);
  for (const [path, heading] of [
    ["/no-such-page/", "ページが見つかりません"],
    ["/en/no-such-page/", "Page not found"],
    ["/image-adjust/convert/bogus/", "ページが見つかりません"],
    ["/image-adjust/en/guide/bogus/", "Page not found"],
  ] as const) {
    const res = await page.goto(path);
    expect(res?.status()).toBe(404);
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading);
  }
  expect(errors).toEqual([]);
});

test("変換の入口ページが表示され、ハイドレーションでエラーが出ない", async ({ page }) => {
  const errors = collectErrors(page);
  const res = await page.goto("/image-adjust/convert/png-to-webp/");
  expect(res?.status()).toBe(200);
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("PNG を WebP に変換");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    /\/image-adjust\/convert\/png-to-webp\/$/,
  );
  // 言語切り替えも同じ変換方向の英語版に行く
  if (isMobile(page)) await page.getByTestId("mobile-menu-button").click();
  else await page.getByTestId("lang-menu").click();
  await page.getByTestId("lang-en").filter({ visible: true }).click();
  await expect(page).toHaveURL(/\/image-adjust\/en\/convert\/png-to-webp\/$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Convert PNG to WebP");
  expect(errors).toEqual([]);
});

test.describe("英語ロケールで日本語ページを開く", () => {
  test.use({ locale: "en-US" });

  test("言語の案内は出てもヘッダーの位置が変わらず、操作バーと重ならない", async ({ page }) => {
    const headerTop = () =>
      page.getByRole("banner").evaluate((el) => el.getBoundingClientRect().top + window.scrollY);

    await page.goto("/image-adjust/");
    const suggestion = page.getByTestId("lang-suggestion");
    await expect(suggestion).toBeVisible();
    expect(await headerTop()).toBe(0);
    // 案内は画面下に重ねて出す（ページの流れに入らない）
    const viewport = page.viewportSize();
    const box = await suggestion.boundingBox();
    expect(box && viewport && box.y > viewport.height / 2).toBe(true);
    expect(box && viewport && box.y + box.height <= viewport.height).toBe(true);

    // ツール画面（スマホは下固定の操作バーがある）でも、案内はその上に出る
    await page.goto("/image-adjust/convert/png-to-webp/");
    await expect(suggestion).toBeVisible();
    expect(await headerTop()).toBe(0);
    if (isMobile(page)) {
      const bar = await page.locator("[data-mobile-action-bar]").boundingBox();
      const s = await suggestion.boundingBox();
      expect(bar && s && s.y + s.height <= bar.y).toBe(true);
    }
  });

  test("言語の案内と PWA の通知は縦に積まれ、両方のボタンが押せる", async ({ page }) => {
    // 「このアプリで開く」（launchQueue）を偽装して、受け取り件数の通知を出す
    await page.addInitScript(() => {
      const file = new File([new Uint8Array([0])], "launched.png", { type: "image/png" });
      type Consumer = (params: { files: { getFile(): Promise<File> }[] }) => void;
      // Chromium には読み取り専用の launchQueue があるので、代入ではなく定義し直す
      Object.defineProperty(window, "launchQueue", {
        configurable: true,
        value: {
          setConsumer(consumer: Consumer) {
            setTimeout(() => consumer({ files: [{ getFile: async () => file }] }), 0);
          },
        },
      });
    });
    await page.goto("/image-adjust/convert/png-to-webp/");
    const suggestion = page.getByTestId("lang-suggestion");
    const received = page.getByTestId("pwa-received");
    await expect(suggestion).toBeVisible();
    await expect(received).toBeVisible();

    // 重ならない（縦に積まれる）
    const a = await suggestion.boundingBox();
    const b = await received.boundingBox();
    expect(a && b && (a.y + a.height <= b.y || b.y + b.height <= a.y)).toBe(true);
    // スマホでは下固定の操作バーより上に出る
    if (isMobile(page)) {
      const bar = await page.locator("[data-mobile-action-bar]").boundingBox();
      const notices = await page.getByTestId("bottom-notices").boundingBox();
      expect(bar && notices && notices.y + notices.height <= bar.y).toBe(true);
    }
    // 出ている間は、通知の実際の高さ以上の余白が body の下に付く
    const padding = () =>
      page.evaluate(() => Number.parseFloat(getComputedStyle(document.body).paddingBottom));
    const noticesHeight = (await page.getByTestId("bottom-notices").boundingBox())?.height ?? 0;
    expect(await padding()).toBeGreaterThanOrEqual(noticesHeight);

    // 両方のボタンが押せる（他の要素に遮られていればクリックが失敗する）
    await received.getByTestId("pwa-received-dismiss").click();
    await expect(received).toHaveCount(0);
    await suggestion.getByRole("link").click({ trial: true });
    await suggestion.getByRole("button").click();
    await expect(suggestion).toHaveCount(0);
    // 何も出ていなければ余白も無くなる
    await expect.poll(padding).toBe(0);
  });
});
