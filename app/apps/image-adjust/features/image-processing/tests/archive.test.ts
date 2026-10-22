import { Zip, ZipDeflate, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { detectFormat } from "~/apps/image-adjust/domain/format";
import { LIMITS } from "~/apps/image-adjust/domain/limits";
import {
  readZipEntry,
  readZipImages,
  type ZipImageEntry,
  ZipLimitError,
} from "../adapters/archive/zip-read";
import { BlobSink, SplitZipWriter, ZipWriter } from "../adapters/archive/zip-write";
import { isIgnorableZipEntry, normalizeZipPath } from "../core/zip-path";
import { readFixture } from "./helpers/codecs-node";

const png = new Uint8Array(readFixture("sample.png"));
const jpg = new Uint8Array(readFixture("sample.jpg"));

function zipBlob(files: Record<string, Uint8Array>): Blob {
  return new Blob([zipSync(files, { level: 0 }) as BlobPart], { type: "application/zip" });
}

/** データ記述子を使い、ローカルヘッダーに展開サイズを持たない ZIP。 */
function streamingZip(name: string, bytes: Uint8Array): Blob {
  const chunks: BlobPart[] = [];
  const zip = new Zip((error, chunk) => {
    if (error) throw error;
    chunks.push(chunk as BlobPart);
  });
  const entry = new ZipDeflate(name);
  zip.add(entry);
  entry.push(bytes, true);
  zip.end();
  return new Blob(chunks, { type: "application/zip" });
}

async function collect(blob: Blob, limits = LIMITS.desktop) {
  const entries: ZipImageEntry[] = [];
  const skipped: string[] = [];
  await readZipImages(blob, {
    limits,
    onEntry: (e) => {
      entries.push(e);
    },
    onSkip: (p) => {
      skipped.push(p);
    },
  });
  return { entries, skipped };
}

describe("ZIP のパス正規化", () => {
  it("../ と絶対パス・ドライブ文字・バックスラッシュを取り除く", () => {
    expect(normalizeZipPath("../../etc/passwd.png")).toBe("etc/passwd.png");
    expect(normalizeZipPath("/abs/path.png")).toBe("abs/path.png");
    expect(normalizeZipPath("C:\\Users\\me\\a.png")).toBe("Users/me/a.png");
    expect(normalizeZipPath("photos/./sub//b.jpg")).toBe("photos/sub/b.jpg");
    expect(normalizeZipPath("a\u0000b.png")).toBe("ab.png");
    expect(normalizeZipPath("..")).toBeNull();
    expect(normalizeZipPath("")).toBeNull();
  });

  it("macOS の付属ファイルは無視する", () => {
    expect(isIgnorableZipEntry("__MACOSX/photos/._a.png")).toBe(true);
    expect(isIgnorableZipEntry("photos/._a.png")).toBe(true);
    expect(isIgnorableZipEntry("photos/.DS_Store")).toBe(true);
    expect(isIgnorableZipEntry("photos/a.png")).toBe(false);
  });
});

describe("ZIP の展開", () => {
  it("フォルダ構成を保って画像だけ取り出し、画像以外は無視する", async () => {
    const { entries, skipped } = await collect(readFixtureBlob("sample.zip"));
    expect(entries.map((e) => e.path).sort()).toEqual([
      "photos/a.png",
      "photos/sub/b.jpg",
      "photos/sub/c.gif",
    ]);
    expect(entries.find((e) => e.path === "photos/a.png")?.format).toBe("png");
    expect(skipped).toEqual(["notes.txt"]);
  });

  it("../ を含むパスは正規化される", async () => {
    const { entries } = await collect(zipBlob({ "../../evil.png": png, "/abs/x.jpg": jpg }));
    expect(entries.map((e) => e.path).sort()).toEqual(["abs/x.jpg", "evil.png"]);
  });

  it("拡張子が画像でも中身が画像でなければ無視する", async () => {
    const { entries, skipped } = await collect(
      zipBlob({ "fake.png": new TextEncoder().encode("not a png") }),
    );
    expect(entries).toEqual([]);
    expect(skipped).toEqual(["fake.png"]);
  });

  it("件数の上限を超えると止まる", async () => {
    const files: Record<string, Uint8Array> = {};
    for (let i = 0; i < 5; i++) files[`img${i}.png`] = png;
    await expect(
      collect(zipBlob(files), { ...LIMITS.desktop, maxZipEntries: 3 }),
    ).rejects.toBeInstanceOf(ZipLimitError);
  });

  it("展開後の合計サイズの上限を超えると止まる", async () => {
    await expect(
      collect(zipBlob({ "a.png": png, "b.png": png }), {
        ...LIMITS.desktop,
        maxZipTotalBytes: png.byteLength + 10,
      }),
    ).rejects.toMatchObject({ code: "zip_total_too_large" });
  });

  it("1 ファイルの上限を超えたものだけ飛ばす", async () => {
    const { entries, skipped } = await collect(zipBlob({ "big.png": png, "small.jpg": jpg }), {
      ...LIMITS.desktop,
      maxFileBytes: jpg.byteLength + 10,
    });
    expect(entries.map((e) => e.path)).toEqual(["small.jpg"]);
    expect(skipped).toEqual(["big.png"]);
  });

  it("画像以外のエントリも件数制限に数える", async () => {
    const files = Object.fromEntries(
      Array.from({ length: 5 }, (_, i) => [`note${i}.txt`, new Uint8Array(1)]),
    );
    await expect(
      collect(zipBlob(files), { ...LIMITS.desktop, maxZipEntries: 3 }),
    ).rejects.toMatchObject({ code: "zip_too_many_entries" });
  });

  it("サイズ不明の過大ファイルを飛ばす場合も展開量の合計上限で停止する", async () => {
    await expect(
      collect(streamingZip("large.png", new Uint8Array(4096)), {
        ...LIMITS.desktop,
        maxFileBytes: 16,
        maxZipTotalBytes: 32,
      }),
    ).rejects.toMatchObject({ code: "zip_total_too_large" });
  });

  it("ZIP の再読み込みでも実際の展開サイズを制限する", async () => {
    await expect(
      readZipEntry(streamingZip("large.png", new Uint8Array(4096)), "large.png", 32),
    ).rejects.toMatchObject({ code: "file_too_large" });
  });

  it("ZIP の再読み込みで宣言サイズが上限を超える場合は展開しない", async () => {
    await expect(readZipEntry(zipBlob({ "a.png": png }), "a.png", 1)).rejects.toMatchObject({
      code: "file_too_large",
    });
  });

  it("ZIP の再読み込みは上限内なら元の画像を返す", async () => {
    expect(await readZipEntry(zipBlob({ "a.png": png }), "a.png", png.length)).toEqual(png);
  });
});

describe("ZIP の作成", () => {
  it("ストリームで書いた ZIP を展開すると同じ内容になる", async () => {
    const sink = new BlobSink();
    const writer = new ZipWriter(sink);
    await writer.add({ path: "out/a.png", bytes: png });
    await writer.add({ path: "out/a.png", bytes: jpg }); // 同名 → 連番
    await writer.add({
      path: "out/s.svg",
      bytes: new TextEncoder().encode("<svg/>"),
      compress: true,
    });
    await writer.finish();
    const { entries, skipped } = await collect(sink.result());
    expect(entries.map((e) => e.path)).toEqual(["out/a.png", "out/a (2).png", "out/s.svg"]);
    expect(detectFormat(entries[1]?.bytes ?? new ArrayBuffer(0))).toBe("jpeg");
    expect(skipped).toEqual([]);
  });

  it("上限を超えそうなら ZIP を分割する", async () => {
    const writer = new SplitZipWriter(png.byteLength + jpg.byteLength + 1);
    await writer.add({ path: "1.png", bytes: png });
    await writer.add({ path: "2.jpg", bytes: jpg });
    await writer.add({ path: "3.png", bytes: png });
    const parts = await writer.finish();
    expect(parts).toHaveLength(2);
    const first = await collect(parts[0] as Blob);
    const second = await collect(parts[1] as Blob);
    expect(first.entries.map((e) => e.path)).toEqual(["1.png", "2.jpg"]);
    expect(second.entries.map((e) => e.path)).toEqual(["3.png"]);
  });
});

function readFixtureBlob(name: string): Blob {
  return new Blob([new Uint8Array(readFixture(name)) as BlobPart], { type: "application/zip" });
}
