/**
 * 中央アイコンの受理（純粋関数）。
 *
 * 受け取るのは次の 2 種類だけで、ユーザーが入力した任意の文字列や URL は受け付けない。
 * - 組込の信頼済み固定 SVG（simple-icons のロゴ等）の内容
 * - Canvas で変換済みの PNG data URL（アップロード画像）
 *
 * SVG は危険な要素・属性を含まないことを確認し、viewBox と中身だけを取り出して
 * 自前の `<svg>` 要素へ組み直す（元の外側のタグは使わない）。
 */
import { MAX_ICON_DATA_URL_LENGTH } from "../../../domain/qr-settings";

export interface SvgViewBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 呼び出し側が渡すアイコン */
export type CenterIconInput =
  | { kind: "none" }
  | { kind: "svg"; svg: string }
  | { kind: "png"; dataUrl: string };

/** 検証を終えたアイコン（SVG は中身と viewBox、PNG は data URL だけを持つ） */
export type CenterIcon =
  | { kind: "none" }
  | { kind: "svg"; inner: string; viewBox: SvgViewBox }
  | { kind: "png"; dataUrl: string };

/** SVG に入っていたら拒否する要素・属性（外部参照・スクリプト・スタイル・イベント） */
const FORBIDDEN_SVG_TOKENS = [
  "<script",
  "<foreignobject",
  "<iframe",
  "<use",
  "<image",
  "<style",
  "<animate",
  "<set",
  "<handler",
  "<!entity",
  "<!doctype",
  "javascript:",
  "url(",
  "href",
  "xlink:",
  "data:",
] as const;

const SVG_EVENT_ATTRIBUTE = /\son[a-z]+\s*=/;
const PNG_DATA_URL = /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/;

function parseViewBox(rootTag: string): SvgViewBox | null {
  const match = /viewbox\s*=\s*["']([^"']*)["']/i.exec(rootTag);
  const raw = match?.[1];
  if (raw === undefined) return null;
  const parts = raw.trim().split(/[\s,]+/);
  if (parts.length !== 4) return null;
  const numbers = parts.map((part) => Number(part));
  const x = numbers[0];
  const y = numbers[1];
  const width = numbers[2];
  const height = numbers[3];
  if (
    x === undefined ||
    y === undefined ||
    width === undefined ||
    height === undefined ||
    !numbers.every((n) => Number.isFinite(n)) ||
    width <= 0 ||
    height <= 0
  ) {
    return null;
  }
  return { x, y, width, height };
}

/** 信頼済み固定 SVG を検証して、中身と viewBox を取り出す（不可なら null） */
export function parseTrustedSvgIcon(svg: unknown): { inner: string; viewBox: SvgViewBox } | null {
  if (typeof svg !== "string") return null;
  const trimmed = svg.trim();
  if (!/^<svg[\s>]/i.test(trimmed)) return null;

  const lower = trimmed.toLowerCase();
  for (const token of FORBIDDEN_SVG_TOKENS) {
    if (lower.includes(token)) return null;
  }
  if (SVG_EVENT_ATTRIBUTE.test(lower)) return null;
  // ルートの `<svg>` は 1 つだけ
  if (lower.split("<svg").length !== 2) return null;

  const rootEnd = trimmed.indexOf(">");
  const closeIndex = trimmed.lastIndexOf("</svg>");
  if (rootEnd < 0 || closeIndex <= rootEnd) return null;

  const viewBox = parseViewBox(trimmed.slice(0, rootEnd + 1));
  if (!viewBox) return null;

  const inner = trimmed.slice(rootEnd + 1, closeIndex).trim();
  if (inner === "") return null;

  return { inner, viewBox };
}

/** Canvas で変換済みの PNG data URL だけを受け付ける */
export function isPngDataUrl(dataUrl: unknown): dataUrl is string {
  if (typeof dataUrl !== "string") return false;
  if (dataUrl.length > MAX_ICON_DATA_URL_LENGTH) return false;
  return PNG_DATA_URL.test(dataUrl);
}

/** どんな入力でも安全な {@link CenterIcon} に正規化する（不正ならアイコン無し） */
export function normalizeCenterIcon(input: CenterIconInput | null | undefined): CenterIcon {
  if (!input || input.kind === "none") return { kind: "none" };
  if (input.kind === "svg") {
    const parsed = parseTrustedSvgIcon(input.svg);
    return parsed
      ? { kind: "svg", inner: parsed.inner, viewBox: parsed.viewBox }
      : { kind: "none" };
  }
  if (isPngDataUrl(input.dataUrl)) return { kind: "png", dataUrl: input.dataUrl };
  return { kind: "none" };
}
