import { Menu } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router";
import { SITE_NAME } from "../config";
import { useI18n } from "../i18n";
import { createAppPaths } from "../paths/app-paths";
import { listedApps } from "../registry";
import { AppIcon } from "../registry/icons";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "../ui/sheet";
import { cn } from "../utils";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { LocalizedLink, LocalizedNavLink } from "./LocalizedLink";
import type { ShellConfig } from "./Shell";
import { ThemeMenu, ThemeToggleGroup } from "./ThemeSwitcher";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "inline-flex min-h-11 items-center rounded-md px-3 text-sm transition-colors",
    isActive ? "font-semibold text-foreground" : "text-muted-foreground hover:text-foreground",
  );
export function SiteHeader({ config }: { config: ShellConfig }) {
  const { t, lang } = useI18n();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    void location.key;
    setMenuOpen(false);
  }, [location.key]);
  const close = () => setMenuOpen(false);
  const sitePath = createAppPaths("");
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        {t("nav.skipToContent")}
      </a>
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4">
        <Link
          to={sitePath.localizedPath(lang, "")}
          data-testid="site-home"
          className="inline-flex min-h-11 shrink-0 items-center text-sm font-bold"
        >
          {SITE_NAME[lang]}
        </Link>
        {config.appPath && (
          <>
            <span aria-hidden className="text-muted-foreground">
              /
            </span>
            <LocalizedLink
              page=""
              data-testid="logo"
              className="inline-flex min-h-11 items-center gap-2 text-sm font-bold"
            >
              {config.logo}
              {config.name[lang]}
            </LocalizedLink>
          </>
        )}
        <nav
          aria-label={t("registry.currentApp")}
          className="hidden flex-1 items-center gap-1 md:flex"
        >
          {config.menu.map((item) => (
            <LocalizedNavLink key={item.page} page={item.page} className={navLinkClass}>
              {item.label[lang]}
            </LocalizedNavLink>
          ))}
        </nav>
        <div className="ml-auto hidden items-center gap-1 md:flex">
          <LanguageSwitcher />
          <ThemeMenu />
        </div>
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto shrink-0 md:ml-0"
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
                onClick={close}
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
                        onClick={close}
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
                  onClick={close}
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
