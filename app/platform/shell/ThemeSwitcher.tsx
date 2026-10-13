import { Monitor, Moon, Sun } from "lucide-react";
import { useI18n } from "~/platform/i18n";
import {
  isThemePreference,
  THEME_PREFERENCES,
  type ThemePreference,
  useTheme,
} from "~/platform/theme/theme";
import { Button } from "~/platform/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "~/platform/ui/dropdown-menu";
import { ToggleGroup, ToggleGroupItem } from "~/platform/ui/toggle-group";

const ICONS: Record<ThemePreference, typeof Sun> = { light: Sun, dark: Moon, system: Monitor };

/** ヘッダー（PC）のテーマ切り替え：ボタン＋メニュー */
export function ThemeMenu() {
  const { t } = useI18n();
  const { preference, resolved, setPreference } = useTheme();
  const Icon = preference === "system" ? Monitor : resolved === "dark" ? Moon : Sun;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t("theme.label")} data-testid="theme-menu">
          <Icon aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{t("theme.label")}</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={preference}
          onValueChange={(v) => isThemePreference(v) && setPreference(v)}
        >
          {THEME_PREFERENCES.map((p) => {
            const ItemIcon = ICONS[p];
            return (
              <DropdownMenuRadioItem key={p} value={p} data-testid={`theme-${p}`}>
                <ItemIcon aria-hidden />
                {t(`theme.${p}`)}
              </DropdownMenuRadioItem>
            );
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** スマホのメニュー内のテーマ切り替え：3 択のボタン */
export function ThemeToggleGroup() {
  const { t } = useI18n();
  const { preference, setPreference } = useTheme();
  return (
    <ToggleGroup
      type="single"
      value={preference}
      onValueChange={(v) => isThemePreference(v) && setPreference(v)}
      aria-label={t("theme.label")}
    >
      {THEME_PREFERENCES.map((p) => {
        const ItemIcon = ICONS[p];
        return (
          <ToggleGroupItem key={p} value={p} aria-label={t(`theme.${p}`)} className="h-11">
            <ItemIcon aria-hidden />
            <span>{t(`theme.${p}`)}</span>
          </ToggleGroupItem>
        );
      })}
    </ToggleGroup>
  );
}
