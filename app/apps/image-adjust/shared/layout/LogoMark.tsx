import { cn } from "~/platform/utils";
import { LOGO_GLYPH_PATH, LOGO_SIZE, LOGO_TILE_RADIUS } from "../logo";

/**
 * ロゴのマーク（インライン SVG。図形は app/apps/image-adjust/shared/logo.ts）。
 * タイルは文字色（currentColor）、記号は背景色のトークンで塗るので、ライトでは黒地に白、
 * ダークでは白地に黒になる。サイト名の文字と並べて使う前提の飾りなので、読み上げからは外す。
 * 寸法は width / height 属性で固定する（CSS の読み込み前でも大きさが決まり、CLS を起こさない）。
 */
export function LogoMark({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox={`0 0 ${LOGO_SIZE} ${LOGO_SIZE}`}
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      className={cn("shrink-0", className)}
      data-testid="logo-mark"
    >
      <rect width={LOGO_SIZE} height={LOGO_SIZE} rx={LOGO_TILE_RADIUS} fill="currentColor" />
      <path d={LOGO_GLYPH_PATH} className="fill-background" />
    </svg>
  );
}
