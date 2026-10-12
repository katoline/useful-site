import { Menu } from "lucide-react";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "~/components/ui/sheet";
import { useI18n } from "~/i18n";
import { cn } from "~/lib/utils";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { LocalizedLink, LocalizedNavLink } from "./LocalizedLink";
import { LogoMark } from "./LogoMark";
import { NAV_ITEMS } from "./nav-items";
import { ThemeMenu, ThemeToggleGroup } from "./ThemeSwitcher";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "inline-flex min-h-11 items-center rounded-md px-3 text-sm transition-colors",
    isActive ? "font-semibold text-foreground" : "text-muted-foreground hover:text-foreground",
  );

export function SiteHeader() {
  const { t } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        {t("nav.skipToContent")}
      </a>
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4">
        <LocalizedLink
          page=""
          className="mr-2 inline-flex min-h-11 items-center gap-2 text-base font-bold tracking-tight"
          data-testid="logo"
        >
          <LogoMark size={24} />
          {t("site.name")}
        </LocalizedLink>

        {/* PC：ナビ・言語・テーマを横に並べる */}
        <nav aria-label={t("nav.menu")} className="hidden flex-1 items-center gap-1 md:flex">
          {NAV_ITEMS.map((item) => (
            <LocalizedNavLink key={item.page} page={item.page} className={navLinkClass}>
              {t(item.label)}
            </LocalizedNavLink>
          ))}
        </nav>
        <div className="ml-auto hidden items-center gap-1 md:flex">
          <LanguageSwitcher />
          <ThemeMenu />
        </div>

        {/* スマホ：メニュー内にまとめる（§6.2） */}
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto md:hidden"
              aria-label={t("nav.openMenu")}
              data-testid="mobile-menu-button"
            >
              <Menu aria-hidden />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" closeLabel={t("nav.closeMenu")} aria-describedby={undefined}>
            <SheetTitle>{t("nav.menu")}</SheetTitle>
            <nav aria-label={t("nav.menu")} className="flex flex-col">
              {NAV_ITEMS.map((item) => (
                <LocalizedNavLink
                  key={item.page}
                  page={item.page}
                  className={navLinkClass}
                  onClick={() => setMenuOpen(false)}
                >
                  {t(item.label)}
                </LocalizedNavLink>
              ))}
            </nav>
            <div className="flex flex-col gap-2 border-t border-border pt-4">
              <p className="text-xs font-medium text-muted-foreground">{t("lang.label")}</p>
              <LanguageSwitcher onSwitch={() => setMenuOpen(false)} />
            </div>
            <div className="flex flex-col gap-2 border-t border-border pt-4">
              <p className="text-xs font-medium text-muted-foreground">{t("theme.label")}</p>
              <ThemeToggleGroup />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
