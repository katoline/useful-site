/**
 * 画面端から出るパネル（スマホの設定パネル・メニュー用。§6.2）。Radix Dialog の見た目違い。
 */
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "~/lib/utils";

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;

const sheetVariants = cva(
  "fixed z-50 flex flex-col gap-4 overflow-y-auto border-border bg-background p-6 shadow-lg",
  {
    variants: {
      side: {
        bottom:
          "inset-x-0 bottom-0 max-h-[85dvh] rounded-t-xl border-t pb-[max(1.5rem,env(safe-area-inset-bottom))]",
        top: "inset-x-0 top-0 max-h-[85dvh] border-b",
        right: "inset-y-0 right-0 h-full w-4/5 max-w-sm border-l",
        left: "inset-y-0 left-0 h-full w-4/5 max-w-sm border-r",
      },
    },
    defaultVariants: { side: "bottom" },
  },
);

export function SheetContent({
  side,
  className,
  children,
  closeLabel = "Close",
  ...props
}: ComponentProps<typeof DialogPrimitive.Content> &
  VariantProps<typeof sheetVariants> & { closeLabel?: string }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60" />
      <DialogPrimitive.Content className={cn(sheetVariants({ side }), className)} {...props}>
        {children}
        <DialogPrimitive.Close
          className="absolute top-2 right-2 inline-flex size-11 items-center justify-center rounded-md opacity-70 outline-none hover:opacity-100 focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={closeLabel}
        >
          <X className="size-4" aria-hidden />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function SheetHeader({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-1.5 pr-8", className)} {...props} />;
}

export function SheetTitle({ className, ...props }: ComponentProps<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title className={cn("text-lg font-semibold", className)} {...props} />;
}

export function SheetDescription({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}
