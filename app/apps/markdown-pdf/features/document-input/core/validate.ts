/** 入力ファイルの拡張子と上限の検査（純粋関数。File ではなく name・size だけを見る） */
import {
  IMAGE_EXTENSIONS,
  MAX_IMAGE_COUNT,
  MAX_IMAGE_TOTAL_BYTES,
  MAX_TEXT_BYTES,
  TEXT_EXTENSIONS,
} from "../../../domain/limits";

export interface FileLike {
  name: string;
  size: number;
}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot <= 0 ? "" : name.slice(dot).toLowerCase();
}

export function isTextFileName(name: string): boolean {
  return (TEXT_EXTENSIONS as readonly string[]).includes(extensionOf(name));
}

export function isImageFileName(name: string): boolean {
  return (IMAGE_EXTENSIONS as readonly string[]).includes(extensionOf(name));
}

/** 文字列の UTF-8 でのバイト数 */
export function utf8ByteLength(text: string): number {
  let bytes = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff && i + 1 < text.length) {
      const next = text.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        bytes += 4;
        i++;
      } else bytes += 3;
    } else bytes += 3;
  }
  return bytes;
}

export function isTextWithinLimit(text: string): boolean {
  // 1 文字は UTF-8 で最大 3 バイト（サロゲートペアは 2 文字で 4 バイト）。明らかに収まるときは数えない
  if (text.length * 3 <= MAX_TEXT_BYTES) return true;
  return utf8ByteLength(text) <= MAX_TEXT_BYTES;
}

export type TextFileCheck = { ok: true } | { ok: false; reason: "extension" | "tooLarge" };

/** 文書ファイル（.md・.markdown・.txt、2MB まで）として読み込めるか */
export function checkTextFile(file: FileLike): TextFileCheck {
  if (!isTextFileName(file.name)) return { ok: false, reason: "extension" };
  if (file.size > MAX_TEXT_BYTES) return { ok: false, reason: "tooLarge" };
  return { ok: true };
}

/** 一度に渡されたファイルを、文書・画像・それ以外に分ける */
export function classifyFiles<T extends FileLike>(files: readonly T[]) {
  const texts: T[] = [];
  const images: T[] = [];
  const unsupported: T[] = [];
  for (const file of files) {
    if (isTextFileName(file.name)) texts.push(file);
    else if (isImageFileName(file.name)) images.push(file);
    else unsupported.push(file);
  }
  return { texts, images, unsupported };
}

export type ImageRejectReason = "extension" | "count" | "totalSize";

/**
 * 画像を追加できるか調べる。同じ名前の画像は置き換える。
 * 上限（枚数・合計サイズ）を超える分は読み込まずに返す（先に渡されたものから受け付ける）
 */
export function acceptImages<T extends FileLike>(
  current: readonly FileLike[],
  incoming: readonly T[],
): { accepted: T[]; rejected: { file: T; reason: ImageRejectReason }[] } {
  const accepted: T[] = [];
  const rejected: { file: T; reason: ImageRejectReason }[] = [];
  const kept = (names: Set<string>) => current.filter((file) => !names.has(file.name));
  for (const file of incoming) {
    if (!isImageFileName(file.name)) {
      rejected.push({ file, reason: "extension" });
      continue;
    }
    const names = new Set([...accepted.map((f) => f.name), file.name]);
    const next = [...kept(names), ...accepted.filter((f) => f.name !== file.name), file];
    if (next.length > MAX_IMAGE_COUNT) {
      rejected.push({ file, reason: "count" });
      continue;
    }
    if (next.reduce((sum, f) => sum + f.size, 0) > MAX_IMAGE_TOTAL_BYTES) {
      rejected.push({ file, reason: "totalSize" });
      continue;
    }
    const index = accepted.findIndex((f) => f.name === file.name);
    if (index >= 0) accepted.splice(index, 1);
    accepted.push(file);
  }
  return { accepted, rejected };
}

/** 受け付けた画像を今の一覧に入れる（同じ名前は置き換え） */
export function mergeImages<T extends FileLike>(
  current: readonly T[],
  accepted: readonly T[],
): T[] {
  const names = new Set(accepted.map((file) => file.name));
  return [...current.filter((file) => !names.has(file.name)), ...accepted];
}
