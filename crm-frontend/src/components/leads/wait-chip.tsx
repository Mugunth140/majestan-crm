"use client";

import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";
import { formatWait, waitTone, workMinutesBetween, type WaitTone } from "@/lib/first-contact";

// One shared clock that ticks each minute, so every chip on a page moves together
// without a timer per row.
// The server renders with no time (0) and the browser fills it in after hydration,
// so the two never disagree.
let now = 0;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;
const tick = () => {
  now = Date.now();
  listeners.forEach((l) => l());
};
function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!timer) {
    // The clock was idle: catch up before the first minute passes.
    queueMicrotask(tick);
    timer = setInterval(tick, 60_000);
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}
/** The current time, refreshed every minute; 0 until the page has hydrated. */
export function useMinuteClock(): number {
  return useSyncExternalStore(subscribe, () => now || (now = Date.now()), () => 0);
}

const TONE: Record<WaitTone, { color: string; label: string }> = {
  fresh: { color: "var(--status-good)", label: "just assigned" },
  due: { color: "var(--status-warn)", label: "contact soon" },
  late: { color: "var(--status-bad)", label: "overdue for a first call" },
};

/** "Waiting 2h 10m" with a green, amber or red dot, for a lead its owner hasn't contacted yet. */
export function WaitChip({ assignedAt, className, compact = false }: { assignedAt: string | Date; className?: string; compact?: boolean }) {
  const clock = useMinuteClock();
  if (!clock) {
    return <span className={cn("inline-flex h-5 shrink-0 items-center rounded-full bg-muted px-1.5 text-[11.5px] font-medium text-muted-foreground", className)}>Waiting</span>;
  }
  const minutes = workMinutesBetween(assignedAt, new Date(clock));
  const tone = TONE[waitTone(minutes)];
  const text = formatWait(minutes);
  return (
    <span
      title={`Assigned ${text} of working time ago, not contacted yet — ${tone.label}`}
      className={cn("inline-flex h-5 shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-1.5 text-[11.5px] font-medium tabular-nums text-foreground/85", className)}
      style={{ background: `color-mix(in oklab, ${tone.color} 16%, transparent)` }}
    >
      <span aria-hidden className="size-1.5 shrink-0 rounded-full" style={{ background: tone.color }} />
      {compact ? text : `Waiting ${text}`}
    </span>
  );
}

/** How long the first contact took ("18m"), coloured the same way, or the live wait while there is none. */
export function FirstContactCell({ assignedAt, firstContactedAt, waiting }: { assignedAt?: string | null; firstContactedAt?: string | null; waiting?: boolean }) {
  if (waiting && assignedAt) return <WaitChip assignedAt={assignedAt} />;
  if (!assignedAt || !firstContactedAt) return <span className="text-muted-foreground">—</span>;
  const minutes = workMinutesBetween(assignedAt, firstContactedAt);
  const tone = TONE[waitTone(minutes)];
  return (
    <span className="inline-flex items-center gap-1.5 tabular-nums text-foreground/80" title={`First contact ${formatWait(minutes)} of working time after assignment`}>
      <span aria-hidden className="size-1.5 rounded-full" style={{ background: tone.color }} />
      {formatWait(minutes)}
    </span>
  );
}

/**
 * Across the top of a lead nobody has contacted since it was assigned:
 * who owes the first call and how long it has waited. It goes once a call,
 * message or follow-up is logged.
 */
export function FirstContactBanner({ assignedAt, owner, isOwner }: { assignedAt: string | Date; owner?: string | null; isOwner: boolean }) {
  const clock = useMinuteClock();
  if (!clock) return null;
  const minutes = workMinutesBetween(assignedAt, new Date(clock));
  const tone = TONE[waitTone(minutes)];
  const who = isOwner ? "You haven't" : `${owner || "The owner"} hasn't`;
  return (
    <div role="status" className="mx-4 mb-3 flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] text-foreground md:mx-5 md:mb-0 md:mt-3"
      style={{ background: `color-mix(in oklab, ${tone.color} 13%, transparent)` }}>
      <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: tone.color }} />
      <span className="min-w-0">
        <span className="font-medium">{who} contacted this lead yet.</span>{" "}
        <span className="text-foreground/75">Assigned {formatWait(minutes)} of working time ago.</span>
      </span>
    </div>
  );
}
