"use client";

import { Check, Loader2 } from "lucide-react";
import { DecisionDialog, DIALOG_BUTTON, DIALOG_PRIMARY } from "@/components/record/decision-dialog";
import { FOCUS_FIELD } from "@/components/shared/focus-modal";
import { NAVIGATION } from "@/components/layout/nav-items";
import { cn } from "@/lib/utils";

export type ConvertTarget = "inbound" | "agent";

const TARGETS: { value: ConvertTarget; label: string; href: string; hint: string }[] = [
  { value: "inbound", label: "Inbound", href: "/inbound", hint: "An owner with a property to list" },
  { value: "agent", label: "Agent network", href: "/agent-network", hint: "A broker or channel partner" },
];

/** Where a lead goes next, and a note the receiving team reads first. */
export function ConvertLeadDialog({ open, busy, target, note, onTarget, onNote, onClose, onConfirm }: {
  open: boolean;
  busy: boolean;
  target: ConvertTarget | "";
  note: string;
  onTarget: (t: ConvertTarget) => void;
  onNote: (v: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const ready = !!target && !!note.trim();
  return (
    <DialogShell open={open} busy={busy} onClose={onClose}
      actions={<>
        <button type="button" onClick={onClose} disabled={busy} className={DIALOG_BUTTON}>Cancel</button>
        <button type="button" onClick={onConfirm} disabled={busy || !ready} className={cn(DIALOG_PRIMARY, "disabled:opacity-50")}>
          {busy && <Loader2 className="size-3.5 animate-spin" />}
          {busy ? "Converting…" : "Convert"}
        </button>
      </>}>
      <div className="space-y-4">
        <div role="radiogroup" aria-label="Convert to" className="grid gap-2 sm:grid-cols-2">
          {TARGETS.map((t) => {
            const nav = NAVIGATION.find((n) => n.href === t.href);
            const Icon = nav?.icon;
            const on = target === t.value;
            return (
              <button key={t.value} type="button" role="radio" aria-checked={on} onClick={() => onTarget(t.value)}
                className={cn("relative flex items-start gap-2.5 rounded-lg border p-3 text-left transition-[border-color,background-color,box-shadow]",
                  on ? "border-[#017D58] bg-[#017D58]/[0.06] shadow-[0_0_0_1px_#017D58] dark:border-[#2FB585] dark:bg-[#2FB585]/[0.08] dark:shadow-[0_0_0_1px_#2FB585]" : "hover:bg-muted/50")}>
                <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-foreground/[0.05]">
                  {Icon && <Icon className={cn("size-4", nav?.color)} strokeWidth={1.75} />}
                </span>
                <span className="min-w-0 pr-4">
                  <span className="block text-[13.5px] font-medium text-foreground">{t.label}</span>
                  <span className="mt-0.5 block text-[12px] leading-4 text-muted-foreground">{t.hint}</span>
                </span>
                {on && <span className="absolute right-2.5 top-2.5 flex size-4 items-center justify-center rounded-full bg-[#017D58] text-white dark:bg-[#2FB585]"><Check className="size-3" strokeWidth={3} /></span>}
              </button>
            );
          })}
        </div>
        <label className="block space-y-1.5">
          <span className="text-[13px] font-medium text-foreground">Note for the team</span>
          <textarea value={note} onChange={(e) => onNote(e.target.value)} rows={4}
            placeholder="What they should know: why this lead fits, what was discussed…"
            className={cn(FOCUS_FIELD, "block w-full resize-none border py-2 text-[13.5px] outline-none focus-visible:ring-2 focus-visible:ring-ring md:text-[13.5px]")} />
        </label>
      </div>
    </DialogShell>
  );
}

function DialogShell({ open, busy, onClose, actions, children }: { open: boolean; busy: boolean; onClose: () => void; actions: React.ReactNode; children: React.ReactNode }) {
  return (
    <DecisionDialog open={open} onDismiss={() => { if (!busy) onClose(); }} dismissible={!busy}
      title="Convert lead" description="Move this lead to the team that handles it next." actions={actions}>
      {children}
    </DecisionDialog>
  );
}
