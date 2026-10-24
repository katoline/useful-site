/** 結果の 4 つの数値（測定中は出た順に埋まる）と、測定先 */
import { Activity, ArrowDown, ArrowUp, Timer } from "lucide-react";
import type { ReactNode } from "react";
import type { LatencyResult, ServerInfo } from "../../../domain/measurement";
import { type DictKey, useSpeedI18n } from "../../../i18n";
import { formatMbps, formatMs } from "./format";

function Card({
  icon,
  label,
  hint,
  value,
  unit,
  testId,
}: {
  icon: ReactNode;
  label: string;
  hint: string;
  value: string;
  unit: string;
  testId: string;
}) {
  return (
    <div className="rounded-md bg-muted p-4">
      <dt className="flex items-center gap-1.5 text-sm font-medium [&_svg]:size-4">
        {icon}
        {label}
      </dt>
      <dd className="mt-1 text-3xl font-bold tabular-nums" data-testid={testId}>
        {value}
        <span className="ml-1 text-sm font-medium text-muted-foreground">{unit}</span>
      </dd>
      <dd className="mt-1 text-xs text-muted-foreground">{hint}</dd>
    </div>
  );
}

export function ResultCards({
  downloadMbps,
  uploadMbps,
  latency,
  server,
}: {
  downloadMbps?: number;
  uploadMbps?: number;
  latency?: LatencyResult;
  server?: ServerInfo;
}) {
  const { t, lang } = useSpeedI18n();
  const pending = t("result.pending");
  const mbps = (value?: number) => (value === undefined ? pending : formatMbps(lang, value));
  const ms = (value?: number) => (value === undefined ? pending : formatMs(lang, value));
  const text = (key: DictKey) => t(key);
  const serverName = server?.colo
    ? `${server.colo}${server.country ? ` (${server.country})` : ""}`
    : text("result.serverUnknown");
  return (
    <div>
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card
          icon={<ArrowDown aria-hidden />}
          label={t("result.download")}
          hint={t("result.downloadHint")}
          value={mbps(downloadMbps)}
          unit={t("result.mbps")}
          testId="result-download"
        />
        <Card
          icon={<ArrowUp aria-hidden />}
          label={t("result.upload")}
          hint={t("result.uploadHint")}
          value={mbps(uploadMbps)}
          unit={t("result.mbps")}
          testId="result-upload"
        />
        <Card
          icon={<Timer aria-hidden />}
          label={t("result.ping")}
          hint={t("result.pingHint")}
          value={ms(latency?.pingMs)}
          unit={t("result.ms")}
          testId="result-ping"
        />
        <Card
          icon={<Activity aria-hidden />}
          label={t("result.jitter")}
          hint={t("result.jitterHint")}
          value={ms(latency?.jitterMs)}
          unit={t("result.ms")}
          testId="result-jitter"
        />
      </dl>
      {server && (
        <p
          className="mt-3 flex flex-wrap gap-x-4 text-xs text-muted-foreground"
          data-testid="server-info"
        >
          <span>{t("result.server", { server: serverName })}</span>
          {server.isp && <span>{t("result.isp", { isp: server.isp })}</span>}
        </p>
      )}
    </div>
  );
}
