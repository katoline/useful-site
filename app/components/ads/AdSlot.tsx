/**
 * 広告枠（plan.md §7.2）。まだ AdSense は申請前なので広告スクリプトは読み込まない。
 *
 * - 高さを min-height で先に確保し、CLS を防ぐ
 * - 「広告 / Advertisement」の小さなラベルと細い枠線でコンテンツと区別する
 * - オフライン時は枠ごと出さない
 * - VITE_ADSENSE_CLIENT（ca-pub-...）が無いとき：開発時は破線のプレースホルダー、本番は何も出さない
 *
 * 置かない場所：ドロップエリア・ダウンロードボタン・設定パネルの近く、処理中のオーバーレイ（誤タップ防止）。
 */
import { useEffect, useRef } from "react";
import { useOnline } from "~/hooks/use-online";
import { useI18n } from "~/i18n";
import { cn } from "~/lib/utils";

export type AdFormat = "banner" | "sidebar" | "responsive" | "in-article";

/** 形式ごとに確保する高さ（px） */
export const AD_MIN_HEIGHT: Record<AdFormat, number> = {
  banner: 90,
  sidebar: 600,
  responsive: 250,
  "in-article": 250,
};

const AD_CLIENT = import.meta.env.VITE_ADSENSE_CLIENT as string | undefined;

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

export interface AdSlotProps {
  format: AdFormat;
  /** AdSense の広告ユニット ID（data-ad-slot）。未設定ならプレースホルダー */
  slot?: string;
  className?: string;
}

export function AdSlot({ format, slot, className }: AdSlotProps) {
  const { t } = useI18n();
  const online = useOnline();
  const insRef = useRef<HTMLModElement>(null);
  const live = Boolean(AD_CLIENT && slot);

  useEffect(() => {
    // 広告スクリプト（フェーズ 11 で root に追加）が読み込まれているときだけ枠を埋める
    if (!live || !online || !insRef.current || !window.adsbygoogle) return;
    try {
      window.adsbygoogle.push({});
    } catch {
      // 広告の失敗でページを壊さない
    }
  }, [live, online]);

  if (!online) return null;
  if (!live && !import.meta.env.DEV) return null;

  return (
    <aside
      aria-label={t("ads.label")}
      data-ad-format={format}
      className={cn(
        "my-4 rounded-md border border-border p-2",
        !live && "border-dashed",
        className,
      )}
    >
      <p className="mb-1 text-[10px] leading-none tracking-wide text-muted-foreground">
        {t("ads.label")}
      </p>
      <div
        style={{ minHeight: AD_MIN_HEIGHT[format] }}
        className="flex items-center justify-center"
      >
        {live ? (
          <ins
            ref={insRef}
            className="adsbygoogle block w-full"
            style={{ minHeight: AD_MIN_HEIGHT[format] }}
            data-ad-client={AD_CLIENT}
            data-ad-slot={slot}
            data-ad-format={format === "in-article" ? "fluid" : "auto"}
            data-full-width-responsive="true"
          />
        ) : (
          <span className="text-xs text-muted-foreground">
            {format} ({AD_MIN_HEIGHT[format]}px)
          </span>
        )}
      </div>
    </aside>
  );
}
