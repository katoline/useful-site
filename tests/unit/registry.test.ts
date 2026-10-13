import { describe, expect, it } from "vitest";
import { allApps, getAppByPath, listedApps, validateManifests } from "~/platform/registry";
import type { AppManifest } from "~/platform/types";

const app = (id: string, path = id): AppManifest => ({
  id,
  path,
  name: { ja: id, en: id },
  description: { ja: id, en: id },
  menu: [],
  category: "other",
  status: "public",
  icon: "wrench",
  order: 1,
});
describe("アプリ登録簿", () => {
  it("全manifestを収集し、hiddenとportalを一覧から除く", () => {
    expect(() => validateManifests(allApps)).not.toThrow();
    expect(getAppByPath("image-adjust")?.id).toBe("image-adjust");
    expect(listedApps.every((app) => app.path !== "" && app.status !== "hidden")).toBe(true);
    const orders = listedApps.map((app) => app.order ?? 0);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
  });
  it("idとpathの重複を拒否する", () => {
    expect(() => validateManifests([app("a"), app("a", "b")])).toThrow(/id/);
    expect(() => validateManifests([app("a"), app("b", "a")])).toThrow(/path/);
  });
  it("予約語と不正なpathを拒否する", () => {
    for (const path of [
      "en",
      "assets",
      "privacy",
      "terms",
      "404",
      "sitemap.xml",
      "robots.txt",
      "ads.txt",
      "UpperCase",
      "a_b",
      "-a",
      "a/b",
      "../a",
    ])
      expect(() => validateManifests([app("a", path)])).toThrow(/path/);
  });
  it("日英の名前と説明は必須", () => {
    const missing = app("a");
    missing.description.en = "";
    expect(() => validateManifests([missing])).toThrow(/en/);
  });
  it("カテゴリ・公開状態・アイコンは決めた値だけを受け付ける", () => {
    expect(() => validateManifests([{ ...app("a"), category: "music" as "other" }])).toThrow(
      /category/,
    );
    expect(() => validateManifests([{ ...app("a"), status: "draft" as "public" }])).toThrow(
      /status/,
    );
    expect(() => validateManifests([{ ...app("a"), icon: "missing" as "grid" }])).toThrow(/icon/);
  });
  it("order は任意（省けば id の順に並ぶ）", () => {
    const { order: _order, ...withoutOrder } = app("a");
    expect(() => validateManifests([withoutOrder])).not.toThrow();
  });
  it("空の path を持つのはポータルだけ", () => {
    const portals = allApps.filter((item) => item.path === "");
    expect(portals.map((item) => item.id)).toEqual(["portal"]);
    expect(portals[0]?.status).toBe("hidden");
  });
});
