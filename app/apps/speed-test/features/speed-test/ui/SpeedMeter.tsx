/** 測定中の表示：いまの段階と速度（Ping 中は応答速度） */
import { Progress } from "~/platform/ui/progress";
import { type DictKey, useSpeedI18n } from "../../../i18n";
import type { SpeedTestProgress } from "../core/runner";
import { formatMbps } from "./format";

const PHASE_KEYS = {
  info: "test.phaseInfo",
  ping: "test.phasePing",
  download: "test.phaseDownload",
  upload: "test.phaseUpload",
} as const satisfies Record<SpeedTestProgress["phase"], DictKey>;

/** 全体の進み具合：準備・Ping は短いので、ダウンロードとアップロードに大きく割り振る */
const PHASE_SPAN = {
  info: [0, 0.02],
  ping: [0.02, 0.1],
  download: [0.1, 0.55],
  upload: [0.55, 1],
} as const;

export function overallProgress(progress: SpeedTestProgress | null): number {
  if (!progress) return 0;
  const [from, to] = PHASE_SPAN[progress.phase];
  return from + (to - from) * progress.progress;
}

export function SpeedMeter({ progress }: { progress: SpeedTestProgress | null }) {
  const { t, lang } = useSpeedI18n();
  const phase = progress?.phase ?? "info";
  return (
    <div className="flex flex-col items-center gap-3 text-center" data-testid="speed-meter">
      <p className="text-sm text-muted-foreground" role="status">
        {t(PHASE_KEYS[phase])}
      </p>
      <p className="text-5xl font-bold tabular-nums sm:text-6xl" data-testid="live-speed">
        {progress?.liveMbps != null ? formatMbps(lang, progress.liveMbps) : t("result.pending")}
        <span className="ml-2 text-xl font-medium text-muted-foreground">{t("result.mbps")}</span>
      </p>
      <Progress
        value={Math.round(overallProgress(progress) * 100)}
        aria-label={t("test.progress")}
        className="w-full max-w-md"
      />
    </div>
  );
}
