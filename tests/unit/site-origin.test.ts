import { describe, expect, it } from "vitest";
import { DEFAULT_SITE_ORIGIN, normalizeSiteOrigin } from "~/platform/config";
import {
  checkDeployOrigin,
  checkOriginMatchesRoutes,
  isPlaceholderOrigin,
  routeHost,
} from "../../scripts/lib/site-origin";

describe("site-origin", () => {
  it("example ドメインは仮の値とみなす（既定値は暫定の実在ドメインなので仮ではない）", () => {
    expect(isPlaceholderOrigin(DEFAULT_SITE_ORIGIN)).toBe(false);
    expect(isPlaceholderOrigin("https://example.com")).toBe(true);
    expect(isPlaceholderOrigin("https://www.example.org")).toBe(true);
    expect(isPlaceholderOrigin("https://foo.example.workers.dev")).toBe(true);
    expect(isPlaceholderOrigin("https://image-adjust.pages.dev")).toBe(false);
    expect(isPlaceholderOrigin("https://myexample.com")).toBe(false);
  });

  it("デプロイ前の確認：未設定なら既定値（暫定ドメイン）で通す", () => {
    expect(checkDeployOrigin(undefined)).toBeNull();
    expect(checkDeployOrigin("  ")).toBeNull();
    expect(checkDeployOrigin(DEFAULT_SITE_ORIGIN)).toBeNull();
  });

  it("デプロイ前の確認：未設定のとき、既定値が仮の値・形の誤りなら止める", () => {
    expect(checkDeployOrigin(undefined, "https://image-adjust.example.workers.dev")).toMatch(
      /既定値.*仮の値/,
    );
    expect(checkDeployOrigin(undefined, "http://tools.test-site.net")).toMatch(/既定値.*https/);
    expect(checkDeployOrigin("", "https://tools.test-site.net/image-adjust")).toMatch(
      /既定値.*オリジンだけ/,
    );
    expect(checkDeployOrigin(undefined, "")).toMatch(/空です/);
    // 環境変数が正しければ既定値は見ない
    expect(
      checkDeployOrigin("https://tools.test-site.net", "https://image-adjust.example.workers.dev"),
    ).toBeNull();
  });

  it("デプロイ前の確認：仮の値・形の誤りは止める", () => {
    expect(checkDeployOrigin("https://image-adjust.example.workers.dev")).toMatch(/仮の値/);
    expect(checkDeployOrigin("not a url")).toMatch(/URL として読めません/);
    expect(checkDeployOrigin("http://tools.test-site.net")).toMatch(/https/);
    expect(checkDeployOrigin("https://tools.test-site.net/image-adjust")).toMatch(/オリジンだけ/);
    expect(checkDeployOrigin("https://tools.test-site.net/?a=1")).toMatch(/オリジンだけ/);
    expect(checkDeployOrigin("https://tools.test-site.net/#x")).toMatch(/オリジンだけ/);
    expect(checkDeployOrigin("https://user:pass@tools.test-site.net")).toMatch(/オリジンだけ/);
    // 大文字や既定ポートで書いても、仮の値は仮の値
    expect(checkDeployOrigin("https://IMAGE-ADJUST.example.workers.dev:443/")).toMatch(/仮の値/);
  });

  it("本物のオリジンなら通す（末尾スラッシュは許す）", () => {
    expect(checkDeployOrigin("https://tools.test-site.net")).toBeNull();
    expect(checkDeployOrigin("https://tools.test-site.net/")).toBeNull();
    // 文字列ではなく URL の構造で見るので、大文字のホスト・既定のポート・日本語ドメインも通す
    expect(checkDeployOrigin("https://Tools.MySite.jp")).toBeNull();
    expect(checkDeployOrigin("https://tools.mysite.jp:443")).toBeNull();
    expect(checkDeployOrigin("https://ツール.日本語ドメイン.jp")).toBeNull();
  });

  it("SITE_ORIGIN 用の正規化：小文字・既定ポートなし・punycode・末尾スラッシュなし", () => {
    expect(normalizeSiteOrigin("https://Tools.MySite.jp")).toBe("https://tools.mysite.jp");
    expect(normalizeSiteOrigin("https://tools.mysite.jp:443/")).toBe("https://tools.mysite.jp");
    expect(normalizeSiteOrigin("https://tools.mysite.jp:8443")).toBe(
      "https://tools.mysite.jp:8443",
    );
    expect(normalizeSiteOrigin("https://ツール.日本語ドメイン.jp")).toMatch(
      /^https:\/\/xn--[a-z0-9-]+\.xn--[a-z0-9-]+\.jp$/,
    );
    expect(normalizeSiteOrigin(" ")).toBeUndefined();
    expect(normalizeSiteOrigin(undefined)).toBeUndefined();
  });

  describe("公開オリジンと wrangler.jsonc の routes のずれ", () => {
    const routes = [{ pattern: "t0n03k1.com/*", zone_name: "t0n03k1.com" }];

    it("routes の pattern からホスト部を取り出す", () => {
      expect(routeHost(routes[0] as { pattern: string })).toBe("t0n03k1.com");
      expect(routeHost("https://Tools.Example.org/app/*")).toBe("tools.example.org");
      expect(routeHost("*.t0n03k1.com/*")).toBe("*.t0n03k1.com");
    });

    it("routes のホストと一致すれば通す", () => {
      expect(checkOriginMatchesRoutes("https://t0n03k1.com", routes, true)).toBeNull();
      expect(checkOriginMatchesRoutes("https://T0N03K1.com:443", routes, true)).toBeNull();
      expect(
        checkOriginMatchesRoutes("https://a.t0n03k1.com", ["*.t0n03k1.com/x/*"], false),
      ).toBeNull();
    });

    it("www 付き・別ドメインなど、配信していないホストなら止める", () => {
      expect(checkOriginMatchesRoutes("https://www.t0n03k1.com", routes, true)).toMatch(
        /一致しません/,
      );
      expect(checkOriginMatchesRoutes("https://tools.test-site.net", routes, true)).toMatch(
        /一致しません/,
      );
      // ワイルドカードはホスト全体に一致させる（接尾辞だけの一致にしない）
      expect(
        checkOriginMatchesRoutes("https://evilt0n03k1.com", ["*.t0n03k1.com/*"], false),
      ).toMatch(/一致しません/);
    });

    it("workers.dev は workers_dev が有効なときだけ通す", () => {
      const dev = "https://image-adjust.myacct.workers.dev";
      expect(checkOriginMatchesRoutes(dev, routes, true)).toBeNull();
      expect(checkOriginMatchesRoutes(dev, routes, false)).toMatch(/一致しません/);
      // routes があって workers_dev が未指定なら、wrangler と同じく無効とみなす
      expect(checkOriginMatchesRoutes(dev, routes, undefined)).toMatch(/一致しません/);
    });

    it("routes が無い（workers.dev だけ）なら、オリジンが *.workers.dev のときだけ通す", () => {
      const dev = "https://image-adjust.myacct.workers.dev";
      expect(checkOriginMatchesRoutes(dev, undefined, undefined)).toBeNull();
      expect(checkOriginMatchesRoutes(dev, [], true)).toBeNull();
      expect(checkOriginMatchesRoutes("https://t0n03k1.com", undefined, undefined)).toMatch(
        /workers\.dev だけ/,
      );
      expect(checkOriginMatchesRoutes(dev, [], false)).toMatch(/どのホストでも配信されません/);
    });

    it("このリポジトリの既定値は wrangler.jsonc の routes と一致する", async () => {
      const { unstable_readConfig } = await import("wrangler");
      const config = unstable_readConfig({ config: "wrangler.jsonc" });
      expect(
        checkOriginMatchesRoutes(DEFAULT_SITE_ORIGIN, config.routes, config.workers_dev),
      ).toBeNull();
    });
  });
});
