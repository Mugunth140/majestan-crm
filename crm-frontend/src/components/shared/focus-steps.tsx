"use client";

import { useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { FOCUS_BUTTON, FOCUS_FIELD, stepStatus } from "@/components/shared/focus-modal";
import { cn } from "@/lib/utils";

/** Inputs and select triggers sized for these forms. */
export const FOCUS_INPUT = cn(FOCUS_FIELD, "h-9");
export const FOCUS_SELECT = cn(FOCUS_FIELD, "h-9! rounded-md! border-border! text-[14px]!");

/**
 * The steps of a small create/edit form in the FocusModal: which one is on
 * screen, which were visited, and the rule that a new record can't move past
 * a step that's missing a required field (`problem` says what's missing).
 */
export function useFocusSteps<K extends string>(defs: readonly { key: K; label: string }[], { problem, create }: {
  problem: (key: K) => string | null;
  create: boolean;
}) {
  const [step, setStep] = useState<K>(defs[0].key);
  const [visited, setVisited] = useState<Set<K>>(() => new Set([defs[0].key]));
  const index = Math.max(0, defs.findIndex((d) => d.key === step));
  const last = index === defs.length - 1;

  const go = (key: K) => {
    setStep(key);
    setVisited((v) => new Set(v).add(key));
  };
  const jump = (key: K) => {
    const target = defs.findIndex((d) => d.key === key);
    const blocked = create && target > index ? defs.slice(0, target).find((d) => problem(d.key)) : undefined;
    if (blocked) {
      toast.error(problem(blocked.key));
      return go(blocked.key);
    }
    go(key);
  };
  const next = () => {
    const missing = problem(step);
    if (missing) return void toast.error(missing);
    if (!last) go(defs[index + 1].key);
  };

  return {
    step,
    index,
    last,
    go,
    jump,
    next,
    back: () => { if (index > 0) go(defs[index - 1].key); },
    steps: defs.map((d, i) => ({ ...d, status: stepStatus(i, index, visited.has(d.key) && !problem(d.key)) })),
    /** Whether the step on screen is missing something. */
    blocked: !!problem(step),
  };
}

/** One step's fields: hidden while another step is on screen. */
export function StepSection({ title, description, hidden, children }: {
  title: string;
  description?: ReactNode;
  hidden: boolean;
  children: ReactNode;
}) {
  return (
    <section className={cn(hidden && "hidden")}>
      <h2 className="text-[20px] font-medium tracking-[-0.01em] text-foreground">{title}</h2>
      {description && <p className="mt-1 text-[14px] text-muted-foreground">{description}</p>}
      <div className="mt-6 space-y-5">{children}</div>
    </section>
  );
}

/**
 * Cancel · Back · Continue · Create/Save. Editing can save from any step;
 * creating saves from the last one.
 */
export function StepFooter({ nav, create, saving, disabled, onCancel, onSave, createLabel, saveLabel = "Save changes" }: {
  nav: Pick<ReturnType<typeof useFocusSteps>, "index" | "last" | "back" | "next" | "blocked">;
  create: boolean;
  saving: boolean;
  /** Saving is held back (an upload or a check still running). */
  disabled?: boolean;
  onCancel: () => void;
  onSave: () => void;
  createLabel: string;
  saveLabel?: string;
}) {
  return (
    <>
      <button type="button" className={FOCUS_BUTTON.secondary} onClick={onCancel} disabled={saving}>Cancel</button>
      {nav.index > 0 && <button type="button" className={FOCUS_BUTTON.secondary} onClick={nav.back} disabled={saving}>Back</button>}
      {!nav.last && (
        <button type="button" onClick={nav.next} disabled={saving}
          className={cn(create ? FOCUS_BUTTON.primary : FOCUS_BUTTON.secondary, nav.blocked && "cursor-not-allowed opacity-50")}>
          Continue
        </button>
      )}
      {(!create || nav.last) && (
        <button type="button" onClick={onSave} disabled={saving || disabled} className={FOCUS_BUTTON.primary}>
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {saving ? (create ? "Creating…" : "Saving…") : create ? createLabel : saveLabel}
        </button>
      )}
    </>
  );
}
