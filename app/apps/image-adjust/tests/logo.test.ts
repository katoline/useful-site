import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildLogoSvg, LOGO_GLYPH_PATH, LOGO_SIZE } from "~/apps/image-adjust/shared/logo";

const PUBLIC_DIR = path.resolve(import.meta.dirname, "../public");

describe("logo", () => {
  it("マークは正方形の viewBox で、タイル（面）と記号を持つ", () => {
    const svg = buildLogoSvg();
    expect(svg).toContain(`viewBox="0 0 ${LOGO_SIZE} ${LOGO_SIZE}"`);
    expect(svg).toMatch(/<rect [^>]*fill="#0a0a0a"/);
    expect(svg).toMatch(/<path fill="#ffffff"/);
  });

  it("public/logo.svg は app/apps/image-adjust/shared/logo.ts の図形から作り直されている", () => {
    // 図形を変えたら `nix develop -c node app/apps/image-adjust/scripts/generate-icons.ts` で public/ を作り直す
    const file = readFileSync(path.join(PUBLIC_DIR, "logo.svg"), "utf8");
    expect(file).toContain(`d="${LOGO_GLYPH_PATH}"`);
  });
});
