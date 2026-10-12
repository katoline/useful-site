/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** canonical 等の絶対 URL のオリジン（既定は app/lib/config.ts） */
  readonly VITE_SITE_ORIGIN?: string;
  /** AdSense のクライアント ID（ca-pub-...）。未設定なら広告枠はプレースホルダー */
  readonly VITE_ADSENSE_CLIENT?: string;
  /** Cloudflare Web Analytics のトークン。未設定ならビーコンを入れない */
  readonly VITE_CF_ANALYTICS_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
