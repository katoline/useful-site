import * as SliderPrimitive from "@radix-ui/react-slider";
import type { ComponentProps } from "react";
import { cn } from "~/lib/utils";

/** 範囲スライダー。value / defaultValue は配列（つまみの数だけ） */
export function Slider({ className, ...props }: ComponentProps<typeof SliderPrimitive.Root>) {
  // つまみは値の位置（何番目か）で決まるので、位置をそのままキーにする
  const thumbKeys = (props.value ?? props.defaultValue ?? [0]).map((_, i) => `thumb-${i}`);
  return (
    <SliderPrimitive.Root
      className={cn(
        "relative flex h-11 w-full touch-none items-center select-none data-[disabled]:opacity-50",
        className,
      )}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-accent">
        <SliderPrimitive.Range className="absolute h-full bg-primary" />
      </SliderPrimitive.Track>
      {thumbKeys.map((key) => (
        <SliderPrimitive.Thumb
          key={key}
          className="block size-5 rounded-full border-2 border-primary bg-background shadow transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      ))}
    </SliderPrimitive.Root>
  );
}
