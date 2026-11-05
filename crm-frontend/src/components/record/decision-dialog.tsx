"use client";

import type { ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { HEADER_BUTTON, HEADER_PRIMARY } from "@/components/record/header-actions";
import { cn } from "@/lib/utils";

/** The footer buttons, matching the record page's top bar. */
export const DIALOG_BUTTON = cn(HEADER_BUTTON, "justify-center");
export const DIALOG_PRIMARY = cn(HEADER_PRIMARY, "justify-center");
export const DIALOG_DANGER =
  "inline-flex h-8 items-center justify-center gap-1.5 rounded-md px-3 text-[14px] font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-950/40";

/**
 * A question with a few answers (restore a draft, save before leaving…),
 * styled like the rest of the redesign: plain title, muted note, and the
 * top bar's buttons in a footer.
 */
export function DecisionDialog({ open, onDismiss, title, description, children, actions, aside, dismissible = true }: {
  open: boolean;
  /** Escape, the backdrop or the close button. */
  onDismiss: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  /** The answers, right-aligned; the default one last. */
  actions: ReactNode;
  /** An answer set apart on the left, such as Discard. */
  aside?: ReactNode;
  /** False hides the close button, so one of the answers must be picked. */
  dismissible?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onDismiss(); }}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[440px]" showCloseButton={dismissible}>
        <div className="space-y-1.5 px-5 pt-5 pb-4">
          <DialogTitle className="pr-6 text-[15px] leading-5 font-semibold">{title}</DialogTitle>
          {description && <DialogDescription className="text-[13px] leading-5">{description}</DialogDescription>}
          {children && <div className="pt-2 text-[13px]">{children}</div>}
        </div>
        <div className={cn("flex flex-col-reverse gap-2 border-t px-5 py-3 sm:flex-row sm:items-center", aside ? "sm:justify-between" : "sm:justify-end")}>
          {aside}
          <div className="flex flex-col-reverse gap-2 sm:flex-row">{actions}</div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Field names as chips, e.g. what a draft changed. */
export function FieldChips({ fields }: { fields: string[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {fields.map((f) => (
        <span key={f} className="inline-flex h-6 items-center rounded-[5px] bg-foreground/[0.06] px-2 text-[12px] font-medium text-foreground/80">{f}</span>
      ))}
    </div>
  );
}
