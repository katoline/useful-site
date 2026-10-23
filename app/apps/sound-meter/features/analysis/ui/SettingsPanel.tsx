/** 設定：計測時間・補正値 */
import { useId } from "react";
import { Button } from "~/platform/ui/button";
import { Input } from "~/platform/ui/input";
import { Label } from "~/platform/ui/label";
import { Slider } from "~/platform/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "~/platform/ui/toggle-group";
import {
  CALIBRATION_MAX_DB,
  CALIBRATION_MIN_DB,
  DEFAULT_CALIBRATION_DB,
  DURATIONS,
} from "../../../domain/limits";
import { useSoundI18n } from "../../../i18n";
import { clampCalibration, type MeterSettings } from "../core/settings";

export function SettingsPanel({
  settings,
  onChange,
  disabled,
}: {
  settings: MeterSettings;
  onChange(settings: MeterSettings): void;
  disabled?: boolean;
}) {
  const { t } = useSoundI18n();
  const durationId = useId();
  const calibrationId = useId();
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
        <Label htmlFor={calibrationId}>{t("settings.calibration")}</Label>
        <div className="flex items-center gap-3">
          <Input
            id={calibrationId}
            type="number"
            inputMode="numeric"
            min={CALIBRATION_MIN_DB}
            max={CALIBRATION_MAX_DB}
            step={1}
            value={settings.calibrationDb}
            onChange={(event) => {
              if (event.target.value !== "") setCalibration(Number(event.target.value));
            }}
            className="w-24"
            data-testid="setting-calibration"
          />
          <Slider
            aria-label={t("settings.calibration")}
            min={CALIBRATION_MIN_DB}
            max={CALIBRATION_MAX_DB}
            step={1}
            value={[settings.calibrationDb]}
            onValueChange={([value]) => {
              if (value !== undefined) setCalibration(value);
            }}
            className="flex-1"
          />
          <Button
            variant="ghost"
            onClick={() => setCalibration(DEFAULT_CALIBRATION_DB)}
            disabled={settings.calibrationDb === DEFAULT_CALIBRATION_DB}
          >
            {t("settings.reset")}
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">{t("settings.calibrationHint")}</p>
      </div>
    </section>
  );
}
