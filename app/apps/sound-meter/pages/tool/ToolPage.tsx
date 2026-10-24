/**
 * ツールページ。analysis の部品を組み合わせ、マイクの入力（adapters）を注入する唯一の場所。
 * 流れ：ボタン → マイクを開く → 0.1 秒ごとに解析（いまの音）→ 時間が来るか停止で集計（計測結果）
 *
 * 結果と設定は useToolSession（言語切り替えで消えない）に置き、設定は localStorage にも置く。
 * 補正値の既定値は端末の種類で変わる（種類はハイドレーションの後に調べる）。
 */
import { Download, Mic, RotateCcw, Square } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AdSlot } from "~/platform/ads/AdSlot";
import { PageHeader } from "~/platform/shell/PageHeader";
import { useToolSession, useToolSessionStore } from "~/platform/state/ToolSessionProvider";
import { Button } from "~/platform/ui/button";
import { Progress } from "~/platform/ui/progress";
import type { DevicePlatform } from "../../domain/limits";
import {
  DEFAULT_METER_SETTINGS,
  detectPlatform,
  downloadText,
  effectiveCalibration,
  framesToCsv,
  LiveMeter,
  type MeasurementResult,
  type MeterSettings,
  openMicrophone,
  ReferenceCalibration,
  SettingsPanel,
  SummaryView,
  settingsStorage,
  useMeasurement,
} from "../../features/analysis";
import { type DictKey, useSoundI18n } from "../../i18n";
import { Faq } from "./faq";

const KEYS = {
  settings: "sound-meter:settings",
  result: "sound-meter:result",
} as const;

const ERROR_KEYS = {
  permission: "errors.permission",
  "not-found": "errors.notFound",
  "in-use": "errors.inUse",
  unsupported: "errors.unsupported",
  unknown: "errors.unknown",
} as const satisfies Record<string, DictKey>;

function timestamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;
}

export function ToolPage() {
  const { t } = useSoundI18n();
  const store = useToolSessionStore();
  const [settings, setSettings] = useToolSession<MeterSettings>(
    KEYS.settings,
    DEFAULT_METER_SETTINGS,
  );
  const [result, setResult] = useToolSession<MeasurementResult | null>(KEYS.result, null);
  const [restored, setRestored] = useState(false);
  const [platform, setPlatform] = useState<DevicePlatform>("other");
  const durationMs = settings.durationSec * 1000;
  const calibrationDb = effectiveCalibration(settings, platform);
  const weighting = useMemo(
    () => ({ frequency: settings.frequencyWeighting, time: settings.timeWeighting }),
    [settings.frequencyWeighting, settings.timeWeighting],
  );
  const { status, error, live, elapsedMs, processingActive, start, stop } = useMeasurement({
    openInput: openMicrophone,
    durationMs,
    weighting,
    onComplete: setResult,
  });

  useEffect(() => setPlatform(detectPlatform()), []);

  // 補正値は端末のマイクに合わせるものなので、次回も使う（言語切り替えではセッションの値が残っている）
  useEffect(() => {
    if (!store.has(KEYS.settings)) {
      const saved = settingsStorage.load();
      if (saved) setSettings(saved);
    }
    setRestored(true);
  }, [store, setSettings]);
  useEffect(() => {
    if (restored) settingsStorage.save(settings);
  }, [restored, settings]);

  const busy = status !== "idle";
  const remaining = Math.max(0, Math.ceil((durationMs - elapsedMs) / 1000));

  return (
    <>
      <PageHeader title={t("page.title")} lead={t("page.lead")} />

      <div className="flex flex-col items-start gap-3">
        <div className="flex flex-wrap gap-2">
          {status === "measuring" ? (
            <Button size="lg" variant="destructive" onClick={stop} data-testid="stop">
              <Square aria-hidden />
              {t("measure.stop")}
            </Button>
          ) : (
            <Button
              size="lg"
              onClick={() => void start()}
              disabled={status === "starting"}
              data-testid="start"
            >
              {result ? <RotateCcw aria-hidden /> : <Mic aria-hidden />}
              {result ? t("measure.again") : t("measure.start")}
            </Button>
          )}
        </div>
        <p role="status" className="text-sm text-muted-foreground" data-testid="measure-status">
          {status === "starting" && t("measure.starting")}
          {status === "measuring" && t("measure.remaining", { seconds: remaining })}
          {status === "idle" && t("measure.idle", { seconds: settings.durationSec })}
        </p>
        {status === "measuring" && (
          <Progress
            value={Math.min(100, (elapsedMs / durationMs) * 100)}
            aria-label={t("measure.progress")}
            className="max-w-md"
          />
        )}
        <p className="text-xs text-muted-foreground">{t("measure.privacy")}</p>
      </div>

      {processingActive && (
        <div
          role="note"
          className="mt-4 rounded-md border border-warning/50 bg-warning/10 p-3 text-sm"
          data-testid="measure-processing"
        >
          {t("measure.processing")}
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="mt-4 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm"
          data-testid="measure-error"
        >
          {t(ERROR_KEYS[error])}
        </div>
      )}

      <div className="mt-6 flex flex-col gap-6">
        {(busy || !result) && (
          <LiveMeter
            live={live}
            calibrationDb={calibrationDb}
            frequencyWeighting={settings.frequencyWeighting}
          />
        )}
        {!busy && result && (
          <SummaryView
            summary={result.summary}
            calibrationDb={calibrationDb}
            actions={
              <Button
                variant="outline"
                onClick={() =>
                  downloadText(
                    // ファイル名は英字にする（日本語名を「download」に置き換える環境がある）
                    `sound-analysis-${timestamp(new Date())}.csv`,
                    framesToCsv(result.frames, calibrationDb, result.summary.weighting),
                    "text/csv",
                  )
                }
                data-testid="save-csv"
              >
                <Download aria-hidden />
                {t("result.csv")}
              </Button>
            }
          />
        )}
        {!busy && result && (
          <ReferenceCalibration
            summary={result.summary}
            onCalibrate={(value) => setSettings((prev) => ({ ...prev, calibrationDb: value }))}
          />
        )}
      </div>

      <div className="mt-8 rounded-lg border border-border p-4">
        <SettingsPanel
          settings={settings}
          calibrationDb={calibrationDb}
          onChange={setSettings}
          disabled={busy}
        />
      </div>

      <Faq />

      <div className="mt-12">
        <AdSlot format="responsive" />
      </div>
    </>
  );
}
