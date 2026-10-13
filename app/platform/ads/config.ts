/**
 * 広告（AdSense）の設定値。ビルド時の環境変数（VITE_ 接頭辞）から読む。
 *
 * - VITE_ADSENSE_CLIENT：サイト運営者 ID（`ca-pub-<数字>`）。形式が違えば未設定と同じ扱い
 * - VITE_ADSENSE_SLOT_<形式>：形式ごとの既定の広告ユニット ID（数字のみ）。AdSlot の slot 省略時に使う
 *
 * 単体テストで vi.stubEnv で差し替えられるよう、モジュールの読み込み時ではなく呼び出し時に読む。
 */

export type AdFormat = "banner" | "sidebar" | "responsive" | "in-article";

/** 形式ごとに確保する高さ（px） */
export const AD_MIN_HEIGHT: Record<AdFormat, number> = {
  banner: 90,
  sidebar: 600,
  responsive: 250,
  "in-article": 250,
};

/** 1 ページに出す広告枠の上限（docs/site-plan.md §5） */
export const MAX_ADS_PER_PAGE = 3;

const CLIENT_RE = /^ca-pub-\d+$/;
const SLOT_RE = /^\d+$/;

/** `ca-pub-<数字>` の形式ならその値、それ以外は null */
export function normalizeAdClient(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed && CLIENT_RE.test(trimmed) ? trimmed : null;
}

/** 数字だけの広告ユニット ID ならその値、それ以外は null */
export function normalizeAdSlotId(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed && SLOT_RE.test(trimmed) ? trimmed : null;
}

/** AdSense のクライアント ID（未設定・形式違いは null） */
export function getAdClient(): string | null {
  return normalizeAdClient(import.meta.env.VITE_ADSENSE_CLIENT);
}

/** 形式の既定の広告ユニット ID（未設定・形式違いは null） */
export function getDefaultAdSlotId(format: AdFormat): string | null {
  // import.meta.env はビルド時に静的に置き換わるので、キーを組み立てずに 1 つずつ書く
  const env = import.meta.env;
  const value = {
    banner: env.VITE_ADSENSE_SLOT_BANNER,
    sidebar: env.VITE_ADSENSE_SLOT_SIDEBAR,
    responsive: env.VITE_ADSENSE_SLOT_RESPONSIVE,
    "in-article": env.VITE_ADSENSE_SLOT_IN_ARTICLE,
  }[format];
  return normalizeAdSlotId(value);
}
