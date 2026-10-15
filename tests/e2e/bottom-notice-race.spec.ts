import { expect, test } from "@playwright/test";

/**
 * ハイドレーション直後に画面下の通知（言語の案内）が初回表示される瞬間と、利用者がフッターのリンクを
 * 押してから離すまでが重なると、離した位置に出た通知のリンクが click を受け取り、リンク先へ移動できない
 * （click は押下と解放の共通祖先に届く）。通知の初回表示を進行中のポインター操作が終わるまで遅らせて
 * 防いでいる（app/platform/shell/pointer-activity.ts）。
 *
 * アプリの JS を page.route で保留して、ハイドレーション前の SSR 表示のままリンクを押し、JS を解放して
 * 押したままハイドレーションを進め、その間に通知が出ないことを確かめてから離す。
 *
 * ハイドレーションの完了は、通知がまだ出ていないことではなく、独立した印で待つ。root の
 * <ScrollRestoration /> が effect で history.scrollRestoration を "manual" にするので、
 * これが変わった時点でハイドレーション後の effect が走ったことが分かる。
 */
test("ハイドレーション中に押したフッターリンクの click を、後から出る言語の案内が奪わない", async ({
  page,
}) => {
  let release!: () => void;
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  // 初回のアプリ JS を保留する（pathname で判定し、クエリの有無に依存しない）
  await page.route(
    (url) => url.pathname.startsWith("/assets/") && url.pathname.endsWith(".js"),
    async (route) => {
      await released;
      await route.continue();
    },
  );

  await page.goto("/image-adjust/", { waitUntil: "commit" });

  const link = page.getByRole("contentinfo").getByRole("link", { name: "外部送信について" });
  await link.scrollIntoViewIfNeeded();
  const box = await link.boundingBox();
  if (!box) throw new Error("フッターのリンクの位置を取得できませんでした");

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  try {
    release();
    // 押したままハイドレーションを進める
    await page.waitForFunction(() => window.history.scrollRestoration === "manual");
    // 通知の再描画（ハイドレーション後の effect）が済むよう、描画フレームを 2 つ進める
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    // 押している間（＝ click がまだ来ていない間）は、言語の案内を出さない
    await expect(page.getByTestId("lang-suggestion")).toHaveCount(0);
  } finally {
    await page.mouse.up();
  }

  // 離した位置はリンクのままなので、click がリンクに届いて移動する
  await expect(page).toHaveURL(/\/privacy\/#external-transmission$/);
  await expect(page.locator("#external-transmission")).toBeVisible();
  // 操作が終わった後は、通知が普通に出る（この設定で案内が出ることの確認）
  await expect(page.getByTestId("lang-suggestion")).toBeVisible();
});
