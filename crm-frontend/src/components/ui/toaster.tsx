"use client";

import { Toaster as Sonner } from "sonner";
import { CheckCircle2, Info, TriangleAlert, XCircle } from "lucide-react";
import "./toaster.css";

export const TOAST_DURATION = 4000;

// App toasts: a tinted fill drains right-to-left as the timer runs out (it pauses
// while hovered, like sonner's own timer), with a close button top-right.
export function Toaster() {
  return (
    <Sonner
      position="top-right"
      duration={TOAST_DURATION}
      closeButton
      gap={10}
      offset={{ top: "calc(env(safe-area-inset-top) + 12px)", right: 16 }}
      mobileOffset={{ top: "calc(env(safe-area-inset-top) + 12px)", right: 12 }}
      style={{ "--toast-duration": `${TOAST_DURATION}ms` } as React.CSSProperties}
      icons={{
        success: <CheckCircle2 className="size-[18px]" strokeWidth={2} />,
        error: <XCircle className="size-[18px]" strokeWidth={2} />,
        info: <Info className="size-[18px]" strokeWidth={2} />,
        warning: <TriangleAlert className="size-[18px]" strokeWidth={2} />,
      }}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "app-toast flex w-[var(--width)] items-start gap-2.5 overflow-hidden rounded-xl bg-popover py-3 pl-3.5 pr-10 text-popover-foreground shadow-[0_12px_32px_-8px_rgba(0,0,0,0.18),0_4px_8px_-4px_rgba(0,0,0,0.08)] ring-1 ring-black/[0.06] dark:shadow-[0_12px_32px_-8px_rgba(0,0,0,0.6)] dark:ring-white/10",
          icon: "app-toast-icon mt-px flex shrink-0",
          content: "flex min-w-0 flex-1 flex-col gap-0.5",
          title: "text-[14px] font-medium leading-5",
          description: "text-[13px] leading-5 text-muted-foreground",
          closeButton:
            "absolute right-2 top-2 flex size-6 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-black/[0.06] hover:text-foreground focus-visible:ring-2 focus-visible:ring-[#017D58]/40 dark:hover:bg-white/[0.08] [&_svg]:size-3.5",
          actionButton:
            "ml-2 h-7 shrink-0 self-center rounded-md bg-foreground px-2.5 text-[13px] font-medium text-background",
          cancelButton: "ml-2 h-7 shrink-0 self-center rounded-md bg-muted px-2.5 text-[13px] font-medium",
        },
      }}
    />
  );
}
