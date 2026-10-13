import { describe, expect, it } from "vitest";
import { formatFromExtension, formatFromMime } from "~/apps/image-adjust/domain/format";
import { BASE_PATH } from "~/apps/image-adjust/shared/config";
import { SHARE_TARGET_PATH, SW_SCOPE, shareRedirectPath } from "~/apps/image-adjust/shared/pwa";
import { buildWebManifest } from "~/apps/image-adjust/shared/web-manifest";
import { toPrecacheUrl } from "../../../../scripts/lib/service-worker";

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
    expect(ja.share_target.params.files[0]?.accept).toEqual([
      "image/png",
      ".png",
      "image/jpeg",
      ".jpg",
      ".jpeg",
      ".jpe",
      ".jfif",
      "image/jpg",
      "image/pjpeg",
      "image/webp",
      ".webp",
      "image/gif",
      ".gif",
      "image/svg+xml",
      ".svg",
      "application/zip",
      ".zip",
      "application/x-zip-compressed",
    ]);
    expect(en.share_target.params.files[0]?.accept).toEqual(
      ja.share_target.params.files[0]?.accept,
    );
  });

  it("共有とファイルの関連付けは SW が受け付ける MIME・拡張子だけを使う", () => {
    const accept = ja.share_target.params.files[0]?.accept ?? [];
    const handlers = ja.file_handlers[0]?.accept ?? {};
    expect([
      ...new Set(Object.entries(handlers).flatMap(([mime, exts]) => [mime, ...exts])),
    ]).toEqual(accept);
    for (const type of accept) {
      if (
        type === ".zip" ||
        type === "application/zip" ||
        type === "application/x-zip-compressed"
      ) {
        continue;
      }
      expect(
        type.startsWith(".") ? formatFromExtension(`file${type}`) : formatFromMime(type),
      ).not.toBeNull();
    }
    expect(accept).not.toContain("image/*");
    expect(accept).not.toContain("image/avif");
    expect(accept).not.toContain(".avif");
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
    expect(toPrecacheUrl("", "assets/a-123.js")).toBe("/assets/a-123.js");
    expect(toPrecacheUrl("", "image-adjust/en/about/index.html")).toBe("/image-adjust/en/about/");
  });
});
