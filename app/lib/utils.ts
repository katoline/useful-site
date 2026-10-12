import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Tailwind のクラスを結合し、衝突するものは後勝ちにする（shadcn/ui の cn） */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
