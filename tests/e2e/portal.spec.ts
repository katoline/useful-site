import { expect, type Page, test } from "@playwright/test";

const isMobile = (page: Page) => (page.viewportSize()?.width ?? 1280) < 768;

test("ポータルの日英ページから画像ツールを開ける", async ({ page }) => {
  for (const [path, heading, appPath, appName] of [
    ["/", "便利ツール集", "/image-adjust/", "画像の変換・圧縮"],
    ["/en/", "Handy Tools", "/image-adjust/en/", "Image Converter & Compressor"],
  ] as const) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading);
    await expect(page.getByRole("main").getByRole("link", { name: appName })).toHaveAttribute(
      "href",
      appPath,
    );
    await expect(page.locator('link[rel="manifest"]')).toHaveCount(0);
  }
});

test("共通メニューがポータルとアプリの間を日英で移動し、Escapeで閉じる", async ({ page }) => {
  for (const [path, appPath, siteName, appName] of [
    ["/", "/image-adjust/", "便利ツール集", "画像の変換・圧縮"],
    ["/en/", "/image-adjust/en/", "Handy Tools", "Image Converter & Compressor"],
  ] as const) {
    await page.goto(path);
    await page.evaluate(() => {
      (window as { __portalMarker?: boolean }).__portalMarker = true;
    });
    if (isMobile(page)) {
      // スマホはハンバーガーのシート
      const trigger = page.getByTestId("mobile-menu-button");
      await expect(trigger).toBeVisible();
      await trigger.click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      for (let i = 0; i < 15; i++) {
        await page.keyboard.press("Tab");
        await expect
          .poll(() => dialog.evaluate((element) => element.contains(document.activeElement)))
          .toBe(true);
      }
      await dialog.getByRole("link", { name: appName, exact: true }).click();
      await expect(page).toHaveURL(appPath);
      await expect(page.getByRole("dialog")).toHaveCount(0);
      expect(
        await page.evaluate(() => (window as { __portalMarker?: boolean }).__portalMarker),
      ).toBe(true);
      await trigger.click();
      await expect(
        page.getByRole("dialog").getByRole("link", { name: appName, exact: true }),
      ).toHaveAttribute("aria-current", "page");
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(trigger).toBeFocused();
      await trigger.click();
      await page.getByRole("dialog").getByRole("link", { name: siteName, exact: true }).click();
    } else {
      // PC はヘッダーの「ツール一覧」とサイト名のリンク（ハンバーガーは出さない）
      await expect(page.getByTestId("mobile-menu-button")).toBeHidden();
      await page.getByTestId("apps-menu").click();
      await page.getByRole("menu").getByRole("menuitem", { name: appName, exact: true }).click();
      await expect(page).toHaveURL(appPath);
      await expect(page.getByRole("menu")).toHaveCount(0);
      expect(
        await page.evaluate(() => (window as { __portalMarker?: boolean }).__portalMarker),
      ).toBe(true);
      await page.getByTestId("apps-menu").click();
      await expect(
        page.getByRole("menu").getByRole("menuitem", { name: appName, exact: true }),
      ).toHaveAttribute("aria-current", "page");
      await page.keyboard.press("Escape");
      await expect(page.getByRole("menu")).toHaveCount(0);
      await expect(page.getByTestId("apps-menu")).toBeFocused();
      await page.getByTestId("site-home").click();
    }
    await expect(page).toHaveURL(path);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(siteName);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
});

test("ポータルのJSON-LDはWebSiteと登録簿のItemListを含む", async ({ page }) => {
  await page.goto("/en/");
  const data = await page.locator('script[type="application/ld+json"]').allTextContents();
  const nodes = data.map((text) => JSON.parse(text));
  expect(nodes.some((node) => node["@type"] === "WebSite" && node.name === "Handy Tools")).toBe(
    true,
  );
  const list = nodes.find((node) => node["@type"] === "ItemList");
  expect(list.itemListElement).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        name: "Image Converter & Compressor",
        url: expect.stringMatching(/\/image-adjust\/en\/$/),
      }),
    ]),
  );
});
