/** 計測結果：推定 dB の代表値・周波数・音域の内訳 */
import type { ReactNode } from "react";
import { BANDS, loudnessLevel, type MeasurementSummary } from "../../../domain/measurement";
import { useSoundI18n } from "../../../i18n";
import { noteOf } from "../core/spectrum";
import { dbUnit, formatDb, formatHz, formatPercent, formatSeconds } from "./format";

function Stat({
  label,
  hint,
  children,
  testId,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  testId?: string;
}) {
  return (
    <div className="rounded-md bg-muted p-3">
      <dt className="text-sm font-medium">{label}</dt>
      <dd className="mt-1 text-xl font-semibold tabular-nums" data-testid={testId}>
        {children}
      </dd>
      {hint && <dd className="mt-1 text-xs text-muted-foreground">{hint}</dd>}
    </div>
  );
}

export function SummaryView({
  summary,
  calibrationDb,
  actions,
}: {
  summary: MeasurementSummary;
  calibrationDb: number;
  /** 見出しの横に出す操作（CSV の保存等） */
  actions?: ReactNode;
}) {
  const { t, lang } = useSoundI18n();
  const db = (dbfs: number) => (
    <>
      {formatDb(lang, dbfs + calibrationDb)}
      <span className="ml-1 text-sm font-medium text-muted-foreground">
        {dbUnit(summary.weighting.frequency)}
      </span>
    </>
  );
  const leq = summary.leqDbfs + calibrationDb;
  const note = summary.dominantHz ? noteOf(summary.dominantHz) : null;
  const seconds = formatSeconds(lang, summary.durationMs);
  return (
    <section
      aria-labelledby="sm-result-title"
      className="rounded-lg border border-border p-4"
      data-testid="result"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 id="sm-result-title" className="text-lg font-semibold">
            {t("result.title")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("result.summary", { seconds, frames: summary.frames })}
          </p>
          <p className="text-sm text-muted-foreground" data-testid="result-weighting">
            {t("result.weighting", {
              frequency: summary.weighting.frequency,
              time: t(`settings.time.${summary.weighting.time}`),
            })}
          </p>
        </div>
        {actions}
      </div>

      {summary.audibleFrames === 0 ? (
        <p className="mt-4 rounded-md bg-muted p-4 text-sm" data-testid="result-no-signal">
          {t("result.noSignal")}
        </p>
      ) : (
        <>
          <div className="mt-4 rounded-md border border-border p-4">
            <p className="text-sm text-muted-foreground">{t("result.leq")}</p>
            <p className="text-4xl font-bold tabular-nums" data-testid="result-leq">
              {db(summary.leqDbfs)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{t("result.leqHint")}</p>
            <p className="mt-2 text-sm" data-testid="result-loudness">
              <span className="font-medium">{t("result.level")}：</span>
              {t(`loudness.${loudnessLevel(leq)}`)}
            </p>
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat label={t("result.max")} testId="result-max">
              {db(summary.maxDbfs)}
            </Stat>
            <Stat label={t("result.min")}>{db(summary.minDbfs)}</Stat>
            <Stat label={t("result.l10")} hint={t("result.l10Hint")}>
              {db(summary.l10Dbfs)}
            </Stat>
            <Stat label={t("result.l50")} hint={t("result.l50Hint")}>
              {db(summary.l50Dbfs)}
            </Stat>
            <Stat label={t("result.l90")} hint={t("result.l90Hint")}>
              {db(summary.l90Dbfs)}
            </Stat>
            <Stat label={t("result.peak")}>{`${formatDb(lang, summary.peakDbfs)} dBFS`}</Stat>
            <Stat
              label={t("result.dominant")}
              hint={
                note ? t("result.note", { name: note.name, cents: signed(note.cents) }) : undefined
              }
              testId="result-dominant"
            >
              {summary.dominantHz ? (
                formatHz(lang, summary.dominantHz)
              ) : (
                <span className="text-sm font-normal">{t("result.noPitch")}</span>
              )}
            </Stat>
            <Stat label={t("result.centroid")} hint={t("result.centroidHint")}>
              {summary.centroidHz ? formatHz(lang, summary.centroidHz) : "—"}
            </Stat>
          </dl>

          <h3 className="mt-6 text-base font-semibold">{t("result.bands")}</h3>
          <ul className="mt-2 flex flex-col gap-2" data-testid="result-bands">
            {BANDS.map((band) => {
              const share = summary.bandShares[band.id];
              return (
                <li
                  key={band.id}
                  className="grid grid-cols-[minmax(0,11rem)_1fr_3rem] items-center gap-2 text-sm"
                >
                  <span>{t(`bands.${band.id}`)}</span>
                  <span className="h-2.5 overflow-hidden rounded-full bg-accent" aria-hidden>
                    <span
                      className="block h-full rounded-full bg-primary"
                      style={{ width: `${share * 100}%` }}
                    />
                  </span>
                  <span className="text-right tabular-nums">{formatPercent(lang, share)}</span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}

function signed(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}
