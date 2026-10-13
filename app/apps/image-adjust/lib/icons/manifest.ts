/**
 * site.webmanifest の組み立て（純粋関数）。
 */
import { type IconSettings, sanitizeIconSettings } from "./settings";

export interface ManifestIcon {
  src: string;
  sizes: string;
  type: string;
  purpose?: "any" | "maskable";
}

export interface WebManifest {
  name: string;
  short_name: string;
  icons: ManifestIcon[];
  theme_color: string;
  background_color: string;
  display: "standalone";
}

/** 名前が空のときに使う既定名 */
export const FALLBACK_APP_NAME = "My Site";

export function buildWebManifest(input: IconSettings): WebManifest {
  const s = sanitizeIconSettings(input);
  const name = s.name || FALLBACK_APP_NAME;
  const shortName = s.shortName || name;
  // マニフェストのアイコンの src はマニフェストの URL からの相対で解決される。
  // ファイルは同じ場所に置く前提なので、ファイル名だけにしておけば設置先を変えても壊れない
  return {
    name,
    short_name: shortName,
    icons: [
      { src: "icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    theme_color: s.themeColor,
    background_color: s.backgroundColor,
    display: "standalone",
  };
}

export function serializeWebManifest(settings: IconSettings): string {
  return `${JSON.stringify(buildWebManifest(settings), null, 2)}\n`;
}
