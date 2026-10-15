// @vitest-environment happy-dom
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { serializeJsonLd } from "~/platform/seo/json-ld";
import { serializeInlineJson } from "~/platform/serialization";

describe("インライン JSON", () => {
  const hostile = '</ScRiPt><script>globalThis.injected=true</script><!-->&"\u2028\u2029';

  it("終了タグや HTML の特殊文字を含む文字列を安全に往復できる", () => {
    const json = serializeInlineJson(hostile);
    expect(json).not.toMatch(/[<>&\u2028\u2029]/);
    expect(JSON.parse(json)).toBe(hostile);
    const html = `<html><head><script>globalThis.value=${json};</script></head></html>`;
    const doc = new DOMParser().parseFromString(html, "text/html");
    expect(doc.querySelectorAll("script")).toHaveLength(1);
    const context: { value?: string; injected?: boolean } = {};
    runInNewContext(doc.querySelector("script")?.textContent ?? "", context);
    expect(context.value).toBe(hostile);
    expect(context.injected).toBeUndefined();
  });

  it("JSON-LD のネストした値も同じ規則でエスケープする", () => {
    const data = { "@type": "Article", headline: hostile, items: [null, 42, true] };
    const json = serializeJsonLd(data);
    expect(json).not.toMatch(/[<>&\u2028\u2029]/);
    expect(JSON.parse(json)).toEqual(data);
  });
});
