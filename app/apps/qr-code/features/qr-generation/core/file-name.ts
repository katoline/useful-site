/** 保存するファイル名を組み立てる（純粋関数）。ホスト名は無害化する。 */

const MAX_HOST_LENGTH = 40;

/** ホスト名をファイル名に使える形にする（不可なら null） */
export function sanitizeHostForFileName(host: unknown): string | null {
  if (typeof host !== "string") return null;
  const cleaned = host
    .toLowerCase()
    .replace(/^www\./, "")
    .replace(/[^a-z0-9.-]+/g, "-")
    .replace(/^[-.]+/, "")
    .slice(0, MAX_HOST_LENGTH)
    .replace(/[-.]+$/, "");
  return cleaned === "" ? null : cleaned;
}

/** `example.com.png` のような保存名。ホスト名が無ければ `qr-code.png` */
export function qrFileName(host: unknown, extension: "png" | "svg"): string {
  const base = sanitizeHostForFileName(host) ?? "qr-code";
  return `${base}.${extension}`;
}
