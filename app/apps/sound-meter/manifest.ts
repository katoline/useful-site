import type { AppManifest } from "../../platform/types.ts";
export const manifest = {
  id: "sound-meter",
  path: "sound-meter",
  name: { ja: "音響解析", en: "Sound Analyzer" },
  description: {
    ja: "ボタンひとつで周りの音を測り、音の大きさと高さを数値にする",
    en: "Measure the sound around you and turn its loudness and pitch into numbers",
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
