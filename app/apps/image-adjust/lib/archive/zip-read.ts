/**
 * ZIP のストリーム展開（fflate の Unzip）。§2.3・§3.6・§5
 * - 全部を一度に展開せず、1 件取り出すごとに onEntry を await してから次へ進む
 * - 画像以外のファイルは無視する（拡張子で絞り、取り出した後に中身で再判定する）
 * - 展開後の合計サイズ・件数に上限を設ける（ZIP 爆弾対策）
 */
import { Unzip, UnzipInflate } from "fflate";
import { detectFormat, formatFromExtension, type ImageFormat } from "../codecs/format";
import type { Limits } from "../limits";
import { isIgnorableZipEntry, normalizeZipPath } from "./zip-path";

export interface ZipImageEntry {
  /** 正規化済みの相対パス */
  path: string;
  /** ZIP 内の元のエントリ名（readZipEntry で読み直すときに使う） */
  entryName: string;
  name: string;
  format: ImageFormat;
  bytes: ArrayBuffer;
}

export type ZipLimitCode = "zip_total_too_large" | "zip_too_many_entries";

export class ZipLimitError extends Error {
  readonly code: ZipLimitCode;
  constructor(code: ZipLimitCode) {
    super(code);
    this.name = "ZipLimitError";
    this.code = code;
  }
}

export interface ReadZipOptions {
  limits: Pick<Limits, "maxZipTotalBytes" | "maxZipEntries" | "maxFileBytes">;
  /** 画像 1 件ごとに呼ばれる。戻りの Promise を待ってから次を取り出す */
  onEntry: (entry: ZipImageEntry) => Promise<void> | void;
  /** 1 ファイルの上限を超えた等で飛ばした件 */
  onSkip?: (path: string, reason: "file_too_large" | "not_image") => void;
  signal?: AbortSignal;
}

interface Pending {
  path: string;
  chunks: Uint8Array[];
  size: number;
}

/** ZIP 内の画像を 1 件ずつ取り出す。上限を超えたら ZipLimitError を投げて止める */
export async function readZipImages(file: Blob, options: ReadZipOptions): Promise<void> {
  const { limits, onEntry, onSkip, signal } = options;
  const completed: ZipImageEntry[] = [];
  // コールバックの中で書き換えるので、let の絞り込みに引っかからないようオブジェクトに持つ
  const state: { failure: Error | null; totalBytes: number; entries: number } = {
    failure: null,
    totalBytes: 0,
    entries: 0,
  };

  const unzip = new Unzip();
  unzip.register(UnzipInflate);
  unzip.onfile = (f) => {
    if (f.name.endsWith("/")) return; // ディレクトリ
    const path = normalizeZipPath(f.name);
    if (!path || isIgnorableZipEntry(path)) return;
    if (!formatFromExtension(path)) {
      onSkip?.(path, "not_image");
      return;
    }
    if (++state.entries > limits.maxZipEntries) {
      state.failure = new ZipLimitError("zip_too_many_entries");
      return;
    }
    // 展開後のサイズが分かる（データ記述子なし）なら読む前に飛ばす
    if (typeof f.originalSize === "number" && f.originalSize > limits.maxFileBytes) {
      onSkip?.(path, "file_too_large");
      return;
    }
    const pending: Pending = { path, chunks: [], size: 0 };
    f.ondata = (err, data, final) => {
      if (state.failure) return;
      if (err) {
        state.failure = err;
        return;
      }
      pending.chunks.push(data);
      pending.size += data.length;
      if (pending.size > limits.maxFileBytes) {
        // 大きすぎる：この 1 件だけ飛ばす（読み終わるまでデータは捨てる）
        pending.chunks = [];
        f.ondata = () => {};
        onSkip?.(path, "file_too_large");
        return;
      }
      if (!final) return;
      state.totalBytes += pending.size;
      if (state.totalBytes > limits.maxZipTotalBytes) {
        state.failure = new ZipLimitError("zip_total_too_large");
        return;
      }
      const bytes = concat(pending.chunks, pending.size);
      pending.chunks = [];
      const format = detectFormat(bytes);
      if (!format) {
        onSkip?.(path, "not_image");
        return;
      }
      completed.push({
        path,
        entryName: f.name,
        name: path.split("/").pop() ?? path,
        format,
        bytes: toArrayBuffer(bytes),
      });
    };
    f.start();
  };

  const reader = file.stream().getReader();
  try {
    for (;;) {
      if (signal?.aborted) throw new DOMException("aborted", "AbortError");
      const { value, done } = await reader.read();
      if (done) {
        unzip.push(new Uint8Array(0), true);
      } else {
        unzip.push(value, false);
      }
      if (state.failure) throw state.failure;
      // 取り出せた分を処理してから次のチャンクを読む（全件をメモリに抱えない）
      while (completed.length > 0) {
        const entry = completed.shift();
        if (entry) await onEntry(entry);
      }
      if (done) break;
    }
  } finally {
    reader.releaseLock();
  }
}

/** 余分な領域を持たない ArrayBuffer にする（postMessage の transfer 用） */
function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  if (bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength) {
    return bytes.buffer as ArrayBuffer;
  }
  return bytes.slice().buffer as ArrayBuffer;
}

function concat(chunks: Uint8Array[], size: number): Uint8Array {
  if (chunks.length === 1 && chunks[0]) return chunks[0];
  const out = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

/**
 * ZIP から 1 エントリだけ読み直す（処理後に解放した元データを、比較表示や再処理で使うとき）。
 * 見つかった時点で読むのをやめる。無ければ null
 */
export async function readZipEntry(file: Blob, entryName: string): Promise<Uint8Array | null> {
  let found: Uint8Array | null = null;
  let done = false;
  let failure: Error | null = null;
  const unzip = new Unzip();
  unzip.register(UnzipInflate);
  unzip.onfile = (f) => {
    if (f.name !== entryName) return;
    const chunks: Uint8Array[] = [];
    let size = 0;
    f.ondata = (err, data, final) => {
      if (err) {
        failure = err;
        return;
      }
      chunks.push(data);
      size += data.length;
      if (final) {
        found = concat(chunks, size);
        done = true;
      }
    };
    f.start();
  };
  const reader = file.stream().getReader();
  try {
    for (;;) {
      const { value, done: eof } = await reader.read();
      unzip.push(value ?? new Uint8Array(0), eof);
      if (failure) throw failure;
      if (done || eof) break;
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  return found;
}

/** ZIP かどうか（先頭の "PK\x03\x04"。空の ZIP は "PK\x05\x06"） */
export function looksLikeZip(bytes: Uint8Array): boolean {
  return bytes[0] === 0x50 && bytes[1] === 0x4b && (bytes[2] === 0x03 || bytes[2] === 0x05);
}
