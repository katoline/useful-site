/**
 * ブラウザの言語が表示中のページと違い、まだ言語を選んでいなければ他言語版を案内する（§9.2）。
 * 自動リダイレクトはしない（クローラーが片方の言語しか見られなくなるため）。
 */
import { X } from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "react-router";
import { useHydrated } from "~/hooks/use-hydrated";
import { type Lang, switchLangPath, translate, useLang } from "~/i18n";
import { getItem, STORAGE_KEYS } from "~/lib/storage";
import { rememberLang } from "./LanguageSwitcher";

export function preferredBrowserLang(languages: readonly string[]): Lang {
  return languages[0]?.toLowerCase().startsWith("ja") ? "ja" : "en";
}

export function LangSuggestion() {
  const lang = useLang();
  const location = useLocation();
  const hydrated = useHydrated();
  const [dismissed, setDismissed] = useState(false);

  // navigator と localStorage はプリレンダリング時に無いので、ハイドレーション後に判定する
  if (!hydrated || dismissed || getItem(STORAGE_KEYS.lang)) return null;
  const languages = navigator.languages?.length ? navigator.languages : [navigator.language];
  const suggested = preferredBrowserLang(languages);
  if (suggested === lang) return null;

  return (
    <section
      lang={suggested}
      aria-label={translate(suggested, "lang.label")}
      className="border-b border-border bg-surface"
      data-testid="lang-suggestion"
    >
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-1 text-sm">
        <span>{translate(suggested, "lang.suggestion")}</span>
        <Link
          to={{ pathname: switchLangPath(location.pathname, suggested), search: location.search }}
          preventScrollReset
          hrefLang={suggested}
          className="inline-flex min-h-11 items-center font-medium underline underline-offset-4"
          onClick={() => rememberLang(suggested)}
        >
          {translate(suggested, "lang.suggestionLink")}
        </Link>
        <button
          type="button"
          className="ml-auto inline-flex size-11 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
          aria-label={translate(suggested, "lang.dismiss")}
          onClick={() => {
            rememberLang(lang);
            setDismissed(true);
          }}
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
    </section>
  );
}
