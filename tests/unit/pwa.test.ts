import { describe, expect, it } from "vitest";
import { BASE_PATH } from "~/lib/config";
import { SHARE_TARGET_PATH, SW_SCOPE, shareRedirectPath } from "~/lib/pwa";
import { buildWebManifest } from "~/lib/web-manifest";
import { toPrecacheUrl } from "../../scripts/lib/service-worker";

describe("PWA マニフェスト", () => {
  const ja = buildWebManifest("ja");
  const en = buildWebManifest("en");

  it("id・scope は日英共通で /image-adjust/、start_url は言語ごと", () => {
    expect(ja.id).toBe(`${BASE_PATH}/`);
    expect(en.id).toBe(ja.id);
    expect(ja.scope).toBe(`${BASE_PATH}/`);
    expect(en.scope).toBe(SW_SCOPE);
    expect(ja.start_url).toBe(`${BASE_PATH}/`);
    expect(en.start_url).toBe(`${BASE_PATH}/en/`);
    expect(ja.lang).toBe("ja");
    expect(en.name).not.toBe(ja.name);
  });

  it("share_target は POST multipart で画像と ZIP を受ける", () => {
    expect(ja.share_target.action).toBe(SHARE_TARGET_PATH);
    expect(en.share_target.action).toBe(`${SHARE_TARGET_PATH}?lang=en`);
    expect(ja.share_target.method).toBe("POST");
    expect(ja.share_target.enctype).toBe("multipart/form-data");
    expect(ja.share_target.params.files[0]?.accept).toEqual(
      expect.arrayContaining(["image/*", ".zip"]),
    );
  });

  it("アイコンに 192・512・maskable がある", () => {
    expect(ja.icons.map((i) => `${i.sizes}:${i.purpose}`)).toEqual([
      "192x192:any",
      "512x512:any",
      "512x512:maskable",
    ]);
  });

  it("共有受け取り後のリダイレクト先", () => {
    expect(shareRedirectPath(null)).toBe(`${BASE_PATH}/?share=1`);
    expect(shareRedirectPath("en")).toBe(`${BASE_PATH}/en/?share=1`);
    expect(shareRedirectPath("xx")).toBe(`${BASE_PATH}/?share=1`);
  });
});

describe("プリキャッシュの URL", () => {
  it("index.html を配信 URL（末尾スラッシュ）に直す", () => {
    expect(toPrecacheUrl("/image-adjust", "index.html")).toBe("/image-adjust/");
    expect(toPrecacheUrl("/image-adjust", "en/about/index.html")).toBe("/image-adjust/en/about/");
    expect(toPrecacheUrl("/image-adjust", "assets/a-123.js")).toBe("/image-adjust/assets/a-123.js");
  });
});
