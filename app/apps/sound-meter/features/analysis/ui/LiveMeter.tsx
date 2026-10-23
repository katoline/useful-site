/** 計測中の表示：推定 dB(A)・レベルの棒・瞬間最大・主な周波数・スペクトル */
import { cn } from "~/platform/utils";
import { useSoundI18n } from "../../../i18n";
import { isSilentFrame } from "../core/analyze";
import { noteOf } from "../core/spectrum";
import { formatDb, formatHz } from "./format";
import { BAR_COUNT, BAR_FLOOR_DB, type LiveView } from "./use-measurement";

/** レベルの棒の範囲（推定 dB） */
const METER_MIN_DB = 20;
const METER_MAX_DB = 120;
/** スペクトルの棒の上端（dB） */
const BAR_TOP_DB = -20;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const barHeight = (db: number) => clamp01((db - BAR_FLOOR_DB) / (BAR_TOP_DB - BAR_FLOOR_DB)) * 100;
// 棒は位置で決まる（並べ替えない）ので、位置をそのままキーにする
const BAR_KEYS = Array.from({ length: BAR_COUNT }, (_, i) => `bar-${i}`);

export function LiveMeter({
  live,
  calibrationDb,
}: {
  live: LiveView | null;
  calibrationDb: number;
}) {
  const { t, lang } = useSoundI18n();
  // 完全な無音は入力が無いだけなので数値を出さない
  const frame = live && !isSilentFrame(live.frame) ? live.frame : undefined;
  const estimated = frame ? frame.levelADbfs + calibrationDb : null;
  const note = frame?.dominantHz ? noteOf(frame.dominantHz) : null;
  return (
    <section aria-labelledby="sm-live-title" className="rounded-lg border border-border p-4">
      <h2 id="sm-live-title" className="text-lg font-semibold">
        {t("live.title")}
      </h2>
      <div className="mt-3 grid gap-4 sm:grid-cols-3">
        <div className="sm:col-span-3">
          <p className="text-sm text-muted-foreground">{t("live.level")}</p>
          <p className="text-4xl font-bold tabular-nums" data-testid="live-level">
            {estimated === null ? t("live.none") : formatDb(lang, estimated)}
            <span className="ml-1 text-lg font-medium text-muted-foreground">dB(A)</span>
          </p>
          <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-accent" aria-hidden>
            <div
              className={cn(
                "h-full rounded-full transition-[width] duration-100",
                estimated !== null && estimated >= 85 ? "bg-destructive" : "bg-primary",
              )}
              style={{
                width: `${clamp01(((estimated ?? METER_MIN_DB) - METER_MIN_DB) / (METER_MAX_DB - METER_MIN_DB)) * 100}%`,
              }}
            />
          </div>
          {frame && (
            <p className="mt-1 text-xs text-muted-foreground tabular-nums">
              {t("result.dbfs", { value: formatDb(lang, frame.levelADbfs) })}
            </p>
          )}
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{t("live.peak")}</p>
          <p className="text-xl font-semibold tabular-nums">
            {frame ? `${formatDb(lang, frame.peakDbfs)} dBFS` : t("live.none")}
          </p>
        </div>
        <div className="sm:col-span-2">
          <p className="text-sm text-muted-foreground">{t("live.frequency")}</p>
          <p className="text-xl font-semibold tabular-nums" data-testid="live-frequency">
            {frame?.dominantHz ? formatHz(lang, frame.dominantHz) : t("live.none")}
            {note && (
              <span className="ml-2 text-base font-medium text-muted-foreground">{note.name}</span>
            )}
          </p>
        </div>
      </div>
      <p className="mt-4 text-sm text-muted-foreground">{t("live.spectrum")}</p>
      <div className="mt-2 flex h-24 items-end gap-px rounded-md bg-muted p-1" aria-hidden>
        {BAR_KEYS.map((key, index) => (
          <div
            key={key}
            className="flex-1 rounded-t-sm bg-primary/80"
            style={{ height: `${barHeight(live?.bars[index] ?? BAR_FLOOR_DB)}%` }}
          />
        ))}
      </div>
    </section>
  );
}
