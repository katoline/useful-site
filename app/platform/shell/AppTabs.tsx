import { useI18n } from "../i18n";
import { cn } from "../utils";
import { LocalizedNavLink } from "./LocalizedLink";
import type { ShellConfig } from "./Shell";

const tabClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "inline-flex h-11 shrink-0 items-center border-b-2 px-3 text-sm transition-colors",
    isActive
      ? "border-foreground font-semibold text-foreground"
      : "border-transparent text-muted-foreground hover:text-foreground",
  );

/**
 * アプリ内のページのタブ（ヘッダーの直下）。項目が 2 つ以上のアプリだけに出す。
 * スマホでもメニューを開かずに移動できるよう、ヘッダーの外に出している。
 */
export function AppTabs({ config }: { config: ShellConfig }) {
  const { t, lang } = useI18n();
  if (config.menu.length < 2) return null;
  return (
    <nav
      aria-label={t("registry.currentApp")}
      className="border-b border-border bg-background"
      data-testid="app-tabs"
    >
      {/* 幅が足りないときは横スクロール。ページ全体は横にはみ出さない */}
      <div className="mx-auto flex max-w-6xl items-center gap-1 overflow-x-auto px-3 sm:px-4">
        {config.menu.map((item) => (
          <LocalizedNavLink key={item.page} page={item.page} className={tabClass}>
            {item.label[lang]}
          </LocalizedNavLink>
        ))}
      </div>
    </nav>
  );
}
