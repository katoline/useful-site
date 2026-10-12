import { expect, test } from "@playwright/test";

const PAGES = [
  { path: "guide/image-formats/", article: true },
  { path: "guide/favicon-setup/", article: true },
  { path: "guide/optimize-lp-images/", article: true },
  { path: "about/", article: false },
  { path: "privacy/", article: false },
  { path: "terms/", article: false },
];

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
        expect(href.startsWith(prefix)).toBe(true);
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
  await expect(page).toHaveURL(/\/image-adjust\/privacy\/#external-transmission$/);
  await expect(page.locator("#external-transmission")).toBeVisible();
});

test("sitemap.xml が配信される", async ({ request }) => {
  const res = await request.get("/image-adjust/sitemap.xml");
  expect(res.ok()).toBe(true);
  const xml = await res.text();
  expect(xml).toContain("/image-adjust/en/guide/favicon-setup/</loc>");
  expect(xml).toContain('hreflang="x-default"');
});

test("ページに CSP が付き、CSP 違反が起きない", async ({ page }) => {
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
    "/image-adjust/",
    "/image-adjust/en/convert/png-to-webp/",
    "/image-adjust/guide/image-formats/",
    "/image-adjust/en/privacy/",
    "/image-adjust/icons/",
  ]) {
    const res = await page.goto(path);
    const csp = (await res?.allHeaders())?.["content-security-policy"] ?? "";
    // SW から返したページにも、プリキャッシュ時に保存したヘッダーが付く
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("'wasm-unsafe-eval'");
    await page.waitForLoadState("networkidle");
    const seen = await page.evaluate(() => (window as unknown as { __csp?: string[] }).__csp ?? []);
    violations.push(...seen);
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
