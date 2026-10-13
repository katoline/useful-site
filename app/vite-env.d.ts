/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** canonical 等の絶対 URL のオリジン（既定は app/platform/config/index.ts） */
  readonly VITE_SITE_ORIGIN?: string;
  /** AdSense のクライアント ID（ca-pub-...）。未設定なら広告枠はプレースホルダー */
  readonly VITE_ADSENSE_CLIENT?: string;
  /** 形式ごとの既定の広告ユニット ID（数字のみ）。AdSlot の slot 省略時に使う */
  readonly VITE_ADSENSE_SLOT_BANNER?: string;
  readonly VITE_ADSENSE_SLOT_SIDEBAR?: string;
  readonly VITE_ADSENSE_SLOT_RESPONSIVE?: string;
  readonly VITE_ADSENSE_SLOT_IN_ARTICLE?: string;
  /** Cloudflare Web Analytics のトークン。未設定ならビーコンを入れない */
  readonly VITE_CF_ANALYTICS_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** 日英の OGP 画像が揃っているアプリ。dev の画像追加・削除でも更新する。 */
declare module "virtual:app-og-images" {
  export const appOgImagePaths: readonly string[];
}
