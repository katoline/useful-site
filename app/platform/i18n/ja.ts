import { SITE_NAME } from "../config";
export const ja = {
  lang: {
    label: "言語",
    ja: "日本語",
    en: "English",
    suggestion: "日本語版があります",
    suggestionLink: "日本語で見る",
    dismiss: "閉じる",
  },
  theme: {
    label: "テーマ",
    light: "ライト",
    dark: "ダーク",
    system: "端末の設定に従う",
  },
  ads: {
    label: "広告",
  },
  common: {
    close: "閉じる",
    comingSoon: "このページは準備中です。",
  },
  errors: {
    notFoundTitle: "ページが見つかりません",
    notFoundBody: "URL が間違っているか、ページが移動した可能性があります。",
    genericTitle: "エラーが発生しました",
    genericBody: "ページを再読み込みしてください。",
    backHome: "トップへ戻る",
  },
  nav: {
    menu: "メニュー",
    openMenu: "メニューを開く",
    closeMenu: "メニューを閉じる",
    skipToContent: "本文へスキップ",
    home: "ホーム",
    tools: "ツール一覧",
  },
  registry: {
    apps: "アプリ一覧",
    currentApp: "このアプリのページ",
    beta: "ベータ版",
    categories: { image: "画像", document: "文書", other: "その他" },
  },
  legal: {
    privacy: "プライバシーポリシー",
    terms: "利用規約・免責事項",
    externalTransmission: "外部送信について",
  },
  site: { name: SITE_NAME.ja },
} as const;
