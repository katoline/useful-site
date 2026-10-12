/**
 * 生成するファイルの一覧（plan.md §2.4）。
 * kind で描き方が変わる：
 * - favicon / any：設定どおり（余白・背景・角丸。背景は透過可）
 * - apple：iOS は透過部分を黒で埋めるので背景を必ず塗り、角丸は付けない（iOS が自分で丸める）
 * - maskable：背景を必ず塗り、セーフゾーンに収まるよう縮める。角丸は付けない（OS が切り抜く）
 * - og：1200×630 の背景に、設定どおりのアイコンを中央に置く
 */

export type IconKind = "favicon" | "apple" | "any" | "maskable" | "og";

export interface PngSpec {
  file: string;
  width: number;
  height: number;
  kind: IconKind;
}

/** favicon.ico に入れるサイズ */
export const ICO_SIZES = [16, 32, 48] as const;

export const PNG_SPECS: readonly PngSpec[] = [
  { file: "favicon-16x16.png", width: 16, height: 16, kind: "favicon" },
  { file: "favicon-32x32.png", width: 32, height: 32, kind: "favicon" },
  { file: "apple-touch-icon.png", width: 180, height: 180, kind: "apple" },
  { file: "icon-192.png", width: 192, height: 192, kind: "any" },
  { file: "icon-512.png", width: 512, height: 512, kind: "any" },
  { file: "icon-maskable-512.png", width: 512, height: 512, kind: "maskable" },
];

export const OG_SPEC: PngSpec = { file: "og-image.png", width: 1200, height: 630, kind: "og" };

/** OGP 画像で、アイコンが占める高さの割合 */
export const OG_ICON_RATIO = 0.6;

export const FILE_NAMES = {
  ico: "favicon.ico",
  svg: "favicon.svg",
  manifest: "site.webmanifest",
  zip: "favicons.zip",
} as const;
