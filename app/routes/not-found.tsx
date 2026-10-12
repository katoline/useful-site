import { NotFound } from "~/components/layout/NotFound";
import { createT, langFromPathname } from "~/i18n";
import type { Route } from "./+types/not-found";

/** 存在しないパス（/404/ としてプリレンダリングし、404.html として配信される） */
export function meta({ location }: Route.MetaArgs) {
  const t = createT(langFromPathname(location.pathname));
  return [{ title: t("errors.notFoundTitle") }, { name: "robots", content: "noindex" }];
}

export default function NotFoundRoute() {
  return <NotFound />;
}
