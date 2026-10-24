import type { AppManifest } from "../../platform/types.ts";
export const manifest = {
  id: "sound-meter",
  path: "sound-meter",
  name: { ja: "騒音計", en: "Sound Level Meter" },
  description: {
    ja: "周りの音をデシベル（dB）で測り、周波数も分析",
    en: "Measure the noise around you in decibels (dB) and analyze its frequency",
  },
  highlights: {
    ja: ["騒音レベル（dB）を計測", "平均・最大・L90 を集計", "周波数と音域の内訳"],
    en: ["Noise level in dB", "Average, max & L90", "Frequency & band breakdown"],
  },
  category: "other",
  status: "public",
  icon: "audio-lines",
  order: 30,
  menu: [{ page: "", label: { ja: "計測", en: "Measure" } }],
} satisfies AppManifest;
