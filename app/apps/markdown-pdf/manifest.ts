import type { AppManifest } from "../../platform/types.ts";
export const manifest = {
  id: "markdown-pdf",
  path: "markdown-pdf",
  name: { ja: "Markdown → PDF", en: "Markdown to PDF" },
  description: {
    ja: "Markdown をブラウザ内で整えて PDF に保存",
    en: "Turn Markdown into a print-ready PDF in your browser",
  },
  category: "document",
  status: "public",
  icon: "file-text",
  order: 20,
  menu: [{ page: "", label: { ja: "変換", en: "Convert" } }],
} satisfies AppManifest;
