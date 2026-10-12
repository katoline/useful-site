import type { ContentFrontmatter } from "~/components/content/mdx";
import { LocalizedLink } from "~/components/layout/LocalizedLink";
import { PageHeader } from "~/components/layout/PageHeader";
import { buildPageMeta, metaContext } from "~/components/seo/meta";
import { useI18n } from "~/i18n";
import { GUIDE_SLUGS } from "~/lib/site-routes";
import type { Route } from "./+types/guide._index";

/** 一覧には記事の frontmatter（title・description）だけを使う */
const GUIDES = import.meta.glob<ContentFrontmatter>(
  ["../../content/*/*.mdx", "!../../content/*/{about,privacy,terms}.mdx"],
  { eager: true, import: "frontmatter" },
);

export function meta({ location }: Route.MetaArgs) {
  const { lang, page, t } = metaContext(location.pathname);
  return buildPageMeta({
    lang,
    page,
    title: t("pages.guide.title"),
    description: t("pages.guide.description"),
  });
}

/** 解説ページの一覧 */
export default function GuideIndex() {
  const { t, lang } = useI18n();
  const items = GUIDE_SLUGS.map((slug) => {
    const key = Object.keys(GUIDES).find((k) => k.endsWith(`/content/${lang}/${slug}.mdx`));
    const frontmatter = key ? GUIDES[key] : undefined;
    return {
      slug,
      title: frontmatter?.title ?? t(`pages.guide.articles.${slug}`),
      description: frontmatter?.description ?? "",
    };
  });
  return (
    <>
      <PageHeader title={t("pages.guide.title")} lead={t("pages.guide.description")} />
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map(({ slug, title, description }) => (
          <li key={slug}>
            <LocalizedLink
              page={`guide/${slug}`}
              className="flex h-full flex-col gap-2 rounded-lg border border-border bg-card p-5 transition-colors hover:bg-accent"
            >
              <span className="font-semibold text-card-foreground">{title}</span>
              <span className="text-sm text-muted-foreground">{description}</span>
            </LocalizedLink>
          </li>
        ))}
      </ul>
    </>
  );
}
