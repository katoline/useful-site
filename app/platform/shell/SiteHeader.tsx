import { ChevronDown, ChevronRight, Grid2X2, Menu } from "lucide-react";
import { type MouseEvent, useEffect, useState } from "react";
import { Link, useLocation } from "react-router";
import { SITE_NAME } from "../config";
import { useI18n } from "../i18n";
import { createAppPaths } from "../paths/app-paths";
import { listedApps } from "../registry";
import { AppIcon } from "../registry/icons";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "../ui/sheet";
import { cn } from "../utils";
import { handleAppNavigation } from "./app-navigation";
import { LanguageMenu, LanguageSwitcher } from "./LanguageSwitcher";
import { LocalizedLink, LocalizedNavLink } from "./LocalizedLink";
import type { ShellConfig } from "./Shell";
import { ThemeMenu, ThemeToggleGroup } from "./ThemeSwitcher";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "inline-flex min-h-11 items-center rounded-md px-3 text-sm transition-colors",
    isActive ? "font-semibold text-foreground" : "text-muted-foreground hover:text-foreground",
  );

/** ヘッダー（PC）のアプリ一覧。現在のアプリには aria-current を付ける */
function AppsMenu({ config }: { config: ShellConfig }) {
  const { t, lang } = useI18n();
  const navigate = (event: MouseEvent<HTMLAnchorElement>) =>
    handleAppNavigation(event, config.appPath);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-11 px-2.5"
          aria-label={t("nav.tools")}
          data-testid="apps-menu"
        >
          <Grid2X2 aria-hidden />
          <span>{t("nav.tools")}</span>
          <ChevronDown aria-hidden className="size-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[12rem]">
        {listedApps.map((app) => {
          const current = config.appPath === app.path;
          return (
            <DropdownMenuItem key={app.id} asChild>
              <Link
                to={createAppPaths(app.path).localizedPath(lang, "")}
                onClick={navigate}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "cursor-pointer",
                  current && "bg-muted font-semibold text-foreground",
                )}
              >
                <AppIcon icon={app.icon} />
                <span>{app.name[lang]}</span>
                {app.status === "beta" && <Badge>{t("registry.beta")}</Badge>}
              </Link>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function SiteHeader({ config }: { config: ShellConfig }) {
  const { t, lang } = useI18n();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    void location.key;
    setMenuOpen(false);
  }, [location.key]);
  const close = () => setMenuOpen(false);
  const navigate = (event: MouseEvent<HTMLAnchorElement>) =>
    handleAppNavigation(event, config.appPath);
  const navigateAndClose = (event: MouseEvent<HTMLAnchorElement>) => {
    navigate(event);
    close();
  };
  const sitePath = createAppPaths("");
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        {t("nav.skipToContent")}
      </a>
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-1 px-3 sm:px-4">
        <Link
          to={sitePath.localizedPath(lang, "")}
          data-testid="site-home"
          onClick={navigate}
          className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md px-2 text-sm font-bold sm:justify-start"
        >
          {/* スマホではアプリ名が切れないよう、サイト名の代わりにアイコンだけを出す */}
          <Grid2X2 aria-hidden className="size-5 sm:hidden" />
          <span className="sr-only sm:not-sr-only">{SITE_NAME[lang]}</span>
        </Link>
        {config.appPath && (
          <>
            <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />
            <LocalizedLink
              page=""
              data-testid="logo"
              className="inline-flex min-h-11 min-w-0 items-center gap-2 text-sm font-bold"
            >
              {config.logo}
              <span className="truncate">{config.name[lang]}</span>
            </LocalizedLink>
          </>
        )}
        <div className="ml-auto hidden shrink-0 items-center gap-1 md:flex">
          <LanguageMenu />
          <ThemeMenu />
          <AppsMenu config={config} />
        </div>
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto shrink-0 md:hidden"
              aria-label={t("nav.openMenu")}
              data-testid="mobile-menu-button"
            >
              <Menu aria-hidden />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" closeLabel={t("nav.closeMenu")} aria-describedby={undefined}>
            <SheetTitle>{t("nav.menu")}</SheetTitle>
            <nav aria-label={t("nav.menu")} className="flex flex-col gap-4">
              <Link
                to={sitePath.localizedPath(lang, "")}
                className="inline-flex min-h-11 items-center rounded-md px-3 text-sm font-semibold"
                onClick={navigateAndClose}
              >
                {SITE_NAME[lang]}
              </Link>
              <div>
                <p className="mb-1 px-3 text-xs font-medium text-muted-foreground">
                  {t("registry.apps")}
                </p>
                <ul>
                  {listedApps.map((app) => (
                    <li key={app.id}>
                      <Link
                        to={createAppPaths(app.path).localizedPath(lang, "")}
                        onClick={navigateAndClose}
                        aria-current={config.appPath === app.path ? "page" : undefined}
                        className={cn(
                          "flex min-h-11 items-center gap-2 rounded-md px-3 text-sm",
                          config.appPath === app.path ? "bg-muted font-semibold" : "hover:bg-muted",
                        )}
                      >
                        <AppIcon icon={app.icon} />
                        <span>{app.name[lang]}</span>
                        {app.status === "beta" && <Badge>{t("registry.beta")}</Badge>}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
              {config.menu.length > 0 && (
                <div>
                  <p className="mb-1 px-3 text-xs font-medium text-muted-foreground">
                    {t("registry.currentApp")}
                  </p>
                  <ul>
                    {config.menu.map((item) => (
                      <li key={item.page}>
                        <LocalizedNavLink page={item.page} className={navLinkClass} onClick={close}>
                          {item.label[lang]}
                        </LocalizedNavLink>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </nav>
            <div className="flex flex-col gap-2 border-t border-border pt-4">
              <p className="text-xs font-medium text-muted-foreground">{t("lang.label")}</p>
              <LanguageSwitcher onSwitch={close} />
            </div>
            <div className="flex flex-col gap-2 border-t border-border pt-4">
              <p className="text-xs font-medium text-muted-foreground">{t("theme.label")}</p>
              <ThemeToggleGroup />
            </div>
            <nav
              aria-label={t("legal.terms")}
              className="flex flex-col border-t border-border pt-4"
            >
              {(["privacy", "terms"] as const).map((page) => (
                <Link
                  key={page}
                  to={sitePath.localizedPath(lang, page)}
                  onClick={navigateAndClose}
                  className="inline-flex min-h-11 items-center text-sm"
                >
                  {t(page === "privacy" ? "legal.privacy" : "legal.terms")}
                </Link>
              ))}
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
