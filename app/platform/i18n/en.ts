import { SITE_NAME } from "../config";
import type { Dictionary } from "./types";
export const en = {
  lang: {
    label: "Language",
    ja: "日本語",
    en: "English",
    suggestion: "English version available",
    suggestionLink: "View in English",
    dismiss: "Dismiss",
  },
  theme: {
    label: "Theme",
    light: "Light",
    dark: "Dark",
    system: "System",
  },
  ads: {
    label: "Advertisement",
  },
  common: {
    close: "Close",
    comingSoon: "This page is coming soon.",
  },
  errors: {
    notFoundTitle: "Page not found",
    notFoundBody: "The URL may be wrong, or the page may have moved.",
    genericTitle: "Something went wrong",
    genericBody: "Please reload the page.",
    backHome: "Back to home",
  },
  nav: {
    menu: "Menu",
    openMenu: "Open menu",
    closeMenu: "Close menu",
    skipToContent: "Skip to content",
    home: "Home",
  },
  registry: {
    apps: "Apps",
    currentApp: "Pages in this app",
    beta: "Beta",
    categories: { image: "Images", document: "Documents", other: "Other" },
  },
  legal: {
    privacy: "Privacy policy",
    terms: "Terms & disclaimer",
    externalTransmission: "External transmission",
  },
  site: { name: SITE_NAME.en },
} satisfies Dictionary;
