import type { AppManifest } from "../../platform/types.ts";
export const manifest = {
  id: "speed-test",
  path: "speed-test",
  name: { ja: "回線速度テスト", en: "Internet Speed Test" },
  description: {
    ja: "インターネットの下り・上りの速度と Ping を測定",
    en: "Measure your internet speed: download, upload, and ping",
  },
  highlights: {
    ja: ["ボタンひとつで測定", "下り・上り・Ping・ジッター", "この速度でできることの目安"],
    en: ["One-click test", "Download, upload, ping & jitter", "What your speed can handle"],
  },
  category: "other",
  status: "public",
  icon: "gauge",
  order: 40,
  menu: [{ page: "", label: { ja: "測定", en: "Test" } }],
} satisfies AppManifest;
