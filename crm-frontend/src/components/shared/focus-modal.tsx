"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { ChevronLeft, ChevronRight, Info, X } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

// A full-screen form for creating a record, after Medusa admin's focus modal:
// close + esc on the left of a tab strip (one tab per step, each with its
// status), the form centred on the page, and the actions pinned at the bottom.
// Use it for every module's "create" flow so they all look and behave alike.

export type StepStatus = "not-started" | "in-progress" | "completed";
export type FocusStep = { key: string; label: string; status: StepStatus };

/** Dashed ring → half-filled (current) → solid check, like Medusa's progress tabs. */
export function StepStatusIcon({ status, className }: { status: StepStatus; className?: string }) {
  const tone = "text-[#2563EB] dark:text-[#60A5FA]";
  if (status === "completed") {
    return (
      <svg viewBox="0 0 16 16" className={cn("h-4 w-4 shrink-0", tone, className)} aria-hidden>
        <circle cx="8" cy="8" r="7" fill="currentColor" />
        <path d="m5.2 8.2 1.9 1.9 3.7-4" fill="none" stroke="var(--background)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (status === "in-progress") {
    return (
      <svg viewBox="0 0 16 16" className={cn("h-4 w-4 shrink-0", tone, className)} aria-hidden>
        <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 3.5a4.5 4.5 0 0 1 0 9z" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 16 16" className={cn("h-4 w-4 shrink-0 text-muted-foreground", className)} aria-hidden>
      <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2.6 2.4" />
    </svg>
  );
}

/** Status for step `index` given the one on screen and which steps are filled in. */
export const stepStatus = (index: number, active: number, done: boolean): StepStatus =>
  index === active ? "in-progress" : done ? "completed" : "not-started";

export function FocusModal({
  open,
  onOpenChange,
  title,
  steps,
  active,
  onStepChange,
  footer,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** For screen readers; the tabs carry the visible headings. */
  title: string;
  steps?: FocusStep[];
  active?: string;
  onStepChange?: (key: string) => void;
  footer?: ReactNode;
  children: ReactNode;
}) {
  // The tab strip scrolls sideways when the steps don't fit: keep the current
  // step in view, and show arrows on whichever side has more.
  const activeTab = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    activeTab.current?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }, [active]);

  const [strip, setStrip] = useState<HTMLElement | null>(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  const measure = useCallback(() => {
    if (!strip) return;
    const left = strip.scrollLeft > 1;
    const right = strip.scrollLeft + strip.clientWidth < strip.scrollWidth - 1;
    setEdges((e) => (e.left === left && e.right === right ? e : { left, right }));
  }, [strip]);
  useEffect(() => {
    if (!strip) return;
    // The observer also fires once on observe, which takes the first measurement.
    const observer = new ResizeObserver(measure);
    observer.observe(strip);
    strip.addEventListener("scroll", measure, { passive: true });
    return () => { observer.disconnect(); strip.removeEventListener("scroll", measure); };
  }, [strip, measure]);
  const scrollStrip = (direction: -1 | 1) => strip?.scrollBy({ left: direction * strip.clientWidth * 0.7, behavior: "smooth" });

  // Left/Right/Home/End move between steps, as in any tab list.
  const onTabKey = (e: KeyboardEvent<HTMLElement>) => {
    if (!steps?.length) return;
    const at = steps.findIndex((s) => s.key === active);
    const next = e.key === "ArrowRight" ? at + 1 : e.key === "ArrowLeft" ? at - 1 : e.key === "Home" ? 0 : e.key === "End" ? steps.length - 1 : null;
    if (next === null || next < 0 || next >= steps.length) return;
    e.preventDefault();
    onStepChange?.(steps[next].key);
    requestAnimationFrame(() => strip?.querySelector<HTMLButtonElement>(`[data-step="${steps[next].key}"]`)?.focus());
  };
  const arrow = "absolute inset-y-0 z-10 flex w-10 items-center justify-center text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring";

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(next) => onOpenChange(next)}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/40 duration-150 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Popup
          className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-background text-foreground outline-none duration-200 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-[0.98] data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-[0.98] md:inset-2 md:rounded-lg md:border md:shadow-2xl"
        >
          <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>

          <header className="flex h-14 shrink-0 items-stretch border-b">
            <div className="flex shrink-0 items-center gap-2 border-r px-3 md:px-4">
              <DialogPrimitive.Close
                aria-label="Close"
                className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </DialogPrimitive.Close>
              <kbd className="hidden h-6 items-center rounded-md border bg-muted/60 px-1.5 font-sans text-[12px] text-muted-foreground md:inline-flex">esc</kbd>
            </div>
            {steps && steps.length > 0 && (
              <div className="relative flex min-w-0 flex-1">
              {edges.left && (
                <button type="button" onClick={() => scrollStrip(-1)} aria-label="Show earlier steps"
                  className={cn(arrow, "left-0 border-r bg-gradient-to-r from-background from-60% to-background/80")}>
                  <ChevronLeft className="h-4 w-4" />
                </button>
              )}
              <nav ref={setStrip} role="tablist" aria-label="Steps" onKeyDown={onTabKey} className="flex min-w-0 flex-1 overflow-x-auto scroll-smooth scrollbar-hide">
                {steps.map((step) => {
                  const current = step.key === active;
                  return (
                    <button
                      key={step.key}
                      ref={current ? activeTab : undefined}
                      data-step={step.key}
                      type="button"
                      role="tab"
                      aria-selected={current}
                      tabIndex={current ? 0 : -1}
                      onClick={() => onStepChange?.(step.key)}
                      className={cn(
                        "flex h-full w-auto min-w-[150px] shrink-0 items-center gap-2 border-r px-4 text-[14px] transition-colors md:min-w-[180px] md:max-w-[260px] md:flex-1",
                        current
                          ? "bg-background font-medium text-foreground"
                          : "bg-muted/50 text-muted-foreground hover:text-foreground dark:bg-black/20",
                      )}
                    >
                      <StepStatusIcon status={step.status} />
                      <span className="truncate">{step.label}</span>
                    </button>
                  );
                })}
              </nav>
              {edges.right && (
                <button type="button" onClick={() => scrollStrip(1)} aria-label="Show more steps"
                  className={cn(arrow, "right-0 border-l bg-gradient-to-l from-background from-60% to-background/80")}>
                  <ChevronRight className="h-4 w-4" />
                </button>
              )}
              </div>
            )}
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-[720px] px-4 py-8 md:px-6 md:py-16">{children}</div>
          </div>

          {footer && (
            <footer className="flex shrink-0 items-center justify-end gap-2 border-t px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+12px)] md:pb-3">
              {footer}
            </footer>
          )}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/* ---------- Building blocks for the form inside ---------- */

export const FOCUS_BUTTON = {
  secondary:
    "inline-flex h-8 items-center justify-center gap-1.5 rounded-md border bg-background px-3 text-[13px] font-medium text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.05)] transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50 dark:bg-white/[0.06] dark:hover:bg-white/[0.1]",
  primary:
    "inline-flex h-8 items-center justify-center gap-1.5 rounded-md bg-foreground px-3 text-[13px] font-medium text-background shadow-[0_1px_2px_rgba(0,0,0,0.1)] transition-colors hover:bg-foreground/85 disabled:pointer-events-none disabled:opacity-50",
};

/** Text inputs, textareas and select triggers inside a focus modal. */
export const FOCUS_FIELD =
  "rounded-md border-border bg-muted/40 px-2.5 text-[14px] shadow-[0_1px_2px_rgba(0,0,0,0.04)] placeholder:text-muted-foreground/70 md:text-[14px] dark:bg-white/[0.04]";

export function FocusSection({ title, description, children, className }: { title: string; description?: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn("border-t pt-10 first:border-t-0 first:pt-0 [&+&]:mt-10", className)}>
      <h2 className="text-[20px] font-medium tracking-[-0.01em] text-foreground">{title}</h2>
      {description && <p className="mt-1 text-[14px] text-muted-foreground">{description}</p>}
      <div className="mt-6 space-y-5">{children}</div>
    </section>
  );
}

/** The `name` of the field an event happened in, for tracking which fields were visited. */
export const fieldName = (target: EventTarget | null) =>
  (target instanceof Element ? target.closest<HTMLElement>("[data-field]")?.dataset.field : undefined) ?? null;

/** Lays fields out in columns on wider screens. */
export function FieldRow({ cols = 2, children }: { cols?: 2 | 3; children: ReactNode }) {
  return <div className={cn("grid gap-4", cols === 3 ? "md:grid-cols-3" : "md:grid-cols-2")}>{children}</div>;
}

export function FocusField({
  label, htmlFor, name, required, optional, info, hint, error, className, children,
}: {
  label: string;
  htmlFor?: string;
  /** Tags the field so the form can tell which ones were visited (see `fieldName`). */
  name?: string;
  /** Marks the field with a red asterisk. */
  required?: boolean;
  optional?: boolean;
  info?: string;
  hint?: ReactNode;
  error?: string | null;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div data-field={name} className={cn("min-w-0 space-y-2", className)}>
      <label htmlFor={htmlFor} className="flex items-center gap-1 text-[14px] font-medium text-foreground">
        {label}
        {required && <span aria-hidden className="-ml-0.5 text-red-500">*</span>}
        {info && (
          <span title={info} className="inline-flex text-muted-foreground"><Info className="h-3.5 w-3.5" /></span>
        )}
        {optional && <span className="font-normal text-muted-foreground">(Optional)</span>}
      </label>
      {children}
      {error ? (
        <p role="alert" className="text-[13px] text-red-600 dark:text-red-400">{error}</p>
      ) : hint ? (
        <div className="text-[13px] text-muted-foreground">{hint}</div>
      ) : null}
    </div>
  );
}

/** A switch with a sentence beside it, in a bordered card ("Yes, this is a referral"). */
export function ToggleCard({ checked, onCheckedChange, title, description, children }: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-muted/20 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:bg-white/[0.02]">
      <label className="flex cursor-pointer items-start gap-3 px-4 py-3.5">
        <Switch checked={checked} onCheckedChange={onCheckedChange} className="mt-0.5" />
        <span>
          <span className="block text-[14px] font-medium text-foreground">{title}</span>
          {description && <span className="block text-[14px] text-muted-foreground">{description}</span>}
        </span>
      </label>
      {checked && children && <div className="border-t px-4 py-4">{children}</div>}
    </div>
  );
}
