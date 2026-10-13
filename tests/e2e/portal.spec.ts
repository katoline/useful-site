import { expect, test } from "@playwright/test";

test("ポータルの日英ページから Image Adjust を開ける", async ({ page }) => {
  for (const [path, heading, appPath] of [
    ["/", "便利ツール集", "/image-adjust/"],
    ["/en/", "Handy Tools", "/image-adjust/en/"],
  ] as const) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading);
    await expect(
      page.getByRole("main").getByRole("link", { name: "Image Adjust" }),
    ).toHaveAttribute("href", appPath);
    await expect(page.locator('link[rel="manifest"]')).toHaveCount(0);
  }
});

test("共通メニューがポータルとアプリの間を日英で移動し、Escapeで閉じる", async ({ page }) => {
  for (const [path, appPath, siteName] of [
    ["/", "/image-adjust/", "便利ツール集"],
    ["/en/", "/image-adjust/en/", "Handy Tools"],
  ] as const) {
    await page.goto(path);
    await page.evaluate(() => {
      (window as { __portalMarker?: boolean }).__portalMarker = true;
    });
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
    await dialog.getByRole("link", { name: "Image Adjust", exact: true }).click();
    await expect(page).toHaveURL(appPath);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(await page.evaluate(() => (window as { __portalMarker?: boolean }).__portalMarker)).toBe(
      true,
    );
    await trigger.click();
    await expect(
      page.getByRole("dialog").getByRole("link", { name: "Image Adjust", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await trigger.click();
    await page.getByRole("dialog").getByRole("link", { name: siteName, exact: true }).click();
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
        name: "Image Adjust",
        url: expect.stringMatching(/\/image-adjust\/en\/$/),
      }),
    ]),
  );
});
