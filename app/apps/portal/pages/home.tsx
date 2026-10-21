import { ArrowRight, Check } from "lucide-react";
import { Link } from "react-router";
import { AdSlot } from "~/platform/ads/AdSlot";
import { absoluteUrl, SITE_NAME } from "~/platform/config";
import { langFromPathname, useI18n } from "~/platform/i18n";
import { createAppPaths } from "~/platform/paths/app-paths";
import { listedApps } from "~/platform/registry";
import { AppIcon } from "~/platform/registry/icons";
import { buildPageMeta } from "~/platform/seo/meta";
import { Shell } from "~/platform/shell/Shell";
import type { AppCategory } from "~/platform/types";
import { Badge } from "~/platform/ui/badge";
import { externalLinks } from "../external-links";
import { en } from "../i18n/en";
import { ja } from "../i18n/ja";
import { manifest } from "../manifest";

function entries(lang: "ja" | "en") {
  return [
    ...listedApps.map((app) => ({
      ...app,
      url: createAppPaths(app.path).localizedPath(lang, ""),
      external: false,
    })),
    ...externalLinks
      .filter((entry) => entry.status !== "hidden")
      .map((entry) => ({ ...entry, external: true })),
  ].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id.localeCompare(b.id));
}
export function meta({ location }: { location: { pathname: string } }) {
  const lang = langFromPathname(location.pathname);
  const url = absoluteUrl(createAppPaths("").localizedPath(lang, ""));
  return buildPageMeta({
    lang,
    page: "",
    title: SITE_NAME[lang],
    description: manifest.description[lang],
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: SITE_NAME[lang],
        url,
        inLanguage: lang,
      },
      {
        "@context": "https://schema.org",
        "@type": "ItemList",
        itemListElement: entries(lang).map((entry, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: entry.name[lang],
          url: entry.external ? entry.url : absoluteUrl(entry.url),
        })),
      },
    ],
  });
}
export default function Home() {
  const { lang, t } = useI18n();
  const dict = lang === "ja" ? ja : en;
  const apps = entries(lang);
  return (
    <Shell config={{ appPath: "", name: SITE_NAME, menu: [] }}>
      <h1 className="text-3xl font-bold">{SITE_NAME[lang]}</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">{dict.lead}</p>
      <div className="mt-6 space-y-6">
        {(["image", "document", "other"] as AppCategory[]).map((category) => {
          const group = apps.filter((app) => app.category === category);
          if (!group.length) return null;
          return (
            <section key={category} aria-labelledby={`category-${category}`}>
              <h2 id={`category-${category}`} className="mb-3 text-lg font-semibold">
                {t(
                  category === "image"
                    ? "registry.categories.image"
                    : category === "document"
                      ? "registry.categories.document"
                      : "registry.categories.other",
                )}
              </h2>
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {group.map((app) => {
                  const highlights = app.highlights?.[lang] ?? [];
                  const body = (
                    <>
                      <div className="flex items-start gap-3">
                        <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
                          <AppIcon icon={app.icon} className="size-6" />
                        </span>
                        <div className="min-w-0">
                          <h3 className="flex flex-wrap items-center gap-2 font-semibold leading-snug">
                            {app.name[lang]}
                            {app.status === "beta" && <Badge>{t("registry.beta")}</Badge>}
                          </h3>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {app.description[lang]}
                          </p>
                        </div>
                      </div>
                      {highlights.length > 0 && (
                        <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                          {highlights.map((highlight) => (
                            <li key={highlight} className="flex items-start gap-2">
                              <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-success" />
                              <span>{highlight}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      <div className="mt-auto flex items-center justify-end gap-3 pt-4 text-xs font-medium text-muted-foreground">
                        {app.external && <span>{dict.external}</span>}
                        <span className="inline-flex items-center gap-1 transition-colors group-hover:text-foreground">
                          {dict.open}
                          <ArrowRight
                            aria-hidden
                            className="size-3.5 transition-transform group-hover:translate-x-0.5"
                          />
                        </span>
                      </div>
                    </>
                  );
                  const className =
                    "group flex h-full min-h-11 flex-col rounded-lg border border-border bg-card p-4 text-card-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
                  return (
                    <li key={app.id} className="h-full">
                      {app.external ? (
                        <a
                          href={app.url}
                          rel="noopener noreferrer"
                          target="_blank"
                          className={className}
                        >
                          {body}
                        </a>
                      ) : (
                        <Link to={app.url} aria-label={app.name[lang]} className={className}>
                          {body}
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
      <div className="mt-10">
        <AdSlot format="responsive" />
      </div>
    </Shell>
  );
}
