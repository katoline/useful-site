/** これまでの結果（この端末の localStorage） */

import { Button } from "~/platform/ui/button";
import type { SpeedTestResult } from "../../../domain/measurement";
import { useSpeedI18n } from "../../../i18n";
import { formatDateTime, formatMbps, formatMs } from "./format";

export function HistoryList({
  history,
  onClear,
}: {
  history: readonly SpeedTestResult[];
  onClear(): void;
}) {
  const { t, lang } = useSpeedI18n();
  return (
    <section aria-labelledby="st-history-title" className="rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="st-history-title" className="text-lg font-semibold">
          {t("history.title")}
        </h2>
        {history.length > 0 && (
          <Button variant="ghost" onClick={onClear}>
            {t("history.clear")}
          </Button>
        )}
      </div>
      {history.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">{t("history.empty")}</p>
      ) : (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-sm tabular-nums" data-testid="history">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="py-1 pr-3 font-medium">{t("history.date")}</th>
                <th className="py-1 pr-3 text-right font-medium">{t("result.download")}</th>
                <th className="py-1 pr-3 text-right font-medium">{t("result.upload")}</th>
                <th className="py-1 text-right font-medium">{t("result.ping")}</th>
              </tr>
            </thead>
            <tbody>
              {history.map((item) => (
                <tr key={item.measuredAt} className="border-t border-border">
                  <td className="py-1.5 pr-3 whitespace-nowrap">
                    {formatDateTime(lang, item.measuredAt)}
                  </td>
                  <td className="py-1.5 pr-3 text-right">{formatMbps(lang, item.downloadMbps)}</td>
                  <td className="py-1.5 pr-3 text-right">{formatMbps(lang, item.uploadMbps)}</td>
                  <td className="py-1.5 text-right">{formatMs(lang, item.latency.pingMs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
