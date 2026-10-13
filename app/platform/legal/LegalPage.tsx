import { SITE_NAME } from "../config";
import { ContentBody, type ContentModule } from "../content/mdx";
import { LOCALE, useLang } from "../i18n";
import { PageHeader } from "../shell/PageHeader";
import { Shell } from "../shell/Shell";
import { AppLegalSections } from "./index";
import type { LegalPage as LegalPageName } from "./paths";

export function LegalPage({ content, page }: { content: ContentModule; page: LegalPageName }) {
  const lang = useLang();
  const { title, dateModified } = content.frontmatter;
  const date = new Intl.DateTimeFormat(LOCALE[lang], {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${dateModified}T00:00:00Z`));
  return (
    <Shell config={{ appPath: "", name: SITE_NAME, menu: [] }}>
      <article>
        <PageHeader
          title={title}
          lead={
            <time dateTime={dateModified} className="text-sm">
              {lang === "ja" ? `更新日：${date}` : `Updated: ${date}`}
            </time>
          }
        />
        <ContentBody content={content} appPath="" />
        <div className="prose-content">
          <AppLegalSections page={page} lang={lang} />
        </div>
      </article>
    </Shell>
  );
}
