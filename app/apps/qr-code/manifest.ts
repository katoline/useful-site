import type { AppManifest } from "../../platform/types.ts";
export const manifest = {
  id: "qr-code",
  path: "qr-code",
  name: { ja: "QRコード生成", en: "QR Code Generator" },
  description: {
    ja: "URLからQRコードを作り、中央にアイコンを入れて保存",
    en: "Create a QR code from a URL and embed an icon in the center",
  },
  highlights: {
    ja: ["URL から QR コード", "中央にロゴやアイコン", "PNG・SVG で保存"],
    en: ["QR code from a URL", "Logo or icon in the center", "Save as PNG or SVG"],
  },
  category: "image",
  status: "public",
  icon: "qr-code",
  order: 30,
  menu: [{ page: "", label: { ja: "QRコード生成", en: "QR code generator" } }],
} satisfies AppManifest;
