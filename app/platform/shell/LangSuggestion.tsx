/**
 * ブラウザの言語が表示中のページと違い、まだ言語を選んでいなければ他言語版を案内する（§9.2）。
 * 自動リダイレクトはしない（クローラーが片方の言語しか見られなくなるため）。
 *
 * ハイドレーション後に出るので、ページの流れに入れるとレイアウトがずれる（CLS）。画面下の通知の
 * コンテナ（BottomNotices）に出す（スマホでは親指の届く位置。§6.2）。
 */
import { X } from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "react-router";
import { useHydrated } from "~/platform/hooks/use-hydrated";
import { type Lang, switchLangPath, translate, useLang } from "~/platform/i18n";
import { getItem, STORAGE_KEYS } from "~/platform/storage";
import { BottomNotice } from "./BottomNotices";
import { rememberLang } from "./LanguageSwitcher";
import { useShellPathname } from "./shell-path";

export function preferredBrowserLang(languages: readonly string[]): Lang {
  return languages[0]?.toLowerCase().startsWith("ja") ? "ja" : "en";
}

export function LangSuggestion() {
  const lang = useLang();
  const location = useLocation();
  const pathname = useShellPathname();
  const hydrated = useHydrated();
  const [dismissed, setDismissed] = useState(false);

  // navigator と localStorage はプリレンダリング時に無いので、ハイドレーション後に判定する
  if (!hydrated || dismissed || getItem(STORAGE_KEYS.lang)) return null;
  const languages = navigator.languages?.length ? navigator.languages : [navigator.language];
  const suggested = preferredBrowserLang(languages);
  if (suggested === lang) return null;

  return (
    <BottomNotice>
      <section
        lang={suggested}
        aria-label={translate(suggested, "lang.label")}
        className="pointer-events-auto rounded-lg border border-border bg-card text-card-foreground shadow-lg"
        data-testid="lang-suggestion"
      >
        <div className="flex items-center gap-3 py-1 pr-1 pl-4 text-sm">
          <span>{translate(suggested, "lang.suggestion")}</span>
          <Link
            to={{ pathname: switchLangPath(pathname, suggested), search: location.search }}
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
    </BottomNotice>
  );
}
