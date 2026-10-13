import { describe, expect, it } from "vitest";
import { buildAdsTxt } from "../../scripts/lib/ads-txt";

describe("ads.txt", () => {
  it("VITE_ADSENSE_CLIENT が設定されていれば Google の 1 行を出す", () => {
    expect(buildAdsTxt("ca-pub-1234567890123456")).toEqual({
      kind: "ok",
      body: "google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0\n",
    });
    expect(buildAdsTxt("  ca-pub-42 \n")).toEqual({
      kind: "ok",
      body: "google.com, pub-42, DIRECT, f08c47fec0942fa0\n",
    });
  });

  it("未設定・空なら出さない", () => {
    expect(buildAdsTxt(undefined)).toEqual({ kind: "none" });
    expect(buildAdsTxt("")).toEqual({ kind: "none" });
    expect(buildAdsTxt("   ")).toEqual({ kind: "none" });
  });

  it("形式が違えば出さない（行の注入もできない）", () => {
    expect(buildAdsTxt("pub-123").kind).toBe("invalid");
    expect(buildAdsTxt("ca-pub-abc").kind).toBe("invalid");
    expect(buildAdsTxt("ca-pub-1\nexample.com, x, DIRECT").kind).toBe("invalid");
  });
});
