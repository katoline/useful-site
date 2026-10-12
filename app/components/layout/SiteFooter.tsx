import { Link } from "react-router";
import { InstallPrompt } from "~/components/pwa/InstallPrompt";
import { localizedPath, useI18n } from "~/i18n";
import { EXTERNAL_TRANSMISSION_ANCHOR } from "~/lib/site-routes";
import { LocalizedLink } from "./LocalizedLink";
import { FOOTER_ITEMS } from "./nav-items";

const linkClass = "inline-flex min-h-11 items-center hover:text-foreground";

export function SiteFooter() {
  const { t, lang } = useI18n();
  return (
    <footer className="mt-16 border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-muted-foreground">
        {/* インストール導線（Android はボタン、iOS は案内。インストール済みなら出ない） */}
        <InstallPrompt />
        <nav aria-label={t("site.name")}>
          <ul className="flex flex-wrap gap-x-4 gap-y-1">
            {FOOTER_ITEMS.map((item) => (
              <li key={item.page}>
                <LocalizedLink page={item.page} className={linkClass}>
                  {t(item.label)}
                </LocalizedLink>
              </li>
            ))}
            {/* 外部送信規律（電気通信事業法）の公表事項へのリンク。全ページに出す */}
            <li>
              <Link
                to={`${localizedPath(lang, "privacy")}#${EXTERNAL_TRANSMISSION_ANCHOR}`}
                className={linkClass}
              >
                {t("legal.externalTransmission")}
              </Link>
            </li>
          </ul>
        </nav>
        <p>{t("footer.note")}</p>
        <p>© {t("site.name")}</p>
      </div>
    </footer>
  );
}
