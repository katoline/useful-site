/**
 * 保存名の決定：Markdown の最初の h1（ATX の `# 見出し` か Setext の `見出し\n===`）を文書のタイトルにする。
 * 印刷中の document.title（PDF の保存名の初期値）と、.md の保存名に使う。
 */

const FENCE_RE = /^ {0,3}(`{3,}|~{3,})/;
const ATX_H1_RE = /^ {0,3}#(?:[ \t]+(.*?))?(?:[ \t]+#+)?[ \t]*$/;
const SETEXT_H1_RE = /^ {0,3}=+[ \t]*$/;
/** ファイル名に使えない文字（Windows の禁止文字）。制御文字は toFileName で文字コードで判定する */
const FORBIDDEN_CHARS = new Set(["\\", "/", ":", "*", "?", '"', "<", ">", "|"]);
const MAX_NAME_LENGTH = 80;

/** 見出しの Markdown 記法を外して文字だけにする */
export function stripInlineMarkdown(text: string): string {
  return text
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[\^[^\]]*\]/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/`+([^`]*)`+/g, "$1")
    .replace(/(\*\*|__|~~)(.+?)\1/g, "$2")
    .replace(/([*_])(.+?)\1/g, "$2")
    .replace(/\\([!-/:-@[-`{-~])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/** 最初の h1 の文字（コードブロックの中は見ない）。無ければ null */
export function extractFirstHeading(markdown: string): string | null {
  const lines = markdown.split(/\r\n|\r|\n/);
  let fence: string | null = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const fenceMatch = FENCE_RE.exec(line);
    if (fence) {
      if (fenceMatch?.[1] && fenceMatch[1][0] === fence[0] && fenceMatch[1].length >= fence.length)
        fence = null;
      continue;
    }
    if (fenceMatch?.[1]) {
      fence = fenceMatch[1];
      continue;
    }
    const atx = ATX_H1_RE.exec(line);
    if (atx) {
      const text = stripInlineMarkdown(atx[1] ?? "");
      if (text) return text;
      continue;
    }
    const next = lines[i + 1];
    if (next !== undefined && SETEXT_H1_RE.test(next) && line.trim() && !/^ {4,}/.test(line)) {
      const text = stripInlineMarkdown(line);
      if (text) return text;
    }
  }
  return null;
}

/** ファイル名として安全な文字列にする（禁止文字を空白に、長さを制限）。空になれば fallback */
export function toFileName(title: string | null, fallback: string): string {
  const cleaned = [...(title ?? "")]
    .map((char) =>
      char.charCodeAt(0) < 0x20 || char === "\u007f" || FORBIDDEN_CHARS.has(char) ? " " : char,
    )
    .join("")
    .replace(/\s+/g, " ")
    .replace(/^[\s.]+|[\s.]+$/g, "");
  const limited = [...cleaned].slice(0, MAX_NAME_LENGTH).join("").trim();
  return limited || fallback;
}

/** 文書のタイトル（印刷中の document.title。PDF の保存名の初期値） */
export function documentTitle(markdown: string, fallback: string): string {
  return toFileName(extractFirstHeading(markdown), fallback);
}

/** .md の保存名 */
export function markdownFileName(markdown: string, fallback: string): string {
  return `${documentTitle(markdown, fallback)}.md`;
}
