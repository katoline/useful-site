import { expect, test } from "@playwright/test";

const PAGES = [
  { path: "guide/image-formats/", article: true },
  { path: "guide/favicon-setup/", article: true },
  { path: "guide/optimize-lp-images/", article: true },
  { path: "about/", article: false },
];

for (const lang of ["ja", "en"] as const) {
  for (const legal of ["privacy", "terms"] as const) {
    test(`${lang} 共通 ${legal} にサイト本文と Image Adjust 固有の節が表示される`, async ({
      page,
      request,
    }) => {
      const path = `${lang === "ja" ? "/" : "/en/"}${legal}/`;
      await page.goto(path);
      await expect(page.locator("html")).toHaveAttribute("lang", lang);
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      await expect(
        page.getByRole("heading", {
          level: 2,
          name: lang === "ja" ? "画像の変換・圧縮" : "Image Converter & Compressor",
          exact: true,
        }),
      ).toBeVisible();
      const specific = page.locator('[data-app-legal="image-adjust"]');
      await expect(specific).toContainText(lang === "ja" ? "画像" : "image");
      if (legal === "privacy") {
        await expect(specific).toContainText("Service Worker");
        await expect(specific).toContainText("Cloudflare");
        await expect(page.locator("#external-transmission")).toBeVisible();
      }
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        "href",
        `https://t0n03k1.com${path}`,
      );
      const removed = await request.get(`/image-adjust/${lang === "en" ? "en/" : ""}${legal}/`);
      expect(removed.status()).toBe(404);
    });
  }
}

for (const lang of ["ja", "en"] as const) {
  const prefix = lang === "ja" ? "/image-adjust/" : "/image-adjust/en/";
  for (const { path, article } of PAGES) {
    test(`${lang} ${path} が本文と JSON-LD 付きで表示される`, async ({ page }) => {
      await page.goto(`${prefix}${path}`);
      await expect(page.locator("html")).toHaveAttribute("lang", lang);
      const h1 = page.getByRole("heading", { level: 1 });
      await expect(h1).toHaveCount(1);
      await expect(page.locator("main h2").first()).toBeVisible();
      const title = (await h1.textContent()) ?? "";
      expect(title.length).toBeGreaterThan(0);
      await expect(page).toHaveTitle(new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

      const jsonLd = await page
        .locator('script[type="application/ld+json"]')
        .evaluateAll((els) => els.map((el) => JSON.parse(el.textContent ?? "{}")["@type"]));
      expect(jsonLd).toContain("BreadcrumbList");
      if (article) expect(jsonLd).toContain("Article");
      // サイト内リンクは表示中の言語・末尾スラッシュ付きに直っている
      for (const href of await page
        .locator("main .prose-content a[href^='/']")
        .evaluateAll((els) => els.map((el) => el.getAttribute("href") ?? ""))) {
        expect(href.startsWith(prefix) || href === `${lang === "ja" ? "/" : "/en/"}privacy/`).toBe(
          true,
        );
      }
    });
  }
}

test("ガイド一覧から記事へ移動できる", async ({ page }) => {
  await page.goto("/image-adjust/en/guide/");
  await page.locator("main").getByRole("link").first().click();
  await expect(page).toHaveURL(/\/image-adjust\/en\/guide\/[a-z-]+\/$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("フッターから外部送信規律の公表事項に移動できる", async ({ page }) => {
  await page.goto("/image-adjust/");
  await page.getByRole("contentinfo").getByRole("link", { name: "外部送信について" }).click();
  await expect(page).toHaveURL(/\/privacy\/#external-transmission$/);
  await expect(page.locator("#external-transmission")).toBeVisible();
});

test("sitemap.xml は各 sitemap の索引で、アプリ・規約類の URL が載る", async ({ request }) => {
  const index = await request.get("/sitemap.xml");
  expect(index.ok()).toBe(true);
  const indexXml = await index.text();
  expect(indexXml).toContain("<sitemapindex");
  expect(indexXml).toContain("/image-adjust/sitemap.xml</loc>");
  expect(indexXml).toContain("/sitemaps/site.xml</loc>");

  const app = await request.get("/image-adjust/sitemap.xml");
  expect(app.ok()).toBe(true);
  const appXml = await app.text();
  expect(appXml).toContain("/image-adjust/en/guide/favicon-setup/</loc>");
  expect(appXml).toContain('hreflang="x-default"');

  const site = await request.get("/sitemaps/site.xml");
  expect(site.ok()).toBe(true);
  const siteXml = await site.text();
  expect(siteXml).toContain("https://t0n03k1.com/privacy/</loc>");
  expect(siteXml).toContain("https://t0n03k1.com/en/terms/</loc>");
});

test("robots.txt が返り、sitemap の索引を指す", async ({ request }) => {
  const res = await request.get("/robots.txt");
  expect(res.ok()).toBe(true);
  expect(res.headers()["content-type"]).toContain("text/plain");
  const body = await res.text();
  expect(body).toContain("User-agent: *");
  expect(body).toMatch(/^Sitemap: https?:\/\/[^/]+\/sitemap\.xml$/m);
});

test("ページに CSP（meta とヘッダーの 2 本立て）が付き、CSP 違反が起きない", async ({ page }) => {
  const violations: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error" && /Content Security Policy/i.test(msg.text())) {
      violations.push(msg.text());
    }
  });
  page.on("pageerror", (err) => violations.push(err.message));
  await page.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (e) => {
      const w = window as unknown as { __csp?: string[] };
      w.__csp = [...(w.__csp ?? []), `${e.violatedDirective} ${e.blockedURI}`];
    });
  });
  for (const path of [
    // ポータル
    "/",
    "/en/",
    // Image Adjust のツール・記事
    "/image-adjust/",
    "/image-adjust/en/convert/png-to-webp/",
    "/image-adjust/guide/image-formats/",
    "/image-adjust/icons/",
    // サイト共通の規約類
    "/privacy/",
    "/en/terms/",
  ]) {
    const res = await page.goto(path);
    // meta では効かない frame-ancestors 等は、_headers のワイルドカードのヘッダーで付く
    // （SW から返したページにも、プリキャッシュ時に保存したヘッダーが付く）
    const header = (await res?.allHeaders())?.["content-security-policy"] ?? "";
    expect(header, path).toContain("frame-ancestors 'none'");
    expect(header, path).not.toContain("script-src");
    // ページごとのハッシュ入りの CSP は head の先頭の meta（スクリプトより前）
    const meta = await page.evaluate(() => {
      const el = document.head.querySelector('meta[http-equiv="Content-Security-Policy"]');
      const firstScript = document.head.querySelector("script");
      return {
        content: el?.getAttribute("content") ?? "",
        beforeScripts:
          !!el &&
          (!firstScript ||
            !!(el.compareDocumentPosition(firstScript) & Node.DOCUMENT_POSITION_FOLLOWING)),
      };
    });
    expect(meta.content, path).toContain("'wasm-unsafe-eval'");
    expect(meta.content, path).toMatch(/'sha256-[A-Za-z0-9+/=]+'/);
    expect(meta.content, path).not.toContain("frame-ancestors");
    expect(meta.beforeScripts, path).toBe(true);
    await page.waitForLoadState("networkidle");
    const seen = await page.evaluate(() => (window as unknown as { __csp?: string[] }).__csp ?? []);
    violations.push(...seen.map((v) => `${path}: ${v}`));
  }
  expect(violations).toEqual([]);
});

test("全ページに言語別の OGP 画像（1200×630）が付く", async ({ page, request }) => {
  for (const [path, lang] of [
    ["/image-adjust/", "ja"],
    ["/image-adjust/en/guide/image-formats/", "en"],
    ["/image-adjust/convert/png-to-webp/", "ja"],
  ] as const) {
    await page.goto(path);
    const image = await page.locator('meta[property="og:image"]').getAttribute("content");
    expect(image).toMatch(new RegExp(`/image-adjust/og/${lang}\\.png$`));
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
      "content",
      "summary_large_image",
    );
    await expect(page.locator('meta[property="og:image:width"]')).toHaveAttribute(
      "content",
      "1200",
    );
    // SITE_ORIGIN は公開先のドメインでテストの配信元（localhost）とは違うので、配信はパスで確かめる
    const res = await request.get(new URL(image ?? "").pathname);
    expect(res.ok()).toBe(true);
    expect(res.headers()["content-type"]).toContain("image/png");
  }
});
