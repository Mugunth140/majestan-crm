"use client";

import { Lock } from "lucide-react";

/** Lock placeholder shown where contact data exists but the viewer lacks the grant. */
export function LockedField({ label, wide }: { label?: string; wide?: boolean }) {
  return (
    <div className={`flex flex-col gap-1 py-2 border-b border-border/30 last:border-0 ${wide ? "sm:col-span-2" : ""}`}>
      {label && (
        <span className="text-muted-foreground text-xs font-bold uppercase tracking-wide">{label}</span>
      )}
      <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground">
        <Lock className="h-3.5 w-3.5" />
        Restricted — contact admin for access
      </span>
    </div>
  );
}
