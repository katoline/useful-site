import { type LinksFunction, Outlet } from "react-router";
import type { Lang } from "~/platform/i18n";
import { Shell } from "~/platform/shell/Shell";
import { LogoMark } from "./components/layout/LogoMark";
import { FOOTER_ITEMS } from "./components/layout/nav-items";
import { InstallPrompt } from "./components/pwa/InstallPrompt";
import { PwaRoot } from "./components/pwa/PwaRoot";
import { createT } from "./i18n";
import { BASE_PATH } from "./lib/config";
import { manifestFileName } from "./lib/pwa";
import { manifest } from "./manifest";

export function appLinks(lang: Lang): ReturnType<LinksFunction> {
  return [
    { rel: "manifest", href: `${BASE_PATH}/${manifestFileName(lang)}` },
    { rel: "icon", href: `${BASE_PATH}/favicon.ico`, sizes: "32x32" },
    { rel: "icon", href: `${BASE_PATH}/favicon.svg`, type: "image/svg+xml" },
    { rel: "apple-touch-icon", href: `${BASE_PATH}/apple-touch-icon.png` },
  ];
}

export default function ImageAdjustLayout() {
  const translations = { ja: createT("ja"), en: createT("en") };
  return (
    <Shell
      config={{
        appPath: manifest.path,
        name: manifest.name,
        menu: manifest.menu,
        logo: <LogoMark size={24} className="shrink-0" />,
        footer: FOOTER_ITEMS.map((item) => ({
          page: item.page,
          label: { ja: translations.ja(item.label), en: translations.en(item.label) },
        })),
        footerNote: { ja: translations.ja("footer.note"), en: translations.en("footer.note") },
        footerExtra: <InstallPrompt />,
      }}
    >
      <Outlet />
      <PwaRoot />
    </Shell>
  );
}
