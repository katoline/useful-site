/** 「PDF を保存」の近くに置く、端末別の保存のしかた */
import { useMdI18n } from "../../../i18n";

export function PrintHelp() {
  const { t } = useMdI18n();
  return (
    <div className="text-sm text-muted-foreground" data-testid="print-help">
      <p>{t("print.helpLead")}</p>
      <details className="mt-1">
        <summary className="inline-flex min-h-11 cursor-pointer items-center font-medium text-foreground">
          {t("print.helpTitle")}
        </summary>
        <ul className="list-disc space-y-1 pl-5">
          <li>{t("print.helpPc")}</li>
          <li>{t("print.helpMac")}</li>
          <li>{t("print.helpIos")}</li>
          <li>{t("print.helpAndroid")}</li>
        </ul>
      </details>
    </div>
  );
}
