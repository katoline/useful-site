/**
 * 言語切り替え（plan.md §9.2）。同じページの他言語版へクライアント側遷移する。
 * ツールの状態は ToolSessionProvider（ルートより上）にあるので、切り替えても失われない。
 */
import { Check, ChevronDown, Globe, Languages } from "lucide-react";
import { Link, useLocation } from "react-router";
import { LANGS, type Lang, switchLangPath, translate, useI18n } from "~/platform/i18n";
import { STORAGE_KEYS, setItem } from "~/platform/storage";
import { Button } from "~/platform/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "~/platform/ui/dropdown-menu";
import { cn } from "~/platform/utils";
import { useShellPathname } from "./shell-path";

export function rememberLang(lang: Lang) {
  setItem(STORAGE_KEYS.lang, lang);
}

export function LanguageSwitcher({
  className,
  onSwitch,
}: {
  className?: string;
  onSwitch?: () => void;
}) {
  const { lang, t } = useI18n();
  const location = useLocation();
  const pathname = useShellPathname();

  return (
    <nav aria-label={t("lang.label")} className={cn("flex items-center gap-1", className)}>
      <Languages className="size-4 text-muted-foreground" aria-hidden />
      {LANGS.map((l, i) => (
        <span key={l} className="flex items-center">
          {i > 0 && (
            <span className="px-0.5 text-muted-foreground" aria-hidden>
              /
            </span>
          )}
          <Link
            to={{
              pathname: switchLangPath(pathname, l),
              search: location.search,
              hash: location.hash,
            }}
            preventScrollReset
            hrefLang={l}
            lang={l}
            aria-current={l === lang ? "true" : undefined}
            data-testid={`lang-${l}`}
            onClick={() => {
              rememberLang(l);
              onSwitch?.();
            }}
            className={cn(
              "inline-flex min-h-11 items-center rounded-md px-2 text-sm",
              l === lang
                ? "font-semibold text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {translate(l, `lang.${l}`)}
          </Link>
        </span>
      ))}
    </nav>
  );
}

/** ヘッダー（PC）の言語切り替え：現在の言語を出し、押すとドロップダウンで選ぶ */
export function LanguageMenu({ className }: { className?: string }) {
  const { lang, t } = useI18n();
  const location = useLocation();
  const pathname = useShellPathname();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn("h-11 px-2.5", className)}
          aria-label={t("lang.label")}
          data-testid="lang-menu"
        >
          <Globe aria-hidden />
          <span>{t(`lang.${lang}`)}</span>
          <ChevronDown aria-hidden className="size-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{t("lang.label")}</DropdownMenuLabel>
        {LANGS.map((l) => (
          <DropdownMenuItem key={l} asChild>
            <Link
              to={{
                pathname: switchLangPath(pathname, l),
                search: location.search,
                hash: location.hash,
              }}
              preventScrollReset
              hrefLang={l}
              lang={l}
              aria-current={l === lang ? "true" : undefined}
              data-testid={`lang-${l}`}
              onClick={() => rememberLang(l)}
              className={cn("cursor-pointer", l === lang && "font-semibold text-foreground")}
            >
              {translate(l, `lang.${l}`)}
              {l === lang && <Check aria-hidden className="ml-auto" />}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
