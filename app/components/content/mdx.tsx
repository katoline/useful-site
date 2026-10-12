/**
 * MDX（content/<lang>/*.mdx）の表示。plan.md §2.6・§9.3。
 *
 * MDX の書き方（content/ の記事で守ること）
 * - 先頭で `export const frontmatter = { title, description, datePublished, dateModified }` を出す
 *   （YAML の frontmatter は使わない）。title はページの h1・<title>、description は meta description
 * - 本文の見出しは h2 から。h1 はページ側で出す
 * - サイト内リンクは BASE_PATH と言語接頭辞を付けないページパスで書く（例 `[変換](/convert/png-to-webp/)`）。
 *   表示中の言語の URL に直して <Link> にする
 * - 記事内広告は `<Ad />`（ガイドのみ）
 */
import type { MDXComponents, MDXContent } from "mdx/types";
import type { ComponentProps } from "react";
import { Link } from "react-router";
import { AdSlot } from "~/components/ads/AdSlot";
import { type Lang, localizedPath, useLang } from "~/i18n";
import "./prose.css";

export interface ContentFrontmatter {
  title: string;
  description: string;
  /** YYYY-MM-DD */
  datePublished: string;
  dateModified: string;
}

export interface ContentModule {
  default: MDXContent;
  frontmatter: ContentFrontmatter;
}

/** import.meta.glob の結果から、言語と名前（ファイル名から .mdx を除いたもの）で記事を選ぶ */
export function pickContent(
  modules: Record<string, ContentModule>,
  lang: Lang,
  name: string,
): ContentModule | undefined {
  const suffix = `/content/${lang}/${name}.mdx`;
  const key = Object.keys(modules).find((k) => k.endsWith(suffix));
  return key ? modules[key] : undefined;
}

/** サイト内リンク（"/guide/…/#x"）を表示中の言語の URL に直す。外部リンクはそのまま */
export function MdxLink({ href = "", children, ...props }: ComponentProps<"a">) {
  const lang = useLang();
  if (href.startsWith("/") && !href.startsWith("//")) {
    const [path = "", hash] = href.split("#");
    const to = `${localizedPath(lang, path)}${hash ? `#${hash}` : ""}`;
    return (
      <Link to={to} {...props}>
        {children}
      </Link>
    );
  }
  if (/^https?:\/\//.test(href)) {
    return (
      <a href={href} rel="noopener noreferrer" {...props}>
        {children}
      </a>
    );
  }
  return (
    <a href={href} {...props}>
      {children}
    </a>
  );
}

/** 記事内広告（plan.md §7.2。解説ページの本文中に 1〜2 枠） */
function InArticleAd() {
  return <AdSlot format="in-article" />;
}

const COMPONENTS: MDXComponents = { a: MdxLink, Ad: InArticleAd };

/** 記事の本文（見出し・表・コードの見た目は prose.css） */
export function ContentBody({ content }: { content: ContentModule }) {
  const Body = content.default;
  return (
    <div className="prose-content">
      <Body components={COMPONENTS} />
    </div>
  );
}
