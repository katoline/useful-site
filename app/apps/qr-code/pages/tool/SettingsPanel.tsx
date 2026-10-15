/**
 * QR 生成の設定（色・PNG サイズ・中央アイコンの大きさ）。
 * 純粋な画面部品で、状態は受け取って変更を親へ返すだけ。自由色は白背景との
 * コントラスト基準を満たすときだけ適用し、満たさなければエラーを出す。
 */
import { useId, useState } from "react";
import { Label } from "~/platform/ui/label";
import { Slider } from "~/platform/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "~/platform/ui/toggle-group";
import { cn } from "~/platform/utils";
import {
  evaluateForegroundColor,
  formatHexColor,
  ICON_SIZE_PERCENT_MAX,
  ICON_SIZE_PERCENT_MIN,
  PNG_SIZES,
  type PngSize,
  QR_FOREGROUND_PRESETS,
  type QrSettings,
} from "../../features/qr-generation";
import { useQrI18n } from "../../i18n";

export interface SettingsPanelProps {
  settings: QrSettings;
  onChange(next: QrSettings): void;
}

export function SettingsPanel({ settings, onChange }: SettingsPanelProps) {
  const { t } = useQrI18n();
  const id = useId();
  const [colorError, setColorError] = useState(false);

  const pickPreset = (color: string) => {
    setColorError(false);
    onChange({ ...settings, foreground: color });
  };

  const changeCustom = (value: string) => {
    const hex = formatHexColor(value);
    if (hex && evaluateForegroundColor(hex).ok) {
      setColorError(false);
      onChange({ ...settings, foreground: hex });
    } else {
      setColorError(true);
    }
  };

  const changePngSize = (value: string) => {
    if (value) onChange({ ...settings, pngSize: Number(value) as PngSize });
  };

  const changeIconSize = (value: number) => {
    onChange({ ...settings, iconSizePercent: value });
  };

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2" data-testid="qr-settings">
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-color`}>{t("settings.color")}</Label>
        <div className="flex flex-wrap items-center gap-2">
          {QR_FOREGROUND_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              aria-label={preset.color}
              aria-pressed={settings.foreground === preset.color}
              onClick={() => pickPreset(preset.color)}
              data-testid={`qr-color-${preset.id}`}
              className={cn(
                "size-11 rounded-full border-2 border-border outline-none focus-visible:ring-2 focus-visible:ring-ring",
                settings.foreground === preset.color && "ring-2 ring-ring ring-offset-2",
              )}
              style={{ backgroundColor: preset.color }}
            />
          ))}
          <label
            htmlFor={`${id}-color`}
            className="flex min-h-11 items-center gap-2 rounded-md border border-border px-2 text-sm"
          >
            {t("settings.colorCustom")}
            <input
              id={`${id}-color`}
              type="color"
              value={settings.foreground}
              onChange={(event) => changeCustom(event.currentTarget.value)}
              data-testid="qr-color-custom"
              className="size-8 cursor-pointer rounded border border-border bg-background p-0"
            />
          </label>
        </div>
        {colorError ? (
          <p role="alert" className="text-sm text-destructive" data-testid="qr-color-error">
            {t("settings.colorInvalid")}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label>{t("settings.size")}</Label>
        <ToggleGroup
          type="single"
          value={String(settings.pngSize)}
          onValueChange={changePngSize}
          aria-label={t("settings.size")}
          data-testid="qr-png-size"
        >
          {PNG_SIZES.map((size) => (
            <ToggleGroupItem
              key={size}
              value={String(size)}
              data-testid={`qr-size-${size}`}
              className="min-h-11"
            >
              {t("settings.sizeValue", { size })}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <div className="flex flex-col gap-2 sm:col-span-2">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor={`${id}-icon-size`}>{t("icon.size")}</Label>
          <span className="text-sm tabular-nums" data-testid="qr-icon-size-value">
            {t("icon.sizeValue", { percent: settings.iconSizePercent })}
          </span>
        </div>
        <Slider
          id={`${id}-icon-size`}
          data-testid="qr-icon-size"
          min={ICON_SIZE_PERCENT_MIN}
          max={ICON_SIZE_PERCENT_MAX}
          step={1}
          value={[settings.iconSizePercent]}
          onValueChange={([value]) => value !== undefined && changeIconSize(value)}
          aria-label={t("icon.size")}
        />
      </div>

      <p className="text-xs text-muted-foreground sm:col-span-2">{t("settings.fixed")}</p>
    </div>
  );
}
