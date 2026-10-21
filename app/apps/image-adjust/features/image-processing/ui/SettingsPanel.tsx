/**
 * 設定パネル（§2.2・§2.5）。PC ではカード、スマホでは下から出るシートの中に置く。
 * 入力に含まれる形式に関係する項目だけを出す（何も入っていなければ全部出す）。
 */
import { ChevronDown } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { Checkbox } from "~/platform/ui/checkbox";
import { Input } from "~/platform/ui/input";
import { Label } from "~/platform/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/platform/ui/select";
import { Slider } from "~/platform/ui/slider";
import { Switch } from "~/platform/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/platform/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "~/platform/ui/toggle-group";
import type { ImageFormat } from "../../../domain/format";
import { useI18n } from "../../../i18n";
import { findPreset, PRESETS, RESPONSIVE_WIDTHS } from "../core/presets";
import {
  type OutputFormat,
  type ProcessSettings,
  QUALITY_PRESETS,
  type QualityPreset,
  SVG_LEVELS,
  type SvgLevel,
} from "../core/types";

export interface SettingsPanelProps {
  settings: ProcessSettings;
  onChange: (patch: Partial<ProcessSettings>) => void;
  /** 入力に含まれる形式。空なら全項目を出す */
  inputFormats: ReadonlySet<ImageFormat>;
  /** 選択中のプリセット（表示用） */
  presetId: string;
  onPresetChange: (id: string) => void;
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

function SwitchRow({
  id,
  label,
  checked,
  onCheckedChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-3">
      <Label htmlFor={id} className="leading-snug">
        {label}
      </Label>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

const SVG_LEVEL_LABEL: Record<SvgLevel, "svgSafe" | "svgStandard" | "svgAggressive"> = {
  safe: "svgSafe",
  standard: "svgStandard",
  aggressive: "svgAggressive",
};

/**
 * 目標サイズ（KB）。入力中の文字列はローカルに持ち、blur / Enter で確定する
 * （1 文字ごとに再処理が走らないように）
 */
function TargetKbInput({
  id,
  targetBytes,
  onCommit,
}: {
  id: string;
  targetBytes: number;
  onCommit: (bytes: number) => void;
}) {
  const committed = String(Math.round(targetBytes / 1024));
  const [text, setText] = useState(committed);
  useEffect(() => setText(committed), [committed]);
  const commit = () => {
    const kb = Number(text);
    if (Number.isFinite(kb) && kb > 0) onCommit(Math.round(kb * 1024));
    else setText(committed);
  };
  return (
    <Input
      id={id}
      type="number"
      inputMode="numeric"
      min={1}
      step={1}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
        }
      }}
      data-testid="target-kb"
    />
  );
}

function PxInput({
  id,
  label,
  value,
  onChange,
  testId,
}: {
  id: string;
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  testId?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={1}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        data-testid={testId}
      />
    </div>
  );
}

export function SettingsPanel({
  settings,
  onChange,
  inputFormats,
  presetId,
  onPresetChange,
}: SettingsPanelProps) {
  const { t } = useI18n();
  const id = useId();
  const all = inputFormats.size === 0;
  const has = (f: ImageFormat) => all || inputFormats.has(f);
  const hasRaster = has("png") || has("jpeg") || has("webp");
  const outputsJpeg = settings.output === "jpeg" || (settings.output === "same" && has("jpeg"));
  const outputsPng = settings.output === "png" || (settings.output === "same" && has("png"));
  const outputsWebp = settings.output === "webp" || (settings.output === "same" && has("webp"));
  const lossyOutput = outputsJpeg || outputsWebp || outputsPng;
  const resize = settings.resize;
  const setResize = (patch: Partial<ProcessSettings["resize"]>) =>
    onChange({ resize: { ...resize, ...patch } });

  const qualityPreset = (Object.keys(QUALITY_PRESETS) as QualityPreset[]).find(
    (k) => QUALITY_PRESETS[k] === settings.quality,
  );

  return (
    <div className="flex flex-col gap-6" data-testid="settings-panel">
      {/* プリセット */}
      <Field label={t("tool.settings.preset")} htmlFor={`${id}-preset`}>
        <Select
          value={presetId}
          onValueChange={(v) => {
            onPresetChange(v);
            const preset = findPreset(v);
            if (preset) onChange(preset.settings);
          }}
        >
          <SelectTrigger id={`${id}-preset`} data-testid="preset-select">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">{t("tool.settings.presetNone")}</SelectItem>
            {PRESETS.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {t(`tool.settings.presets.${p.id}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      {/* 出力形式 */}
      {hasRaster && (
        <Field label={t("tool.settings.output")}>
          <ToggleGroup
            type="single"
            value={settings.output}
            onValueChange={(v) => v && onChange({ output: v as OutputFormat })}
            aria-label={t("tool.settings.output")}
            data-testid="output-format"
          >
            <ToggleGroupItem value="same">{t("tool.settings.outputSame")}</ToggleGroupItem>
            <ToggleGroupItem value="png" data-testid="output-png">
              PNG
            </ToggleGroupItem>
            <ToggleGroupItem value="jpeg" data-testid="output-jpeg">
              JPEG
            </ToggleGroupItem>
            <ToggleGroupItem value="webp" data-testid="output-webp">
              WebP
            </ToggleGroupItem>
          </ToggleGroup>
        </Field>
      )}

      {/* サイズの決め方 */}
      {hasRaster && lossyOutput && (
        <Tabs
          value={settings.sizeMode}
          onValueChange={(v) => onChange({ sizeMode: v as ProcessSettings["sizeMode"] })}
        >
          <Label className="mb-2 block">{t("tool.settings.sizeMode")}</Label>
          <TabsList className="w-full">
            <TabsTrigger value="quality" className="flex-1" data-testid="mode-quality">
              {t("tool.settings.modeQuality")}
            </TabsTrigger>
            <TabsTrigger value="target" className="flex-1" data-testid="mode-target">
              {t("tool.settings.modeTarget")}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="quality" className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <Label htmlFor={`${id}-quality`}>{t("tool.settings.quality")}</Label>
              <span className="text-sm tabular-nums" data-testid="quality-value">
                {settings.quality}
              </span>
            </div>
            <Slider
              id={`${id}-quality`}
              min={1}
              max={100}
              step={1}
              value={[settings.quality]}
              onValueChange={([v]) => v !== undefined && onChange({ quality: v })}
              aria-label={t("tool.settings.quality")}
            />
            <ToggleGroup
              type="single"
              value={qualityPreset ?? ""}
              onValueChange={(v) => v && onChange({ quality: QUALITY_PRESETS[v as QualityPreset] })}
              aria-label={t("tool.settings.quality")}
            >
              <ToggleGroupItem value="high">{t("tool.settings.presetHigh")}</ToggleGroupItem>
              <ToggleGroupItem value="standard">
                {t("tool.settings.presetStandard")}
              </ToggleGroupItem>
              <ToggleGroupItem value="light">{t("tool.settings.presetLight")}</ToggleGroupItem>
            </ToggleGroup>
            {outputsPng && !settings.pngLossless && (
              <p className="text-xs text-muted-foreground">{t("tool.settings.pngNote")}</p>
            )}
          </TabsContent>
          <TabsContent value="target" className="flex flex-col gap-2">
            <Label htmlFor={`${id}-target`}>{t("tool.settings.targetSize")}</Label>
            <TargetKbInput
              id={`${id}-target`}
              targetBytes={settings.targetBytes}
              onCommit={(targetBytes) => onChange({ targetBytes })}
            />
            <p className="text-xs text-muted-foreground">{t("tool.settings.targetNote")}</p>
          </TabsContent>
        </Tabs>
      )}

      {/* 詳細設定（リサイズ・SVG・GIF の最適化もここに入れる。既定は閉じる） */}
      <details className="group rounded-md border border-border" data-testid="advanced-settings">
        <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-3 px-3 text-sm font-medium select-none">
          {t("tool.settings.advanced")}
          <ChevronDown
            aria-hidden
            className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
          />
        </summary>
        <div className="flex flex-col gap-4 border-t border-border p-3">
          {/* リサイズ */}
          {(hasRaster || has("gif")) && (
            <Field label={t("tool.settings.resize")}>
              <ToggleGroup
                type="single"
                value={resize.mode}
                onValueChange={(v) =>
                  v && setResize({ mode: v as ProcessSettings["resize"]["mode"] })
                }
                aria-label={t("tool.settings.resize")}
                data-testid="resize-mode"
              >
                <ToggleGroupItem value="none">{t("tool.settings.resizeNone")}</ToggleGroupItem>
                <ToggleGroupItem value="px">{t("tool.settings.resizePx")}</ToggleGroupItem>
                <ToggleGroupItem value="percent">
                  {t("tool.settings.resizePercent")}
                </ToggleGroupItem>
              </ToggleGroup>
              {resize.mode === "px" && (
                <div className="flex flex-col gap-3">
                  <div className="grid grid-cols-2 gap-2">
                    <PxInput
                      id={`${id}-w`}
                      label={t("tool.settings.width")}
                      value={resize.width}
                      onChange={(width) => setResize({ width })}
                      testId="resize-width"
                    />
                    <PxInput
                      id={`${id}-h`}
                      label={t("tool.settings.height")}
                      value={resize.height}
                      onChange={(height) => setResize({ height })}
                    />
                  </div>
                  <SwitchRow
                    id={`${id}-aspect`}
                    label={t("tool.settings.keepAspect")}
                    checked={resize.keepAspect}
                    onCheckedChange={(keepAspect) => setResize({ keepAspect })}
                  />
                  <SwitchRow
                    id={`${id}-noenlarge`}
                    label={t("tool.settings.noEnlarge")}
                    checked={resize.noEnlarge}
                    onCheckedChange={(noEnlarge) => setResize({ noEnlarge })}
                  />
                </div>
              )}
              {resize.mode === "percent" && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor={`${id}-pct`}>{t("tool.settings.percent")}</Label>
                    <span className="text-sm tabular-nums">{resize.percent}%</span>
                  </div>
                  <Slider
                    id={`${id}-pct`}
                    min={1}
                    max={100}
                    step={1}
                    value={[resize.percent]}
                    onValueChange={([v]) => v !== undefined && setResize({ percent: v })}
                    aria-label={t("tool.settings.percent")}
                  />
                </div>
              )}
            </Field>
          )}

          {/* SVG（入力に SVG があるときだけ） */}
          {inputFormats.has("svg") && (
            <Field label={t("tool.settings.svgLevel")}>
              <ToggleGroup
                type="single"
                value={settings.svgLevel}
                onValueChange={(v) => v && onChange({ svgLevel: v as SvgLevel })}
                aria-label={t("tool.settings.svgLevel")}
                data-testid="svg-level"
              >
                {SVG_LEVELS.map((level) => (
                  <ToggleGroupItem key={level} value={level}>
                    {t(`tool.settings.${SVG_LEVEL_LABEL[level]}`)}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              <p className="text-xs text-muted-foreground">{t("tool.settings.svgNote")}</p>
            </Field>
          )}

          {/* GIF（入力に GIF があるときだけ） */}
          {inputFormats.has("gif") && (
            <div className="flex flex-col gap-4">
              <Field label={t("tool.settings.gifLevel")}>
                <ToggleGroup
                  type="single"
                  value={String(settings.gif.level)}
                  onValueChange={(v) =>
                    v && onChange({ gif: { ...settings.gif, level: Number(v) as 1 | 2 | 3 } })
                  }
                  aria-label={t("tool.settings.gifLevel")}
                >
                  <ToggleGroupItem value="1">1</ToggleGroupItem>
                  <ToggleGroupItem value="2">2</ToggleGroupItem>
                  <ToggleGroupItem value="3">3</ToggleGroupItem>
                </ToggleGroup>
              </Field>
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor={`${id}-lossy`}>{t("tool.settings.gifLossy")}</Label>
                  <span className="text-sm tabular-nums">{settings.gif.lossy}</span>
                </div>
                <Slider
                  id={`${id}-lossy`}
                  min={0}
                  max={200}
                  step={5}
                  value={[settings.gif.lossy]}
                  onValueChange={([v]) =>
                    v !== undefined && onChange({ gif: { ...settings.gif, lossy: v } })
                  }
                  aria-label={t("tool.settings.gifLossy")}
                />
              </div>
              <Field label={t("tool.settings.gifColors")} htmlFor={`${id}-gifcolors`}>
                <Select
                  value={settings.gif.colors == null ? "keep" : String(settings.gif.colors)}
                  onValueChange={(v) =>
                    onChange({
                      gif: { ...settings.gif, colors: v === "keep" ? null : Number(v) },
                    })
                  }
                >
                  <SelectTrigger id={`${id}-gifcolors`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="keep">{t("tool.settings.gifColorsKeep")}</SelectItem>
                    {[256, 128, 64, 32, 16].map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          )}

          {outputsJpeg && (
            <>
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor={`${id}-bg`}>{t("tool.settings.jpegBackground")}</Label>
                <div className="flex items-center gap-2">
                  <input
                    id={`${id}-bg`}
                    type="color"
                    value={settings.jpegBackground}
                    onChange={(e) => onChange({ jpegBackground: e.target.value })}
                    className="size-11 cursor-pointer rounded-md border border-border bg-background p-1"
                    data-testid="jpeg-background"
                  />
                  <span className="font-mono text-xs tabular-nums">{settings.jpegBackground}</span>
                </div>
              </div>
              <SwitchRow
                id={`${id}-prog`}
                label={t("tool.settings.jpegProgressive")}
                checked={settings.jpegProgressive}
                onCheckedChange={(v) => onChange({ jpegProgressive: v })}
              />
            </>
          )}
          {outputsPng && (
            <SwitchRow
              id={`${id}-pnglossless`}
              label={t("tool.settings.pngLossless")}
              checked={settings.pngLossless}
              onCheckedChange={(v) => onChange({ pngLossless: v })}
            />
          )}
          {outputsWebp && (
            <SwitchRow
              id={`${id}-webplossless`}
              label={t("tool.settings.webpLossless")}
              checked={settings.webpLossless}
              onCheckedChange={(v) => onChange({ webpLossless: v })}
            />
          )}
          <div className="flex flex-col gap-1">
            <SwitchRow
              id={`${id}-meta`}
              label={t("tool.settings.stripMetadata")}
              checked={settings.stripMetadata}
              onCheckedChange={(v) => onChange({ stripMetadata: v })}
            />
            {!settings.stripMetadata && (
              <p className="text-xs text-warning">{t("tool.settings.stripMetadataNote")}</p>
            )}
          </div>
          {hasRaster && (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-sm font-medium">
                {t("tool.settings.responsiveWidths")}
              </legend>
              <div className="flex flex-wrap gap-4">
                {RESPONSIVE_WIDTHS.map((w) => {
                  const checked = settings.responsiveWidths.includes(w);
                  const cid = `${id}-rw-${w}`;
                  return (
                    <div key={w} className="flex min-h-11 items-center gap-2">
                      <Checkbox
                        id={cid}
                        checked={checked}
                        onCheckedChange={(v) =>
                          onChange({
                            responsiveWidths: v
                              ? [...settings.responsiveWidths, w].sort((a, b) => a - b)
                              : settings.responsiveWidths.filter((x) => x !== w),
                          })
                        }
                      />
                      <Label htmlFor={cid}>{w}px</Label>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">{t("tool.settings.responsiveNote")}</p>
            </fieldset>
          )}
        </div>
      </details>
    </div>
  );
}
