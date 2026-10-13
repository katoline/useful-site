import { Link, type LinkProps, NavLink, type NavLinkProps, useLocation } from "react-router";
import { type Lang, useLang } from "~/platform/i18n";
import { createAppPaths, parsePath } from "~/platform/paths";
import { useShellAppPath } from "./shell-path";

type PageProps = {
  /** 言語に依存しないページパス（例 "icons"、"convert/png-to-webp"、トップは ""） */
  page: string;
  /** 省略時は表示中の言語 */
  lang?: Lang;
};

/** 表示中の言語のページへのリンク。サイト内リンクは原則これを使う */
export function LocalizedLink({ page, lang, ...props }: Omit<LinkProps, "to"> & PageProps) {
  const current = useLang();
  const { pathname } = useLocation();
  const explicit = useShellAppPath();
  const { localizedPath } = createAppPaths(explicit ?? parsePath(pathname).appPath);
  return <Link to={localizedPath(lang ?? current, page)} {...props} />;
}

export function LocalizedNavLink({ page, lang, ...props }: Omit<NavLinkProps, "to"> & PageProps) {
  const current = useLang();
  const { pathname } = useLocation();
  const explicit = useShellAppPath();
  const { localizedPath } = createAppPaths(explicit ?? parsePath(pathname).appPath);
  return <NavLink to={localizedPath(lang ?? current, page)} end={page === ""} {...props} />;
}
