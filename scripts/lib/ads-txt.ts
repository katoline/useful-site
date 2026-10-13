/**
 * ads.txt（ドメイン直下）の中身を作る。AdSense のサイト運営者 ID（VITE_ADSENSE_CLIENT の `ca-pub-…`）が
 * 設定されているときだけ、Google の認定販売者の 1 行を出す。未設定なら ads.txt 自体を出さない。
 *
 * Node の型除去で直接読む（scripts/vite-plugin-site-files.ts から）ので、何も import しない。
 */

/** Google の認定 ID（TAG-ID。AdSense の ads.txt の案内にある固定値） */
const GOOGLE_TAG_ID = "f08c47fec0942fa0";

export type AdsTxtResult =
  | { kind: "none" }
  | { kind: "ok"; body: string }
  | { kind: "invalid"; value: string };

/** VITE_ADSENSE_CLIENT の値から ads.txt を作る。形式が違えば invalid（出さずに警告する） */
export function buildAdsTxt(client: string | undefined): AdsTxtResult {
  const value = client?.trim();
  if (!value) return { kind: "none" };
  const match = /^ca-(pub-\d+)$/.exec(value);
  if (!match) return { kind: "invalid", value };
  return { kind: "ok", body: `google.com, ${match[1]}, DIRECT, ${GOOGLE_TAG_ID}\n` };
}
