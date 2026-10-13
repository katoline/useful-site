import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

/** ビルド成果物（E2E は pnpm build の後に preview で流す） */
const CLIENT_DIR = path.resolve(import.meta.dirname, "../../build/client");

function htmlFiles(): string[] {
  return readdirSync(CLIENT_DIR, { recursive: true, encoding: "utf8" })
    .filter((file) => file.endsWith(".html"))
    .sort();
}

function ogImage(html: string): string | undefined {
  return /<meta\s+property="og:image"\s+content="([^"]+)"/.exec(html)?.[1];
}

test("全ページの og:image がビルド成果物に存在する PNG を指す", async ({ request }) => {
  const files = htmlFiles();
  expect(files.length).toBeGreaterThan(0);
  const images = new Set<string>();
  for (const file of files) {
    const html = readFileSync(path.join(CLIENT_DIR, file), "utf8");
    const image = ogImage(html);
    expect(image, `${file} に og:image がありません`).toBeTruthy();
    // SITE_ORIGIN は公開先のドメインなので、パスでビルド成果物と配信を確かめる
    const pathname = new URL(image ?? "").pathname;
    expect(pathname, file).toMatch(/\/og\/(ja|en)\.png$/);
    // 言語はページに合わせる
    const lang = /<html[^>]*\slang="([^"]+)"/.exec(html)?.[1];
    expect(pathname.endsWith(`/og/${lang}.png`), `${file}: ${pathname}`).toBe(true);
    expect(existsSync(path.join(CLIENT_DIR, pathname)), `${file}: ${pathname}`).toBe(true);
    images.add(pathname);
  }
  for (const pathname of images) {
    const res = await request.get(pathname);
    expect(res.ok(), pathname).toBe(true);
    expect(res.headers()["content-type"], pathname).toContain("image/png");
  }
});
