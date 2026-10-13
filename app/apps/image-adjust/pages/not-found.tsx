import type { MetaFunction } from "react-router";
import { createT, langFromPathname } from "~/apps/image-adjust/i18n";
import { NotFound } from "~/platform/shell/NotFound";

/** 存在しないパス（/404/ としてプリレンダリングし、404.html として配信される） */
export function meta({ location }: Parameters<MetaFunction>[0]) {
  const t = createT(langFromPathname(location.pathname));
  return [{ title: t("errors.notFoundTitle") }, { name: "robots", content: "noindex" }];
}

export default function NotFoundRoute() {
  return <NotFound />;
}
