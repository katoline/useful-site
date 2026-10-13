import type { MDXContent } from "mdx/types";
import { MdxBody } from "../content/mdx";
import type { Lang } from "../i18n/langs";
import { allApps } from "../registry";
import type { LegalPage } from "./paths";

const sections = import.meta.glob<{ default: MDXContent }>(
  "../../apps/*/legal/{privacy,terms}.{ja,en}.mdx",
  { eager: true },
);

export function AppLegalSections({ page, lang }: { page: LegalPage; lang: Lang }) {
  return allApps.map((app) => {
    const section = sections[`../../apps/${app.id}/legal/${page}.${lang}.mdx`];
    return section ? (
      <section key={app.id} data-app-legal={app.id}>
        <h2>{app.name[lang]}</h2>
        <MdxBody body={section.default} appPath={app.path} />
      </section>
    ) : null;
  });
}
