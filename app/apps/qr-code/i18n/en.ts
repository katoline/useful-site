import { manifest } from "../manifest.ts";
import type { Dictionary } from "./types.ts";

/**
 * QRコード生成の文言（英語）。ja.ts と同じキー・同じ置換変数にする（tests/unit/i18n.test.ts が検査する）。
 */
export const en = {
  site: { name: manifest.name.en },
  page: {
    title: "QR Code Generator",
    metaTitle: "Create a QR code from a URL (with an icon, all in your browser)",
    lead: "Enter a URL to create a QR code and place an icon in the center. Save it as PNG or SVG. Your URL and images are never sent to a server.",
    description:
      "A free tool that turns a URL into a QR code and lets you embed a service logo or your own image in the center. Error correction is fixed at H, and you can choose the colors and sizes and save as PNG or SVG. Everything runs in your browser.",
    appName: "QR Code Generator",
  },
  url: {
    label: "URL",
    placeholder: "https://example.com/",
    hint: "Enter a URL that starts with http:// or https://. This tool never visits the URL or fetches its contents.",
    empty: "Enter a URL and the QR code will appear here.",
  },
  icon: {
    title: "Center icon",
    none: "No icon",
    generic: "Generic icons",
    brand: "Service logos",
    upload: "Use your own image",
    uploadLabel: "Choose an image to place in the center",
    choosing: "Loading the image…",
    remove: "Remove the image",
    size: "Icon size",
    sizeValue: "{percent}% of the QR code width",
    hint: "PNG, JPEG, or WebP up to 2 MB and 4096 px. Large images are scaled down to 512 px before embedding.",
    credits:
      "Service names and logos are trademarks of their respective owners. This site is not affiliated with them, and they do not endorse this tool.",
    icons: {
      link: "Link",
      globe: "Globe",
      heart: "Heart",
      star: "Star",
      mail: "Mail",
      phone: "Phone",
      "shopping-bag": "Shopping",
      camera: "Camera",
      user: "User",
      "map-pin": "Map",
      github: "GitHub",
      youtube: "YouTube",
      instagram: "Instagram",
      x: "X",
      line: "LINE",
      discord: "Discord",
      whatsapp: "WhatsApp",
      facebook: "Facebook",
      tiktok: "TikTok",
      telegram: "Telegram",
    },
  },
  settings: {
    title: "Settings",
    color: "QR code color",
    colorCustom: "Choose a color",
    colorInvalid: "Not enough contrast against the white background. Choose a darker color.",
    size: "PNG size",
    sizeValue: "{size} px",
    fixed:
      "Error correction is fixed at H (about 30% recovery) with a 4-module quiet zone. The background is white.",
  },
  result: {
    title: "Preview",
    generating: "Creating the QR code…",
    invalid: "Check the URL.",
    caution:
      "Before sharing, test that the code scans with the devices and apps you actually use. The center icon and the colors can make it harder to scan.",
    savePng: "Save PNG",
    saveSvg: "Save SVG",
  },
  errors: {
    empty: "Enter a URL.",
    scheme: "Enter a URL that starts with http:// or https://.",
    host: "Could not read the host name from the URL.",
    tooLong: "The URL is too long (up to {limit} bytes).",
    resolution:
      "At the selected PNG size the code is too coarse to scan. Choose a PNG size of at least {size}.",
    generate: "Could not create the QR code. Check the URL and the settings.",
    iconType: "{name} cannot be loaded as an image (PNG, JPEG, or WebP).",
    iconSize: "{name} is too large (up to {limit}).",
    iconDimension: "{name} must be {limit} or smaller in each dimension.",
    iconRead: "Could not load {name}. The image may be corrupted.",
    iconBlocked:
      "The center icon cannot be used, so saving is disabled. Choose another image or switch to no icon.",
    dismiss: "Close",
  },
  faq: {
    title: "Frequently asked questions",
    q1: "Are my URL and images sent to a server?",
    a1: "No. Creating the QR code, the preview, and saving PNG or SVG all happen in your browser. The tool does not visit the URL or fetch its favicon.",
    q2: "Are the URL, settings, and icon saved?",
    a2: "No. They are kept only in this tab's memory so they survive switching languages, and are not stored on your device or on the operator's servers. Reloading clears them.",
    q3: "Won't the center icon make the code unscannable?",
    a3: "Error correction is set to H (about 30% recovery), which covers the area hidden by the icon. How easily it scans still depends on the device, the app, and the print quality. Test with real devices before sharing. Scanning is not guaranteed.",
    q4: "Can I change the color and size?",
    a4: "You can choose the QR code color, but colors without enough contrast against the white background cannot be saved. You can pick the PNG size (256 / 512 / 1024 / 2048 px) and the center icon size (12–20% of the QR code width).",
    q5: "Can I use the service names and logos freely?",
    a5: "Service names and logos are trademarks of their respective owners. This site is not affiliated with them, and they do not endorse this tool. Follow each company's brand guidelines when you use their logos.",
    q6: "How do I save the result?",
    a6: "Use “Save PNG” or “Save SVG” below the preview. PNG works as an image, and SVG stays sharp at any size as a vector. The SVG also embeds the icon and contains no external references.",
  },
} satisfies Dictionary;
