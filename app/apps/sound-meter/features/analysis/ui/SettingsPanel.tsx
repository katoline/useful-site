/** 設定：計測時間・周波数と時間の重み付け・補正値 */
import { useId, useState } from "react";
import { Button } from "~/platform/ui/button";
import { Input } from "~/platform/ui/input";
import { Label } from "~/platform/ui/label";
import { Slider } from "~/platform/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "~/platform/ui/toggle-group";
import { CALIBRATION_MAX_DB, CALIBRATION_MIN_DB, DURATIONS } from "../../../domain/limits";
import { FREQUENCY_WEIGHTINGS, TIME_WEIGHTINGS } from "../../../domain/measurement";
import { useSoundI18n } from "../../../i18n";
import { clampCalibration, type MeterSettings } from "../core/settings";

/** 補正値の入力欄の表示（0.1dB 単位） */
const calibrationText = (value: number) => String(Math.round(value * 10) / 10);

export function SettingsPanel({
  settings,
  calibrationDb,
  onChange,
  disabled,
}: {
  settings: MeterSettings;
  /** 実際に使う補正値（設定が既定値なら端末の種類ごとの値） */
  calibrationDb: number;
  onChange(settings: MeterSettings): void;
  disabled?: boolean;
}) {
  const { t } = useSoundI18n();
  const durationId = useId();
  const frequencyId = useId();
  const timeId = useId();
  const calibrationId = useId();
  /** 入力欄の編集中の文字（編集していなければ null） */
  const [draft, setDraft] = useState<string | null>(null);
  const setCalibration = (value: number) =>
    onChange({ ...settings, calibrationDb: clampCalibration(value) });
  return (
    <section aria-labelledby="sm-settings-title" className="flex flex-col gap-4">
      <h2 id="sm-settings-title" className="text-lg font-semibold">
        {t("settings.title")}
      </h2>
      <div className="flex flex-col gap-2">
        <Label id={durationId}>{t("settings.duration")}</Label>
        <ToggleGroup
          type="single"
          aria-labelledby={durationId}
          value={String(settings.durationSec)}
          disabled={disabled}
          onValueChange={(value) => {
            const duration = DURATIONS.find((d) => String(d) === value);
            if (duration) onChange({ ...settings, durationSec: duration });
          }}
          className="self-start"
          data-testid="setting-duration"
        >
          {DURATIONS.map((duration) => (
            <ToggleGroupItem key={duration} value={String(duration)}>
              {t("settings.durationValue", { seconds: duration })}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      <div className="flex flex-col gap-2">
        <Label id={frequencyId}>{t("settings.frequencyWeighting")}</Label>
        <ToggleGroup
          type="single"
          aria-labelledby={frequencyId}
          value={settings.frequencyWeighting}
          disabled={disabled}
          onValueChange={(value) => {
            const weighting = FREQUENCY_WEIGHTINGS.find((w) => w === value);
            if (weighting) onChange({ ...settings, frequencyWeighting: weighting });
          }}
          className="self-start"
          data-testid="setting-frequency-weighting"
        >
          {FREQUENCY_WEIGHTINGS.map((weighting) => (
            <ToggleGroupItem key={weighting} value={weighting}>
              {weighting}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <p className="text-sm text-muted-foreground">{t("settings.frequencyWeightingHint")}</p>
      </div>
      <div className="flex flex-col gap-2">
        <Label id={timeId}>{t("settings.timeWeighting")}</Label>
        <ToggleGroup
          type="single"
          aria-labelledby={timeId}
          value={settings.timeWeighting}
          disabled={disabled}
          onValueChange={(value) => {
            const weighting = TIME_WEIGHTINGS.find((w) => w === value);
            if (weighting) onChange({ ...settings, timeWeighting: weighting });
          }}
          className="self-start"
          data-testid="setting-time-weighting"
        >
          {TIME_WEIGHTINGS.map((weighting) => (
            <ToggleGroupItem key={weighting} value={weighting}>
              {t(`settings.time.${weighting}`)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <p className="text-sm text-muted-foreground">{t("settings.timeWeightingHint")}</p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={calibrationId}>{t("settings.calibration")}</Label>
        <div className="flex items-center gap-3">
          <Input
            id={calibrationId}
            type="number"
            inputMode="decimal"
            min={CALIBRATION_MIN_DB}
            max={CALIBRATION_MAX_DB}
            step={0.1}
            // 入力中は文字のまま持つ（1 桁目で範囲に丸めると「95」が打てない）。範囲内の数なら即反映し、
            // 欄を離れたら範囲に丸めて確定する
            value={draft ?? calibrationText(calibrationDb)}
            onChange={(event) => {
              const text = event.target.value;
              setDraft(text);
              const value = Number(text);
              if (
                text !== "" &&
                Number.isFinite(value) &&
                value >= CALIBRATION_MIN_DB &&
                value <= CALIBRATION_MAX_DB
              ) {
                setCalibration(value);
              }
            }}
            onBlur={() => {
              if (draft !== null && draft !== "" && Number.isFinite(Number(draft))) {
                setCalibration(Number(draft));
              }
              setDraft(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
            }}
            className="w-24"
            data-testid="setting-calibration"
          />
          <Slider
            aria-label={t("settings.calibration")}
            min={CALIBRATION_MIN_DB}
            max={CALIBRATION_MAX_DB}
            step={0.1}
            value={[calibrationDb]}
            onValueChange={([value]) => {
              setDraft(null);
              if (value !== undefined) setCalibration(value);
            }}
            className="flex-1"
          />
          <Button
            variant="ghost"
            onClick={() => {
              setDraft(null);
              onChange({ ...settings, calibrationDb: null });
            }}
            disabled={settings.calibrationDb === null}
            data-testid="setting-calibration-reset"
          >
            {t("settings.reset")}
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">{t("settings.calibrationHint")}</p>
      </div>
    </section>
  );
}
