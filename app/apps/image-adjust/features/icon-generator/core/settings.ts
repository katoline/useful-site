/**
 * アイコン生成の設定（plan.md §2.4）。UI からも、サイト自身の PWA アイコン作成（§6.1）からも使う。
 * ここは DOM に依存しない。
 */

export interface IconSettings {
  /** 余白（一辺に対する割合。0〜0.4） */
  padding: number;
  /** 背景色（#rrggbb）。null なら透過 */
  background: string | null;
  /** 角丸の半径（一辺に対する割合。0〜0.5。0.5 で円） */
  radius: number;
  /** マニフェストの name */
  name: string;
  /** マニフェストの short_name */
  shortName: string;
  /** マニフェストの theme_color（#rrggbb） */
  themeColor: string;
  /** マニフェストの background_color（#rrggbb）。透過できないアイコン（apple-touch・maskable）の背景にも使う */
  backgroundColor: string;
  /** og-image.png を作るか */
  includeOg: boolean;
  /** ファイルを置く場所（HTML スニペット・マニフェストのパスの接頭辞）。例 "/"、"/blog/"、"https://example.com/" */
  basePath: string;
}

export const DEFAULT_ICON_SETTINGS: IconSettings = {
  padding: 0,
  background: null,
  radius: 0,
  name: "",
  shortName: "",
  themeColor: "#ffffff",
  backgroundColor: "#ffffff",
  includeOg: false,
  basePath: "/",
};

export const PADDING_MAX = 0.4;
export const RADIUS_MAX = 0.5;

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

/** #rrggbb でなければ fallback を返す（小文字にそろえる） */
export function normalizeHexColor(value: string | null | undefined, fallback: string): string {
  return value && HEX_COLOR.test(value) ? value.toLowerCase() : fallback;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

/** 範囲外・不正な値を直した設定を返す */
export function sanitizeIconSettings(input: IconSettings): IconSettings {
  return {
    ...input,
    padding: clamp(input.padding, 0, PADDING_MAX),
    radius: clamp(input.radius, 0, RADIUS_MAX),
    background: input.background === null ? null : normalizeHexColor(input.background, "#ffffff"),
    themeColor: normalizeHexColor(input.themeColor, DEFAULT_ICON_SETTINGS.themeColor),
    backgroundColor: normalizeHexColor(
      input.backgroundColor,
      DEFAULT_ICON_SETTINGS.backgroundColor,
    ),
    name: input.name.trim(),
    shortName: input.shortName.trim(),
    basePath: normalizeBasePath(input.basePath),
  };
}

/**
 * 設置先として使える値か。"/"・"./"・"../"・"http(s)://" のどれかで始まるもの。
 * "example.com" のようにスキームの無いドメインは相対パスになってリンクが壊れるので受け付けない
 */
export function isValidBasePath(value: string): boolean {
  return /^(?:\/|\.\/|\.\.\/|https?:\/\/)/i.test(value.trim());
}

/** 接頭辞の末尾を "/" にそろえる。空・使えない値なら "/" */
export function normalizeBasePath(value: string): string {
  const trimmed = value.trim();
  if (!isValidBasePath(trimmed)) return "/";
  return trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
}
