/** 保存ファイル名の組み立て。 */
import { describe, expect, it } from "vitest";
import { qrFileName, sanitizeHostForFileName } from "../core/file-name";

describe("qrFileName", () => {
  it("ホスト名を使って組み立てる", () => {
    expect(qrFileName("example.com", "png")).toBe("example.com.png");
    expect(qrFileName("example.com", "svg")).toBe("example.com.svg");
  });

  it("ホスト名を無害化する", () => {
    expect(qrFileName("www.Example.com", "png")).toBe("example.com.png");
    expect(qrFileName("a/b c?d", "png")).toBe("a-b-c-d.png");
    expect(qrFileName("....", "png")).toBe("qr-code.png");
    expect(qrFileName(undefined, "png")).toBe("qr-code.png");
    expect(qrFileName("", "svg")).toBe("qr-code.svg");
  });

  it("長いホスト名は切り詰める", () => {
    const long = `${"a".repeat(100)}.example.com`;
    const name = sanitizeHostForFileName(long);
    expect(name?.length).toBe(40);
  });
});
