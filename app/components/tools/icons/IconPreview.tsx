/**
 * プレビュー：16px・32px（実寸と拡大）、ライト・ダークのブラウザタブ、ホーム画面・maskable・OGP。
 * 背景は 市松 / 白 / 黒 から選べる（§8.3）。画像の色はテーマによらずそのまま出す。
 */
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import { useI18n } from "~/i18n";
import { FALLBACK_APP_NAME } from "~/lib/icons/manifest";
import { cn } from "~/lib/utils";
import type { PreviewBackground } from "./use-icon-tool";

const BG_CLASS: Record<PreviewBackground, string> = {
  checker: "bg-checker",
  white: "bg-white",
  black: "bg-black",
};

/** ブラウザのタブの色（Chrome の既定に近い値。サイトのテーマとは無関係に固定） */
const TAB_THEMES = {
  light: { strip: "#dee1e6", tab: "#ffffff", text: "#1f1f1f" },
  dark: { strip: "#202124", tab: "#35363a", text: "#e8eaed" },
} as const;

function BrowserTab({
  icon,
  title,
  theme,
  label,
}: {
  icon: string | undefined;
  title: string;
  theme: keyof typeof TAB_THEMES;
  label: string;
}) {
  const colors = TAB_THEMES[theme];
  return (
    <figure className="flex flex-col gap-1">
      <div className="rounded-md px-2 pt-2" style={{ backgroundColor: colors.strip }}>
        <div
          className="flex h-9 w-56 max-w-full items-center gap-2 rounded-t-lg px-3"
          style={{ backgroundColor: colors.tab, color: colors.text }}
        >
          {icon ? (
            <img src={icon} alt="" width={16} height={16} className="size-4 shrink-0" />
          ) : (
            <span className="size-4 shrink-0" />
          )}
          <span className="truncate text-xs">{title}</span>
        </div>
      </div>
      <figcaption className="text-xs text-muted-foreground">{label}</figcaption>
    </figure>
  );
}

export function IconPreview({
  urls,
  name,
  background,
  onBackgroundChange,
  generating,
}: {
  urls: Record<string, string>;
  name: string;
  background: PreviewBackground;
  onBackgroundChange: (bg: PreviewBackground) => void;
  generating: boolean;
}) {
  const { t } = useI18n();
  const bg = BG_CLASS[background];
  const has = Object.keys(urls).length > 0;
  const title = name.trim() || FALLBACK_APP_NAME;

  return (
    <div className="flex flex-col gap-6" aria-busy={generating}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium" id="icons-preview-bg-label">
          {t("icons.preview.background")}
        </span>
        <ToggleGroup
          type="single"
          value={background}
          aria-labelledby="icons-preview-bg-label"
          onValueChange={(v) => v && onBackgroundChange(v as PreviewBackground)}
        >
          <ToggleGroupItem value="checker">{t("icons.preview.checker")}</ToggleGroupItem>
          <ToggleGroupItem value="white">{t("icons.preview.white")}</ToggleGroupItem>
          <ToggleGroupItem value="black">{t("icons.preview.black")}</ToggleGroupItem>
        </ToggleGroup>
      </div>

      {!has ? (
        <p className="text-sm text-muted-foreground">
          {generating ? t("icons.preview.generating") : t("icons.preview.empty")}
        </p>
      ) : (
        <>
          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-medium">{t("icons.preview.small")}</h3>
            <div className={cn("flex flex-wrap items-end gap-6 rounded-md p-4", bg)}>
              {[16, 32].map((size) => {
                const src = urls[`favicon-${size}x${size}.png`];
                return (
                  <figure key={size} className="flex items-end gap-3">
                    <img
                      src={src}
                      alt={`${size}×${size} ${t("icons.preview.actualSize")}`}
                      width={size}
                      height={size}
                      data-testid={`icons-preview-${size}`}
                    />
                    <img
                      src={src}
                      alt={`${size}×${size} ${t("icons.preview.zoomed")}`}
                      width={size * 4}
                      height={size * 4}
                      className="[image-rendering:pixelated]"
                    />
                  </figure>
                );
              })}
            </div>
          </section>

          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-medium">{t("icons.preview.tabs")}</h3>
            <div className="flex flex-wrap gap-4">
              <BrowserTab
                icon={urls["favicon-32x32.png"]}
                title={title}
                theme="light"
                label={t("icons.preview.tabLight")}
              />
              <BrowserTab
                icon={urls["favicon-32x32.png"]}
                title={title}
                theme="dark"
                label={t("icons.preview.tabDark")}
              />
            </div>
          </section>

          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-medium">{t("icons.preview.homeScreen")}</h3>
            <div className={cn("flex flex-wrap items-end gap-4 rounded-md p-4", bg)}>
              <img
                src={urls["apple-touch-icon.png"]}
                alt="apple-touch-icon.png"
                width={60}
                height={60}
                className="rounded-[22%]"
              />
              <img src={urls["icon-192.png"]} alt="icon-192.png" width={64} height={64} />
            </div>
          </section>

          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-medium">{t("icons.preview.maskable")}</h3>
            <div className={cn("flex flex-wrap items-end gap-4 rounded-md p-4", bg)}>
              <img
                src={urls["icon-maskable-512.png"]}
                alt="icon-maskable-512.png"
                width={64}
                height={64}
                className="rounded-full"
              />
              <img
                src={urls["icon-maskable-512.png"]}
                alt=""
                width={64}
                height={64}
                className="rounded-[22%]"
              />
            </div>
          </section>

          {urls["og-image.png"] && (
            <section className="flex flex-col gap-2">
              <h3 className="text-sm font-medium">{t("icons.preview.og")}</h3>
              <img
                src={urls["og-image.png"]}
                alt="og-image.png"
                width={1200}
                height={630}
                className="h-auto w-full max-w-md rounded-md border border-border"
              />
            </section>
          )}
        </>
      )}
    </div>
  );
}
