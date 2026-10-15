/**
 * 信頼済みの図形データ（IconDefinition）を React で描く、選択肢の表示用の部品。
 * 文字列を組み立てず、値だけを要素へ渡す。
 */
import { cn } from "~/platform/utils";
import { ICON_VIEW_BOX, type IconDefinition, type IconShape, shapeKey } from "../core/artwork";

function Shape({ shape }: { shape: IconShape }) {
  switch (shape.type) {
    case "path":
      return <path d={shape.d} />;
    case "circle":
      return <circle cx={shape.cx} cy={shape.cy} r={shape.r} />;
    case "rect":
      return (
        <rect x={shape.x} y={shape.y} width={shape.width} height={shape.height} rx={shape.rx} />
      );
  }
}

export function IconGlyph({
  definition,
  className,
}: {
  definition: IconDefinition;
  className?: string;
}) {
  const solid = definition.render === "solid";
  return (
    <svg
      viewBox={ICON_VIEW_BOX}
      aria-hidden="true"
      className={cn("size-6", className)}
      fill={solid ? "currentColor" : "none"}
      stroke={solid ? "none" : "currentColor"}
      strokeWidth={solid ? undefined : 2}
      strokeLinecap={solid ? undefined : "round"}
      strokeLinejoin={solid ? undefined : "round"}
    >
      {definition.shapes.map((shape) => (
        <Shape key={shapeKey(shape)} shape={shape} />
      ))}
    </svg>
  );
}
