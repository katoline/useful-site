import { expect, type Page, test } from "@playwright/test";

/**
 * Service Worker が有効になり、このページを制御するまで待つ。
 * controllerchange は待ち始める前に来ていることがあるので、イベントではなく状態をポーリングする
 */
async function waitForServiceWorker(page: Page) {
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  return page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    return { scope: reg.scope, script: reg.active?.scriptURL ?? "" };
  });
}

/**
 * フォームを送信する。スマホ表示では画面下の固定バーがボタンに重なるので、
 * 座標でクリックせず DOM の click を送る
 */
async function submitShareForm(page: Page) {
  await page.locator("#share-form button").dispatchEvent("click");
}

/**
 * 他サイトに見立てるホスト名。Chromium の名前解決で localhost に向ける。
 * 127.0.0.1 を直接使うと、preview が IPv6（::1）だけで待ち受ける環境（GitHub のランナー等）で接続できない。
 * localhost と同じ先に繋がりつつ、サイトとしては別（Sec-Fetch-Site: cross-site）になる
 */
const FOREIGN_HOST = "foreign.test";
test.use({ launchOptions: { args: [`--host-resolver-rules=MAP ${FOREIGN_HOST} localhost`] } });

/** 1×1 の PNG */
const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

test("Service Worker は /image-adjust/ スコープで登録され、キャッシュ名に接頭辞が付く", async ({
  page,
}) => {
  await page.goto("/image-adjust/");
  const { scope, script } = await waitForServiceWorker(page);
  expect(new URL(scope).pathname).toBe("/image-adjust/");
  expect(new URL(script).pathname).toBe("/image-adjust/sw.js");
  const names = await page.evaluate(() => caches.keys());
  expect(names.length).toBeGreaterThan(0);
  for (const name of names) expect(name).toMatch(/^image-adjust/);
});

test("オフラインでも再読み込みでトップとガイドが表示される", async ({ page, context }) => {
  await page.goto("/image-adjust/");
  await waitForServiceWorker(page);
  await context.setOffline(true);
  try {
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("画像の変換・圧縮ツール");
    await page.goto("/image-adjust/en/guide/image-formats/");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Image Format");
    await page.goto("/image-adjust/guide/favicon-setup/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("ファビコン");
  } finally {
    await context.setOffline(false);
  }
});

test("マニフェストは表示言語に合わせて出し分けられ、id は共通", async ({ page, request }) => {
  await page.goto("/image-adjust/about/");
  const manifest = page.locator('link[rel="manifest"]');
  await expect(manifest).toHaveAttribute("href", "/image-adjust/manifest.ja.webmanifest");
  await page.goto("/image-adjust/en/about/");
  await expect(manifest).toHaveAttribute("href", "/image-adjust/manifest.en.webmanifest");

  const ja = await (await request.get("/image-adjust/manifest.ja.webmanifest")).json();
  const en = await (await request.get("/image-adjust/manifest.en.webmanifest")).json();
  expect(ja.lang).toBe("ja");
  expect(en.lang).toBe("en");
  expect(en.id).toBe(ja.id);
  expect(ja.scope).toBe("/image-adjust/");
  expect(en.start_url).toBe("/image-adjust/en/");
  expect(ja.share_target.action).toBe("/image-adjust/share-target");
  for (const icon of ja.icons as { src: string }[]) {
    expect((await request.get(icon.src)).ok()).toBe(true);
  }
});

test("share-target に multipart で POST した画像が変換画面に渡される", async ({ page }) => {
  await page.goto("/image-adjust/");
  await waitForServiceWorker(page);

  // OS の共有シートの代わりに、同じ形の multipart POST をフォームで送る（SW が受け取る）
  await page.evaluate(() => {
    const form = document.createElement("form");
    form.method = "post";
    form.enctype = "multipart/form-data";
    form.action = "/image-adjust/share-target";
    form.id = "share-form";
    const input = document.createElement("input");
    input.type = "file";
    input.name = "files";
    input.multiple = true;
    const submit = document.createElement("button");
    submit.type = "submit";
    submit.textContent = "share";
    form.append(input, submit);
    document.body.append(form);
  });
  await page.locator("#share-form input").setInputFiles([
    { name: "shared-a.png", mimeType: "image/png", buffer: PNG_1PX },
    { name: "共有 b.png", mimeType: "image/png", buffer: PNG_1PX },
  ]);
  await submitShareForm(page);

  // SW のリダイレクトで変換画面（?share=1）が開く。pushIncomingFiles() で渡ったことを
  // 結果リストのファイル名で確かめる（受け取り件数の表示は数秒で消えるので、残る表示で確かめる）
  await expect(page.getByTestId("result-name")).toHaveText(["shared-a.png", "共有 b.png"]);
  // 取り出した後は ?share=1 も一時保存のキャッシュも消える
  await expect(page).toHaveURL(/\/image-adjust\/$/);
  await expect.poll(() => page.evaluate(() => caches.has("image-adjust:share-target"))).toBe(false);
});

test("他サイトのフォームから share-target に POST されたファイルは受け取らない", async ({
  page,
  baseURL,
}) => {
  await page.goto("/image-adjust/");
  await waitForServiceWorker(page);

  // localhost と FOREIGN_HOST は別サイト。FOREIGN_HOST のページから localhost の share-target に送る
  const target = new URL("/image-adjust/share-target", baseURL).href;
  const foreign = new URL("/image-adjust/api/health", baseURL);
  foreign.hostname = FOREIGN_HOST;
  await page.goto(foreign.href);
  await page.evaluate((action) => {
    const form = document.createElement("form");
    form.method = "post";
    form.enctype = "multipart/form-data";
    form.action = action;
    form.id = "share-form";
    const input = document.createElement("input");
    input.type = "file";
    input.name = "files";
    const submit = document.createElement("button");
    submit.type = "submit";
    submit.textContent = "share";
    form.append(input, submit);
    document.body.append(form);
  }, target);
  await page
    .locator("#share-form input")
    .setInputFiles({ name: "evil.png", mimeType: "image/png", buffer: PNG_1PX });
  await submitShareForm(page);

  // 変換画面は開くが（?share=1 は処理後に消える）、ファイルは渡されない
  // 送信前は FOREIGN_HOST にいるので、localhost の変換画面で ?share=1 が消えた時点が処理の完了
  await page.waitForURL(new URL("/image-adjust/", baseURL).href);
  await expect(page.getByTestId("results-empty")).toBeVisible();
  await expect(page.getByTestId("pwa-received")).toHaveCount(0);
  expect(await page.evaluate(() => caches.has("image-adjust:share-target"))).toBe(false);
});
