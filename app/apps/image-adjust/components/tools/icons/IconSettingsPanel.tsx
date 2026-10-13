/**
 * 余白・背景・角丸と、マニフェスト・HTML の設定。
 */
import { useId } from "react";
import { formatNumber, useI18n } from "~/apps/image-adjust/i18n";
import {
  type IconSettings,
  isValidBasePath,
  PADDING_MAX,
  RADIUS_MAX,
} from "~/apps/image-adjust/lib/icons/settings";
import { useToolSession } from "~/platform/state/ToolSessionProvider";
import { Input } from "~/platform/ui/input";
import { Label } from "~/platform/ui/label";
import { Slider } from "~/platform/ui/slider";
import { Switch } from "~/platform/ui/switch";

const colorInputClass =
  "h-11 w-14 shrink-0 cursor-pointer rounded-md border border-input bg-background p-1 disabled:cursor-not-allowed disabled:opacity-50";

function PercentSlider({
  label,
  value,
  max,
  onChange,
  testId,
}: {
  label: string;
  value: number;
  max: number;
  onChange: (value: number) => void;
  testId: string;
}) {
  const { lang } = useI18n();
  const id = useId();
  const percent = Math.round(value * 100);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <Label id={id}>{label}</Label>
        <span className="text-sm text-muted-foreground tabular-nums">
          {formatNumber(lang, percent)}%
        </span>
      </div>
      <Slider
        aria-labelledby={id}
        data-testid={testId}
        min={0}
        max={Math.round(max * 100)}
        step={1}
        value={[percent]}
        onValueChange={([v]) => onChange((v ?? 0) / 100)}
      />
    </div>
  );
}

export function IconSettingsPanel({
  settings,
  onChange,
}: {
  settings: IconSettings;
  onChange: (patch: Partial<IconSettings>) => void;
}) {
  const { t } = useI18n();
  const ids = {
    bg: useId(),
    transparent: useId(),
    name: useId(),
    shortName: useId(),
    shortNameHint: useId(),
    theme: useId(),
    manifestBg: useId(),
    manifestBgHint: useId(),
    og: useId(),
    basePath: useId(),
    basePathHint: useId(),
    basePathError: useId(),
  };
  // 入力中の値（正しくない値もそのまま見せる）。カードとシートで共有するので ToolSession に置く
  const [basePathInput, setBasePathInput] = useToolSession(
    "icons:basePathInput",
    settings.basePath,
  );
  const basePathValid = isValidBasePath(basePathInput);
  const transparent = settings.background === null;

  return (
    <div className="flex flex-col gap-5">
      <PercentSlider
        label={t("icons.settings.padding")}
        value={settings.padding}
        max={PADDING_MAX}
        onChange={(padding) => onChange({ padding })}
        testId="icons-padding"
      />
      <PercentSlider
        label={t("icons.settings.radius")}
        value={settings.radius}
        max={RADIUS_MAX}
        onChange={(radius) => onChange({ radius })}
        testId="icons-radius"
      />

      <div className="flex flex-col gap-2">
        <Label htmlFor={ids.bg}>{t("icons.settings.background")}</Label>
        <div className="flex flex-wrap items-center gap-4">
          <input
            id={ids.bg}
            type="color"
            className={colorInputClass}
            value={settings.background ?? settings.backgroundColor}
            disabled={transparent}
            onChange={(e) => onChange({ background: e.target.value })}
          />
          <div className="flex items-center gap-2">
            <Switch
              id={ids.transparent}
              checked={transparent}
              data-testid="icons-transparent"
              onCheckedChange={(checked) =>
                onChange({ background: checked ? null : settings.backgroundColor })
              }
            />
            <Label htmlFor={ids.transparent}>{t("icons.settings.transparent")}</Label>
          </div>
        </div>
      </div>

      <hr className="border-border" />

      <div className="flex flex-col gap-2">
        <Label htmlFor={ids.name}>{t("icons.settings.name")}</Label>
        <Input
          id={ids.name}
          value={settings.name}
          maxLength={100}
          placeholder="My Site"
          onChange={(e) => onChange({ name: e.target.value })}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={ids.shortName}>{t("icons.settings.shortName")}</Label>
        <Input
          id={ids.shortName}
          value={settings.shortName}
          maxLength={40}
          placeholder={settings.name || "My Site"}
          aria-describedby={ids.shortNameHint}
          onChange={(e) => onChange({ shortName: e.target.value })}
        />
        <p id={ids.shortNameHint} className="text-xs text-muted-foreground">
          {t("icons.settings.shortNameHint")}
        </p>
      </div>
      <div className="flex flex-wrap gap-6">
        <div className="flex flex-col gap-2">
          <Label htmlFor={ids.theme}>{t("icons.settings.themeColor")}</Label>
          <input
            id={ids.theme}
            type="color"
            className={colorInputClass}
            value={settings.themeColor}
            onChange={(e) => onChange({ themeColor: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={ids.manifestBg}>{t("icons.settings.backgroundColor")}</Label>
          <input
            id={ids.manifestBg}
            type="color"
            className={colorInputClass}
            value={settings.backgroundColor}
            aria-describedby={ids.manifestBgHint}
            onChange={(e) => onChange({ backgroundColor: e.target.value })}
          />
        </div>
      </div>
      <p id={ids.manifestBgHint} className="-mt-3 text-xs text-muted-foreground">
        {t("icons.settings.backgroundColorHint")}
      </p>
      <div className="flex items-center gap-2">
        <Switch
          id={ids.og}
          checked={settings.includeOg}
          data-testid="icons-include-og"
          onCheckedChange={(includeOg) => onChange({ includeOg })}
        />
        <Label htmlFor={ids.og}>{t("icons.settings.includeOg")}</Label>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={ids.basePath}>{t("icons.settings.basePath")}</Label>
        <Input
          id={ids.basePath}
          value={basePathInput}
          maxLength={500}
          aria-describedby={`${ids.basePathHint} ${ids.basePathError}`}
          aria-invalid={!basePathValid}
          data-testid="icons-base-path"
          onChange={(e) => {
            const value = e.target.value;
            setBasePathInput(value);
            // スニペット・マニフェストに反映するのは正しい値になってから
            if (isValidBasePath(value)) onChange({ basePath: value });
          }}
        />
        <p
          id={ids.basePathError}
          role="alert"
          className="text-xs text-destructive empty:hidden"
          data-testid="icons-base-path-error"
        >
          {basePathValid ? "" : t("icons.settings.basePathInvalid")}
        </p>
        <p id={ids.basePathHint} className="text-xs text-muted-foreground">
          {t("icons.settings.basePathHint")}
        </p>
      </div>
    </div>
  );
}
