import { useI18n } from "~/platform/i18n";
import { Button } from "~/platform/ui/button";
import { LocalizedLink } from "./LocalizedLink";
import { PageHeader } from "./PageHeader";

/** 404 の本文（routes/not-found.tsx と、パラメータが不正なときの各ルートで使う） */
export function NotFound() {
  const { t } = useI18n();
  return (
    <>
      <PageHeader title={t("errors.notFoundTitle")} lead={t("errors.notFoundBody")} />
      <Button asChild variant="outline">
        <LocalizedLink page="">{t("errors.backHome")}</LocalizedLink>
      </Button>
    </>
  );
}
