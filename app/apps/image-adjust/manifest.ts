import type { AppManifest } from "../../platform/types.ts";
export const manifest = {
  id: "image-adjust",
  path: "image-adjust",
  name: { ja: "画像の変換・圧縮", en: "Image Converter & Compressor" },
  description: {
    ja: "ブラウザで完結する画像の変換・圧縮・アイコン生成",
    en: "Convert, compress, and create icons in your browser",
  },
  highlights: {
    ja: ["PNG・JPEG・WebP の相互変換", "画質を保って軽くする", "favicon・アプリアイコン作成"],
    en: ["Convert PNG, JPEG, WebP", "Shrink file size", "Make favicons & app icons"],
  },
  category: "image",
  status: "public",
  icon: "image",
  order: 10,
  menu: [
    { page: "", label: { ja: "変換・圧縮", en: "Convert & compress" } },
    { page: "icons", label: { ja: "アイコン生成", en: "Icon generator" } },
    { page: "guide", label: { ja: "ガイド", en: "Guides" } },
  ],
} satisfies AppManifest;
