import { expect, type Page, test } from "@playwright/test";
import { readPdf } from "./pdf-text";

const isMobile = (page: Page) => (page.viewportSize()?.width ?? 1280) < 768;
const frame = (page: Page) => page.frameLocator('[data-testid="preview-frame"]');
const editor = (page: Page) => page.getByTestId("markdown-input");

/** 1×1 の PNG */
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==",
  "base64",
);

const DOC = [
  "# 月次レポート",
  "",
  "本文の段落です。[外部リンク](https://example.com/) と脚注[^1]。",
  "",
  "| 項目 | 値 |",
  "| --- | ---: |",
  "| 売上 | 120 |",
  "",
  "- [x] 完了したこと",
  "",
  "<script>window.__xss = 1</script>",
  "",
  "![外部画像](https://example.com/a.png)",
  "",
  "[^1]: 脚注の本文。",
].join("\n");

/** 編集欄に入力する（スマホは「編集」タブを開いてから） */
async function typeMarkdown(page: Page, text: string) {
  if (isMobile(page)) await page.getByTestId("tab-edit").click();
  await editor(page).fill(text);
}

/** プレビューを見えるようにする（スマホは「プレビュー」タブ） */
async function showPreview(page: Page) {
  if (isMobile(page)) await page.getByTestId("tab-preview").click();
}

/**
 * CSP 違反とページのエラーを集める。Chromium は CSP 違反（iframe の中のものも）をコンソールに出す。
 * addInitScript は使わない（sandbox の iframe にも差し込まれ、スクリプトの実行がブロックされた旨が出るため）
 */
function collectProblems(page: Page) {
  const problems: string[] = [];
  page.on("console", (message) => {
    const text = message.text();
    // Playwright のトレース（trace: "retain-on-failure"）がスナップショット用のスクリプトを
    // sandbox の iframe で動かそうとして出るもの。iframe でスクリプトが動かないことの表れなので除く
    if (/^Blocked script execution in 'about:srcdoc'/.test(text)) return;
    if (message.type() === "error" || /Content Security Policy|Refused to/i.test(text))
      problems.push(text);
  });
  page.on("pageerror", (error) => problems.push(error.message));
  return problems;
}

test("日英のページがプリレンダリングされ、meta と JSON-LD が入っている", async ({ page }) => {
  for (const [path, heading, lang] of [
    ["/markdown-pdf/", "Markdown を PDF に変換", "ja"],
    ["/markdown-pdf/en/", "Convert Markdown to PDF", "en"],
  ] as const) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await expect(page.locator("html")).toHaveAttribute("lang", lang);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      `https://t0n03k1.com${path}`,
    );
    await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute(
      "href",
      "https://t0n03k1.com/markdown-pdf/en/",
    );
    const types = await page
      .locator('script[type="application/ld+json"]')
      .evaluateAll((els) => els.map((el) => JSON.parse(el.textContent ?? "{}")["@type"]));
    expect(types).toEqual(expect.arrayContaining(["WebApplication", "FAQPage", "BreadcrumbList"]));
  }
});

test("入力するとプレビューに見出し・表・脚注・タスクリストが出て、危険な内容は無効になる", async ({
  page,
}) => {
  const problems = collectProblems(page);
  await page.goto("/markdown-pdf/");
  await typeMarkdown(page, DOC);
  await showPreview(page);
  const preview = frame(page);
  await expect(preview.getByRole("heading", { level: 1 })).toHaveText("月次レポート");
  await expect(preview.locator("table td").first()).toHaveText("売上");
  await expect(preview.locator("section.footnotes")).toContainText("脚注の本文。");
  await expect(preview.locator("input[type=checkbox][checked]")).toHaveCount(1);
  // 生の HTML は文字として表示され、実行されない。外部画像は読み込まない
  await expect(preview.locator("body")).toContainText("<script>window.__xss = 1</script>");
  await expect(preview.locator("script")).toHaveCount(0);
  await expect(preview.locator("img")).toHaveCount(0);
  await expect(preview.locator(".md-blocked-image")).toContainText("外部画像");
  const link = preview.getByRole("link", { name: "外部リンク" });
  await expect(link).toHaveAttribute("rel", "noopener noreferrer");
  await expect(link).toHaveAttribute("target", "_blank");

  // 脚注（#fn1）のリンクは iframe の中で移動し、iframe を親のページへ遷移させない
  await preview.locator("sup.footnote-ref a").click();
  await expect(preview.getByRole("heading", { level: 1 })).toHaveText("月次レポート");
  expect(page.frames().some((f) => f.url().includes("/markdown-pdf/#"))).toBe(false);

  const iframe = page.getByTestId("preview-frame");
  await expect(iframe).toHaveAttribute("sandbox", "allow-same-origin allow-modals");
  const head = await iframe.evaluate((el) => {
    const doc = (el as HTMLIFrameElement).contentDocument;
    return doc?.head.firstElementChild?.outerHTML ?? "";
  });
  expect(head).toContain('http-equiv="Content-Security-Policy"');
  expect(head).toContain("default-src 'none'; img-src data: blob:; style-src 'unsafe-inline'");
  expect(await page.evaluate(() => (window as { __xss?: number }).__xss)).toBeUndefined();
  expect(problems).toEqual([]);

  // iframe の中の CSP が外部への通信を止める（検出の仕組みが働くことも確かめる）
  await iframe.evaluate((el) => {
    const doc = (el as HTMLIFrameElement).contentDocument;
    const img = doc?.createElement("img");
    if (!doc || !img) return;
    img.src = "https://example.com/tracker.png";
    doc.body.append(img);
  });
  await expect
    .poll(() =>
      problems.some((text) => /Content Security Policy/.test(text) && /example\.com/.test(text)),
    )
    .toBe(true);
});

test("ファイル入力で .md と画像を読み込み、相対パスの画像を blob: で表示する（CSP 違反なし）", async ({
  page,
}) => {
  const problems = collectProblems(page);
  await page.goto("/markdown-pdf/");
  await page.getByTestId("image-file-input").setInputFiles({
    name: "dot.png",
    mimeType: "image/png",
    buffer: PNG_1X1,
  });
  await expect(page.getByTestId("image-list")).toContainText("dot.png");
  await page.getByTestId("markdown-file-input").setInputFiles({
    name: "note.md",
    mimeType: "text/markdown",
    buffer: Buffer.from("# ファイルの文書\n\n![点](./images/dot.png)\n"),
  });
  if (isMobile(page)) await page.getByTestId("tab-edit").click();
  await expect(editor(page)).toHaveValue(/# ファイルの文書/);
  await showPreview(page);
  await expect(frame(page).getByRole("heading", { level: 1 })).toHaveText("ファイルの文書");
  const image = frame(page).locator("img");
  await expect(image).toHaveAttribute("src", /^blob:/);
  await expect.poll(() => image.evaluate((img) => (img as HTMLImageElement).naturalWidth)).toBe(1);
  expect(problems).toEqual([]);
});

test("上限を超えるファイルや未対応の形式は読み込まずに案内する", async ({ page }) => {
  await page.goto("/markdown-pdf/en/");
  await page.getByTestId("markdown-file-input").setInputFiles({
    name: "huge.md",
    mimeType: "text/markdown",
    buffer: Buffer.alloc(2 * 1024 * 1024 + 1, 97),
  });
  await expect(page.getByTestId("input-messages")).toContainText("huge.md is too large");
  if (isMobile(page)) await page.getByTestId("tab-edit").click();
  await expect(editor(page)).toHaveValue("");
  await page.getByTestId("image-file-input").setInputFiles({
    name: "doc.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF"),
  });
  await expect(page.getByTestId("input-messages")).toContainText("doc.pdf is not a supported");
});

test("スマホは編集・プレビューのタブで切り替え、PC は左右に並べる", async ({ page }) => {
  await page.goto("/markdown-pdf/");
  const tabs = page.getByRole("tablist");
  if (isMobile(page)) {
    await expect(tabs).toBeVisible();
    await expect(page.getByRole("tab", { name: "編集" })).toHaveAttribute("aria-selected", "true");
    await expect(editor(page)).toBeVisible();
    await expect(page.getByTestId("preview-frame")).toBeHidden();
    await editor(page).fill("# タブの確認");
    await page.getByRole("tab", { name: "プレビュー" }).click();
    await expect(page.getByRole("tab", { name: "プレビュー" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(editor(page)).toBeHidden();
    await expect(frame(page).getByRole("heading", { level: 1 })).toHaveText("タブの確認");
    await page.getByRole("tab", { name: "プレビュー" }).press("ArrowLeft");
    await expect(page.getByRole("tab", { name: "編集" })).toBeFocused();
    await expect(editor(page)).toBeVisible();
  } else {
    await expect(tabs).toBeHidden();
    await expect(editor(page)).toBeVisible();
    await expect(page.getByTestId("preview-frame")).toBeVisible();
    const editorBox = await editor(page).boundingBox();
    const previewBox = await page.getByTestId("preview-frame").boundingBox();
    expect(editorBox && previewBox && editorBox.x + editorBox.width <= previewBox.x).toBe(true);
  }
});

test("言語を切り替えても再読み込みしても、入力と設定が残る", async ({ page }) => {
  await page.goto("/markdown-pdf/");
  await typeMarkdown(page, "# 残る文書\n\n本文");
  await page.getByTestId("setting-paper").click();
  await page.getByRole("option", { name: "Letter" }).click();
  await page.evaluate(() => ((window as { __marker?: number }).__marker = 1));
  if (isMobile(page)) await page.getByTestId("mobile-menu-button").click();
  await page.getByTestId("lang-en").filter({ visible: true }).click();
  await expect(page).toHaveURL(/\/markdown-pdf\/en\/$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Convert Markdown to PDF");
  expect(await page.evaluate(() => (window as { __marker?: number }).__marker)).toBe(1);
  if (isMobile(page)) await page.getByTestId("tab-edit").click();
  await expect(editor(page)).toHaveValue("# 残る文書\n\n本文");
  await expect(page.getByTestId("setting-paper")).toHaveText(/Letter/);

  await page.reload();
  if (isMobile(page)) await page.getByTestId("tab-edit").click();
  await expect(editor(page)).toHaveValue("# 残る文書\n\n本文");
  await expect(page.getByTestId("setting-paper")).toHaveText(/Letter/);
  expect(await page.evaluate(() => sessionStorage.getItem("markdown-pdf:draft"))).toBe(
    "# 残る文書\n\n本文",
  );
  expect(await page.evaluate(() => localStorage.getItem("markdown-pdf:draft"))).toBeNull();
});

test("「PDF を保存」で iframe の print() が最初の h1 をタイトルにして呼ばれる", async ({
  page,
}) => {
  await page.goto("/markdown-pdf/");
  await typeMarkdown(page, "# 請求書 2026/10\n\n本文");
  await showPreview(page);
  await expect(frame(page).getByRole("heading", { level: 1 })).toHaveText("請求書 2026/10");
  await expect(page.getByText("ヘッダーとフッターをオフ").first()).toBeVisible();
  // iframe の中ではスクリプトが動かないので、親から print を差し替える
  await page.getByTestId("preview-frame").evaluate((el) => {
    const iframe = el as HTMLIFrameElement;
    const calls: string[] = [];
    (window as { __prints?: string[] }).__prints = calls;
    if (iframe.contentWindow)
      iframe.contentWindow.print = () => {
        calls.push(iframe.contentDocument?.title ?? "");
      };
  });
  await page.getByTestId("save-pdf").click();
  await expect
    .poll(() => page.evaluate(() => (window as { __prints?: string[] }).__prints))
    .toEqual(["請求書 2026 10"]);
});

test("ハンバーガーメニューからポータル・Image Adjust と行き来できる", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("mobile-menu-button").click();
  await page.getByRole("dialog").getByRole("link", { name: "Markdown → PDF" }).click();
  await expect(page).toHaveURL("/markdown-pdf/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Markdown を PDF に変換");

  await page.getByTestId("mobile-menu-button").click();
  const menu = page.getByRole("dialog");
  await expect(menu.getByRole("link", { name: "Markdown → PDF" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await menu.getByRole("link", { name: "Image Adjust", exact: true }).click();
  await expect(page).toHaveURL("/image-adjust/");

  await page.getByTestId("mobile-menu-button").click();
  await page.getByRole("dialog").getByRole("link", { name: "Markdown → PDF" }).click();
  await expect(page).toHaveURL("/markdown-pdf/");
  await page.getByTestId("mobile-menu-button").click();
  await page.getByRole("dialog").getByRole("link", { name: "便利ツール集", exact: true }).click();
  await expect(page).toHaveURL("/");
  // ポータルの一覧にも載る
  await expect(
    page.getByRole("main").getByRole("link", { name: "Markdown → PDF" }),
  ).toHaveAttribute("href", "/markdown-pdf/");
});

test("PDF の回帰：プレビューと同じ HTML から作った PDF のページ数・用紙・本文", async ({
  page,
  browser,
}) => {
  await page.goto("/markdown-pdf/");
  await typeMarkdown(
    page,
    // PDF の文字の検査は英数字で行う（日本語は端末の書体で描くので、CJK フォントの無い環境（CI 等）では
    // PDF から読み取れない。このテストはページ数・用紙・改ページでの振り分けを確かめるもの）
    "# Alpha\n\nFirstPageBody\n\n| Key | Value |\n| --- | --- |\n| TableCell | 1 |\n\n---\n\n## Beta\n\nSecondPageBody\n\n---\n\n## Gamma\n\nLastPageBody",
  );
  await showPreview(page);
  await expect(frame(page).getByRole("heading", { level: 2 }).last()).toHaveText("Gamma");
  const srcdoc = async () => (await page.getByTestId("preview-frame").getAttribute("srcdoc")) ?? "";

  const render = async (html: string) => {
    const pdfPage = await browser.newPage();
    await pdfPage.setContent(html);
    const pdf = await pdfPage.pdf({ preferCSSPageSize: true });
    await pdfPage.close();
    return readPdf(pdf);
  };

  const a4 = await render(await srcdoc());
  expect(a4.pageCount).toBe(3);
  // A4（210×297mm ≒ 595×842pt）
  for (const size of a4.pageSizes) {
    expect(Math.round(size.width)).toBe(595);
    expect(Math.round(size.height)).toBe(842);
  }
  expect(a4.pageTexts[0]).toContain("Alpha");
  expect(a4.pageTexts[0]).toContain("FirstPageBody");
  expect(a4.pageTexts[0]).toContain("TableCell");
  expect(a4.pageTexts[1]).toContain("SecondPageBody");
  expect(a4.pageTexts[2]).toContain("LastPageBody");

  // 改ページを切り、Letter・横にすると 1 ページで用紙も変わる
  await page.getByTestId("setting-pageBreakOnRule").click();
  await page.getByTestId("setting-paper").click();
  await page.getByRole("option", { name: "Letter" }).click();
  await page.getByTestId("setting-orientation").click();
  await page.getByRole("option", { name: "横" }).click();
  await expect.poll(async () => (await srcdoc()).includes("size: letter landscape")).toBe(true);
  const letter = await render(await srcdoc());
  expect(letter.pageCount).toBe(1);
  expect(Math.round(letter.pageSizes[0]?.width ?? 0)).toBe(792);
  expect(Math.round(letter.pageSizes[0]?.height ?? 0)).toBe(612);
  expect(letter.pageTexts[0]).toContain("LastPageBody");
});
