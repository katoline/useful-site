/**
 * ZIP 内のパス名の正規化（§3.6）。パス名は保存時のファイル名にしか使わないが、
 * "../" や絶対パス・ドライブ文字・制御文字は取り除いておく。
 */

/** 展開しても意味のない付属ファイル（macOS のリソースフォーク等） */
export function isIgnorableZipEntry(path: string): boolean {
  const name = path.split("/").pop() ?? "";
  return (
    path.startsWith("__MACOSX/") ||
    path.includes("/__MACOSX/") ||
    name.startsWith("._") ||
    name === ".DS_Store" ||
    name === "Thumbs.db"
  );
}

/**
 * "../a/..\\b//c.png" → "a/b/c.png"。
 * - バックスラッシュは区切りとみなす
 * - 先頭のスラッシュ・ドライブ文字（C:）を落とす
 * - "." と ".." のセグメントは捨てる（上へ辿らせない）
 * - 制御文字は落とす
 * 空になったら null（呼び出し側が代わりの名前を付ける）
 */
export function normalizeZipPath(raw: string): string | null {
  const cleaned = stripControlChars(raw.replace(/\\/g, "/"));
  const withoutDrive = cleaned.replace(/^[a-zA-Z]:/, "");
  const segments = withoutDrive
    .split("/")
    .map((s) => s.trim())
    .filter((s) => s !== "" && s !== "." && s !== "..");
  if (segments.length === 0) return null;
  return segments.join("/");
}

/** 制御文字（0x00〜0x1f・0x7f）を落とす */
function stripControlChars(s: string): string {
  let out = "";
  for (const ch of s) {
    const code = ch.codePointAt(0) ?? 0;
    if (code >= 0x20 && code !== 0x7f) out += ch;
  }
  return out;
}
