/**
 * 広告枠（docs/site-plan.md §5・§7）。全アプリでこれを使う。
 *
 * - 高さを min-height で先に確保し、CLS を防ぐ
 * - 「広告 / Advertisement」の小さなラベルと細い枠線でコンテンツと区別する
 * - オフライン時は枠ごと出さない。印刷にも含めない（print:hidden）
 * - VITE_ADSENSE_CLIENT と広告ユニット ID（slot、省略時は VITE_ADSENSE_SLOT_<形式>）が揃わないとき：
 *   開発時は破線のプレースホルダー、本番は何も出さない
 * - 1 ページ 3 枠以内は配置側の取り決め。開発時だけ実際に表示中の枠を数えて console.warn
 * - 枠が画面に近づいてから（IntersectionObserver）、スクリプト（AdSenseScript が読む）の読み込み後に
 *   1 回だけ adsbygoogle.push({}) する。push は「まだ埋まっていない最初の ins.adsbygoogle」を埋めるので、
 *   画面外の枠を先に埋めてしまわないよう、adsbygoogle のクラスは push の直前に付ける
 *
 * 置かない場所：入力・ダウンロード・保存・設定の近く、処理中のオーバーレイ（誤タップ防止）。
 */
import { useEffect, useRef, useState } from "react";
import { useOnline } from "~/platform/hooks/use-online";
import { useI18n } from "~/platform/i18n";
import { cn } from "~/platform/utils";
import {
  AD_MIN_HEIGHT,
  type AdFormat,
  getAdClient,
  getDefaultAdSlotId,
  normalizeAdSlotId,
} from "./config";
import { pushAd, whenAdSenseReady } from "./loader";
import { warnIfTooManyAdSlots } from "./slot-registry";

export { AD_MIN_HEIGHT, type AdFormat } from "./config";

/** 画面のこの距離（px）まで近づいたら広告を要求する */
const AD_ROOT_MARGIN = "200px";

export interface AdSlotProps {
  format: AdFormat;
  /** AdSense の広告ユニット ID（data-ad-slot。数字のみ）。省略時は形式の既定（VITE_ADSENSE_SLOT_<形式>） */
  slot?: string;
  className?: string;
}

export function AdSlot({ format, slot, className }: AdSlotProps) {
  const { t } = useI18n();
  const online = useOnline();
  const slotRef = useRef<HTMLElement>(null);
  const insRef = useRef<HTMLModElement>(null);
  const [requested, setRequested] = useState(false);
  const client = getAdClient();
  const slotId = slot === undefined ? getDefaultAdSlotId(format) : normalizeAdSlotId(slot);
  const live = Boolean(client && slotId);
  const visible = live || import.meta.env.DEV;

  // 開発時だけ、CSS の表示状態も含めて枠数を確認する。描画の可否には使わない。
  useEffect(() => {
    if (!import.meta.env.DEV || !online || !visible) return;
    const element = slotRef.current;
    if (!element) return;
    const check = () => warnIfTooManyAdSlots(element);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  });

  // 画面に近づき、スクリプトが読めたら要求する
  useEffect(() => {
    const ins = insRef.current;
    if (!live || !online || requested || !ins) return;
    let cancelled = false;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        void whenAdSenseReady().then(() => {
          if (!cancelled) setRequested(true);
        });
      },
      { rootMargin: AD_ROOT_MARGIN },
    );
    observer.observe(ins);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [live, online, requested]);

  // adsbygoogle のクラスが付いた後に 1 回だけ push する（pushAd が同じ <ins> への 2 回目を防ぐ）。
  // オフライン→オンラインで <ins> が作り直されたときも、新しい <ins> を埋め直す
  useEffect(() => {
    if (!requested || !online) return;
    const ins = insRef.current;
    if (ins) pushAd(ins);
  }, [requested, online]);

  if (!online || !visible) return null;

  return (
    <aside
      ref={slotRef}
      aria-label={t("ads.label")}
      data-ad-format={format}
      className={cn(
        // 印刷（ページ自体の Ctrl+P を含む）には広告を含めない（site-plan.md §7）
        "my-4 rounded-md border border-border p-2 print:hidden",
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
        {client && slotId ? (
          <ins
            ref={insRef}
            className={cn("block w-full", requested && "adsbygoogle")}
            style={{ minHeight: AD_MIN_HEIGHT[format] }}
            data-ad-client={client}
            data-ad-slot={slotId}
            data-ad-format={format === "in-article" ? "fluid" : "auto"}
            data-ad-layout={format === "in-article" ? "in-article" : undefined}
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
