import { describe, expect, it } from "vitest";
import { BINARY_SNIFF_BYTES, sniffImage, TEXT_SNIFF_BYTES } from "./image-sniff";

const enc = (s: string) => new TextEncoder().encode(s);
const BOM = "﻿";

/** need_more を返しうる先頭（判定が付かないまま続けられる形）。各分岐を 1 つ以上含める */
const UNDECIDED_SEEDS = [
  "", // 空白だけ（text === ""）
  BOM,
  "<", // 前置きの途中（isPartialPrologue）
  "<?",
  "<?xm",
  "<!",
  "<!-",
  "<!doc",
  "<svg", // `<svg` の直後が未着（lower.length < 5）
  "<SVG",
  '<?xml version="1.0"?>', // 前置きの後に <svg が来ない（isPrologue）
  "<!-- comment ",
  "<!DOCTYPE foo ",
];

describe("sniffImage", () => {
  it.each([
    [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], "png"],
    [[0xff, 0xd8, 0xff, 0xe0], "jpeg"],
    [[...enc("GIF87a")], "gif"],
    [[...enc("RIFF\0\0\0\0WEBP")], "webp"],
    [[...enc("<svg xmlns='x'/>")], "svg"],
    [[...enc(`${BOM}  \n<svg>`)], "svg"],
    [[...enc('<?xml version="1.0"?><!-- a --><svg width="1">')], "svg"],
  ])("%j を %s と判定する", (bytes, format) => {
    expect(sniffImage(new Uint8Array(bytes), true)).toEqual({ kind: "match", format });
  });

  it.each(["<svgfoo>", "<html>", "<!doctype html><html>", "hello", "{}"])(
    "%s は画像でない（読み終えた時点）",
    (text) => {
      expect(sniffImage(enc(text.padEnd(BINARY_SNIFF_BYTES, " ")), true).kind).toBe("no_match");
    },
  );

  describe("どの need_more 分岐も上限で打ち切る", () => {
    // 空白で前を埋めて、先頭（seed）が上限ちょうどで終わる形と、seed の後ろを空白で埋める形の両方
    for (const seed of UNDECIDED_SEEDS) {
      const seedBytes = enc(seed).length;
      it(`空白 + ${JSON.stringify(seed)}（上限ちょうど）`, () => {
        const bytes = enc(" ".repeat(TEXT_SNIFF_BYTES - seedBytes) + seed);
        expect(bytes.length).toBe(TEXT_SNIFF_BYTES);
        expect(sniffImage(bytes, false).kind).not.toBe("need_more");
      });
      it(`${JSON.stringify(seed)} + 空白（上限ちょうど）`, () => {
        const bytes = enc(seed + " ".repeat(TEXT_SNIFF_BYTES - seedBytes));
        expect(sniffImage(bytes, false).kind).not.toBe("need_more");
      });
      it(`${JSON.stringify(seed)} は読み終えたら（done）決まる`, () => {
        expect(sniffImage(enc(seed), true).kind).not.toBe("need_more");
      });
    }
  });

  it("上限以上の入力では、どんな内容でも need_more を返さない（乱択）", () => {
    const tokens = [
      " ",
      "\n",
      "\t",
      BOM,
      "<",
      "<?xml",
      "<!--",
      "-->",
      "<!DOCTYPE",
      "<svg",
      "?>",
      "a",
      "é",
    ];
    let seed = 12345;
    const random = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    for (let n = 0; n < 300; n++) {
      let text = "";
      while (enc(text).length < TEXT_SNIFF_BYTES) {
        text += tokens[Math.floor(random() * tokens.length)];
      }
      const bytes = enc(text).subarray(0, TEXT_SNIFF_BYTES);
      expect(sniffImage(bytes, false).kind).not.toBe("need_more");
    }
  });
});
