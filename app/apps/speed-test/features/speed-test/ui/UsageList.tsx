/** この速度でできることの目安（用途ごとに足りているか） */
import { Check, TriangleAlert } from "lucide-react";
import { cn } from "~/platform/utils";
import { canHandle, type SpeedTestResult, USAGES } from "../../../domain/measurement";
import { useSpeedI18n } from "../../../i18n";

export function UsageList({ result }: { result: SpeedTestResult }) {
  const { t } = useSpeedI18n();
  return (
    <section aria-labelledby="st-usage-title">
      <h3 id="st-usage-title" className="text-base font-semibold">
        {t("usage.title")}
      </h3>
      <ul className="mt-2 grid gap-2 sm:grid-cols-2" data-testid="usage-list">
        {USAGES.map((usage) => {
          const ok = canHandle(usage, result);
          const need =
            t("usage.need", { down: usage.downMbps }) +
            (usage.upMbps ? t("usage.needUp", { up: usage.upMbps }) : "") +
            (usage.pingMs ? t("usage.needPing", { ping: usage.pingMs }) : "");
          return (
            <li
              key={usage.id}
              className="flex items-start gap-2 rounded-md border border-border p-3 text-sm"
            >
              {ok ? (
                <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-success" />
              ) : (
                <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
              )}
              <span className="flex-1">
                <span className="font-medium">{t(`usage.${usage.id}`)}</span>
                <span className="block text-xs text-muted-foreground">{need}</span>
              </span>
              <span
                className={cn("shrink-0 text-xs font-medium", ok ? "text-success" : "text-warning")}
              >
                {ok ? t("usage.ok") : t("usage.ng")}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
