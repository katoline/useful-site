/**
 * ツールページ。speed-test の部品を組み合わせ、通信の実装（adapters）を注入する唯一の場所。
 * 流れ：ボタン → 情報・Ping → ダウンロード → アップロード → 結果・できることの目安・履歴
 *
 * 結果は useToolSession（言語切り替えで消えない）に置き、履歴は localStorage にも置く。
 */
import { Gauge, RotateCcw, Square } from "lucide-react";
import { useEffect, useState } from "react";
import { AdSlot } from "~/platform/ads/AdSlot";
import { useOnline } from "~/platform/hooks/use-online";
import { PageHeader } from "~/platform/shell/PageHeader";
import { useToolSession } from "~/platform/state/ToolSessionProvider";
import { Button } from "~/platform/ui/button";
import { type SpeedTestResult, speedLevel } from "../../domain/measurement";
import {
  createHttpTransport,
  formatDateTime,
  HistoryList,
  historyStorage,
  ResultCards,
  SpeedMeter,
  UsageList,
  useSpeedTest,
} from "../../features/speed-test";
import { type DictKey, useSpeedI18n } from "../../i18n";
import { manifest } from "../../manifest";
import { Faq } from "./faq";

const transport = createHttpTransport(`/${manifest.path}/api`);
const RESULT_KEY = "speed-test:result";

const ERROR_KEYS = {
  network: "errors.network",
  "rate-limited": "errors.rateLimited",
  server: "errors.server",
  canceled: "test.canceled",
} as const satisfies Record<string, DictKey>;

export function ToolPage() {
  const { t, lang } = useSpeedI18n();
  const online = useOnline();
  const [result, setResult] = useToolSession<SpeedTestResult | null>(RESULT_KEY, null);
  const [history, setHistory] = useState<SpeedTestResult[]>([]);
  const { status, progress, error, start, cancel } = useSpeedTest({
    transport,
    onComplete: (next) => {
      setResult(next);
      setHistory(historyStorage.add(next));
    },
  });

  useEffect(() => setHistory(historyStorage.load()), []);

  const running = status === "running";

  return (
    <>
      <PageHeader title={t("page.title")} lead={t("page.lead")} />

      <section className="flex flex-col items-center gap-4 rounded-lg border border-border p-6">
        {running ? (
          <>
            <SpeedMeter progress={progress} />
            <Button variant="outline" onClick={cancel} data-testid="cancel">
              <Square aria-hidden />
              {t("test.cancel")}
            </Button>
          </>
        ) : (
          <>
            <Button
              size="lg"
              className="h-14 px-10 text-lg"
              onClick={() => void start()}
              disabled={!online}
              data-testid="start"
            >
              {result ? <RotateCcw aria-hidden /> : <Gauge aria-hidden />}
              {result ? t("test.again") : t("test.start")}
            </Button>
            <p className="max-w-xl text-center text-sm text-muted-foreground">
              {online ? t("test.idle") : t("errors.offline")}
            </p>
          </>
        )}
        {error && !running && (
          <p
            role="alert"
            className="w-full rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm"
            data-testid="test-error"
          >
            {t(ERROR_KEYS[error])}
          </p>
        )}
      </section>

      {(running || result) && (
        <section
          aria-labelledby="st-result-title"
          className="mt-6 flex flex-col gap-4"
          data-testid="result"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="st-result-title" className="text-lg font-semibold">
              {t("result.title")}
            </h2>
            {!running && result && (
              <p className="text-sm text-muted-foreground" data-testid="result-meta">
                <span className="font-medium text-foreground">
                  {t("result.level", { level: t(`levels.${speedLevel(result.downloadMbps)}`) })}
                </span>
                {" · "}
                {t("result.measuredAt", { time: formatDateTime(lang, result.measuredAt) })}
              </p>
            )}
          </div>
          {running ? (
            <ResultCards
              downloadMbps={progress?.downloadMbps}
              uploadMbps={progress?.uploadMbps}
              latency={progress?.latency}
              server={progress?.server}
            />
          ) : (
            result && (
              <>
                <ResultCards
                  downloadMbps={result.downloadMbps}
                  uploadMbps={result.uploadMbps}
                  latency={result.latency}
                  server={result.server}
                />
                <UsageList result={result} />
              </>
            )
          )}
        </section>
      )}

      <div className="mt-8">
        <HistoryList
          history={history}
          onClear={() => {
            historyStorage.clear();
            setHistory([]);
          }}
        />
      </div>

      <Faq />

      <div className="mt-12">
        <AdSlot format="responsive" />
      </div>
    </>
  );
}
