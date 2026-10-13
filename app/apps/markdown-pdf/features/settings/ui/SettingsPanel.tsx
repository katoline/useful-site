/** ページ設定（用紙・向き・余白・文字サイズ・書体・改ページ） */
import { useId } from "react";
import { Label } from "~/platform/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/platform/ui/select";
import { Switch } from "~/platform/ui/switch";
import {
  type DocumentSettings,
  FONT_FAMILIES,
  FONT_SIZES,
  MARGINS,
  ORIENTATIONS,
  PAPER_SIZES,
} from "../../../domain/document-settings";
import { type DictKey, useMdI18n } from "../../../i18n";
import { updateSetting } from "../core/settings";

const LABELS: Record<string, DictKey> = {
  a4: "settings.paperA4",
  letter: "settings.paperLetter",
  portrait: "settings.portrait",
  landscape: "settings.landscape",
  narrow: "settings.marginNarrow",
  normal: "settings.marginNormal",
  wide: "settings.marginWide",
  gothic: "settings.gothic",
  mincho: "settings.mincho",
};

interface FieldProps {
  name: keyof DocumentSettings;
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onChange(value: string): void;
}

function SelectField({ name, label, value, options, onChange }: FieldProps) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} data-testid={`setting-${name}`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function SettingsPanel({
  settings,
  onChange,
}: {
  settings: DocumentSettings;
  onChange(settings: DocumentSettings): void;
}) {
  const { t } = useMdI18n();
  const switchId = useId();
  const labelled = (values: readonly string[]) =>
    values.map((value) => ({ value, label: t(LABELS[value] as DictKey) }));
  const set = (key: keyof DocumentSettings, value: unknown) =>
    onChange(updateSetting(settings, key, value));
  return (
    <section aria-labelledby="md-settings-title" className="flex flex-col gap-4">
      <h2 id="md-settings-title" className="text-lg font-semibold">
        {t("settings.title")}
      </h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <SelectField
          name="paper"
          label={t("settings.paper")}
          value={settings.paper}
          options={labelled(PAPER_SIZES)}
          onChange={(value) => set("paper", value)}
        />
        <SelectField
          name="orientation"
          label={t("settings.orientation")}
          value={settings.orientation}
          options={labelled(ORIENTATIONS)}
          onChange={(value) => set("orientation", value)}
        />
        <SelectField
          name="margin"
          label={t("settings.margin")}
          value={settings.margin}
          options={labelled(MARGINS)}
          onChange={(value) => set("margin", value)}
        />
        <SelectField
          name="fontSize"
          label={t("settings.fontSize")}
          value={String(settings.fontSize)}
          options={FONT_SIZES.map((size) => ({
            value: String(size),
            label: t("settings.fontSizeValue", { size }),
          }))}
          onChange={(value) => set("fontSize", Number(value))}
        />
        <SelectField
          name="fontFamily"
          label={t("settings.fontFamily")}
          value={settings.fontFamily}
          options={labelled(FONT_FAMILIES)}
          onChange={(value) => set("fontFamily", value)}
        />
      </div>
      <div className="flex min-h-11 items-center gap-3">
        <Switch
          id={switchId}
          checked={settings.pageBreakOnRule}
          onCheckedChange={(checked) => set("pageBreakOnRule", checked)}
          data-testid="setting-pageBreakOnRule"
        />
        <Label htmlFor={switchId}>{t("settings.pageBreak")}</Label>
      </div>
    </section>
  );
}
