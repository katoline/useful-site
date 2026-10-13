import { describe, expect, it } from "vitest";
import {
  API_BASE_PATH,
  absoluteAssetUrl,
  absoluteUrl,
  BASE_PATH,
  SITE_ORIGIN,
  STORAGE_PREFIX,
  withBase,
} from "~/apps/image-adjust/shared/config";

describe("config", () => {
  it("BASE_PATH は先頭スラッシュあり・末尾スラッシュなし", () => {
    expect(BASE_PATH).toMatch(/^\/[^/].*[^/]$/);
    expect(API_BASE_PATH).toBe(`${BASE_PATH}/api`);
    expect(STORAGE_PREFIX).toBe("image-adjust:");
  });

  it("SITE_ORIGIN は末尾スラッシュなしの https オリジン", () => {
    expect(SITE_ORIGIN).toMatch(/^https:\/\/[^/]+$/);
  });

  it("withBase は末尾スラッシュ付きに統一する", () => {
    expect(withBase("")).toBe(`${BASE_PATH}/`);
    expect(withBase("/")).toBe(`${BASE_PATH}/`);
    expect(withBase("about")).toBe(`${BASE_PATH}/about/`);
    expect(withBase("/en/about/")).toBe(`${BASE_PATH}/en/about/`);
  });

  it("絶対 URL を作る", () => {
    expect(absoluteUrl("/en/")).toBe(`${SITE_ORIGIN}${BASE_PATH}/en/`);
    expect(absoluteAssetUrl("og/ja.png")).toBe(`${SITE_ORIGIN}${BASE_PATH}/og/ja.png`);
  });
});
