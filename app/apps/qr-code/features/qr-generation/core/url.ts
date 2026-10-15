/** 入力 URL の検証（純粋関数）。http / https だけを許可する。 */
import { MAX_URL_BYTES } from "../../../domain/qr-settings";
import { utf8ByteLength } from "./utf8";

export type UrlError =
  /** 空欄 */
  | "empty"
  /** URL として解釈できない */
  | "invalid"
  /** http / https 以外 */
  | "scheme"
  /** UTF-8 バイト数の上限を超える */
  | "too-long";

export type UrlValidation =
  | { ok: true; url: string; bytes: number }
  | { ok: false; error: UrlError; bytes: number };

/**
 * 入力文字列を検証し、正規化した URL を返す。
 * 空欄・上限超過・不正な形式・http(s) 以外を弾き、理由を返す。
 */
export function validateQrUrl(input: unknown): UrlValidation {
  if (typeof input !== "string") return { ok: false, error: "empty", bytes: 0 };
  const trimmed = input.trim();
  if (trimmed === "") return { ok: false, error: "empty", bytes: 0 };

  const bytes = utf8ByteLength(trimmed);
  if (bytes > MAX_URL_BYTES) return { ok: false, error: "too-long", bytes };

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, error: "invalid", bytes };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, error: "scheme", bytes };
  }
  if (parsed.hostname === "") return { ok: false, error: "invalid", bytes };

  return { ok: true, url: parsed.href, bytes };
}
