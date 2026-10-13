import type { MouseEvent } from "react";
import { Link } from "react-router";
import { useI18n } from "../i18n";
import { EXTERNAL_TRANSMISSION_ANCHOR } from "../legal/paths";
import { createAppPaths } from "../paths/app-paths";
import { handleAppNavigation } from "./app-navigation";
import { LocalizedLink } from "./LocalizedLink";
import type { ShellConfig } from "./Shell";

const linkClass = "inline-flex min-h-11 items-center hover:text-foreground";
export function SiteFooter({ config }: { config: ShellConfig }) {
  const { lang, t } = useI18n();
  const { localizedPath } = createAppPaths("");
  const navigate = (event: MouseEvent<HTMLAnchorElement>) =>
    handleAppNavigation(event, config.appPath);
  return (
    <footer className="mt-16 border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-muted-foreground">
        {config.footerExtra}
        <nav aria-label={config.name[lang]}>
          <ul className="flex flex-wrap gap-x-4 gap-y-1">
            {config.footer?.map((item) => (
              <li key={item.page}>
                <LocalizedLink page={item.page} className={linkClass}>
                  {item.label[lang]}
                </LocalizedLink>
              </li>
            ))}
            <li>
              <Link to={localizedPath(lang, "privacy")} className={linkClass} onClick={navigate}>
                {t("legal.privacy")}
              </Link>
            </li>
            <li>
              <Link to={localizedPath(lang, "terms")} className={linkClass} onClick={navigate}>
                {t("legal.terms")}
              </Link>
            </li>
            <li>
              <Link
                to={`${localizedPath(lang, "privacy")}#${EXTERNAL_TRANSMISSION_ANCHOR}`}
                className={linkClass}
                onClick={navigate}
              >
                {t("legal.externalTransmission")}
              </Link>
            </li>
            {config.footerLinksExtra}
          </ul>
        </nav>
        {config.footerNote && <p>{config.footerNote[lang]}</p>}
        <p>© {config.name[lang]}</p>
      </div>
    </footer>
  );
}
