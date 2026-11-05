import { GuideIndexPage, guideIndexMeta, guideItems } from "~/platform/content/articles";
import type { ContentFrontmatter } from "~/platform/content/mdx";
import { useLang } from "~/platform/i18n";
import { createAppPaths } from "~/platform/paths/app-paths";
import { GUIDE_SLUGS } from "../../domain/guides";
import { manifest } from "../../manifest";

/** 一覧には記事の frontmatter（title・description）だけを使う */
const GUIDES = import.meta.glob<ContentFrontmatter>("../../content/*/*.mdx", {
  eager: true,
  import: "frontmatter",
});

export function meta({ location }: { location: { pathname: string } }) {
  const { lang } = createAppPaths(manifest.path).splitLangPath(location.pathname);
  return guideIndexMeta({ lang, appPath: manifest.path, appName: manifest.name[lang] });
}

/** 解説記事の一覧 */
export default function GuideIndex() {
  const lang = useLang();
  return (
    <GuideIndexPage appName={manifest.name[lang]} items={guideItems(GUIDES, lang, GUIDE_SLUGS)} />
  );
}
