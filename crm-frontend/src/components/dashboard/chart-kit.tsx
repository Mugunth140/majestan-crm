"use client";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { Tone } from "./types";

/** Categorical slots in fixed order; a ninth series folds into "Other". */
export const SERIES = Array.from({ length: 8 }, (_, i) => `var(--series-${i + 1})`);
export const seriesColor = (i: number) => SERIES[Math.min(i, SERIES.length - 1)];
export const STATUS: Record<Tone, string> = { good: "var(--status-good)", warn: "var(--status-warn)", bad: "var(--status-bad)" };
/** Sequential blue ramp, 0 (near nothing) to 6 (most). */
export const seq = (t: number) => `var(--seq-${Math.max(0, Math.min(6, Math.round(t * 6)))})`;

/** What a chart can ask of the page: open a person, or bring a series forward. */
type DashActions = {
  openPerson: (id: number) => void;
  canOpen: (id: number | undefined) => boolean;
  focus: string | null;
  setFocus: (key: string | null) => void;
  trendKeys: Set<string>;
  /** True during the one-time entry animation of the first report. */
  intro: boolean;
};
export const DashContext = createContext<DashActions>({ openPerson: () => {}, canOpen: () => false, focus: null, setFocus: () => {}, trendKeys: new Set(), intro: false });

/** Counts a number up from zero during the entry animation; otherwise shows it as is. */
export function useCountUp(value: number | null, run: boolean, ms = 900) {
  const [shown, setShown] = useState<number | null>(run && value !== null ? 0 : value);
  useEffect(() => {
    if (!run || value === null || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const id = requestAnimationFrame(() => setShown(value));
      return () => cancelAnimationFrame(id);
    }
    let frame = 0;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      setShown(value * (1 - Math.pow(1 - t, 3)));
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value, run, ms]);
  return shown;
}
export const useDash = () => useContext(DashContext);

/** The rendered width of a chart's box, so SVG geometry stays crisp at any size. */
export function useWidth<T extends HTMLElement>(initial = 560) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(initial);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      const w = entry?.contentRect.width;
      if (w) setWidth(Math.max(200, Math.round(w)));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

export const Swatch = ({ color, className, line }: { color: string; className?: string; line?: boolean }) => (
  <span aria-hidden className={cn("inline-block shrink-0", line ? "h-0.5 w-3 rounded-full" : "size-2.5 rounded-[3px]", className)} style={{ background: color }} />
);

export type TipRow = { color?: string; label: string; value: string; muted?: boolean };

/** A hover card that follows the mark and flips before it leaves the chart. */
export function ChartTip({ x, y, width, title, rows, footer }: { x: number; y: number; width: number; title?: ReactNode; rows: TipRow[]; footer?: ReactNode }) {
  const flip = x > width - 200;
  return (
    <div
      role="status"
      className="pointer-events-none absolute z-20 min-w-36 max-w-60 rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-lg"
      style={{ left: flip ? undefined : x + 14, right: flip ? width - x + 14 : undefined, top: Math.max(0, y - 12) }}
    >
      {title && <div className="mb-1.5 font-medium text-foreground">{title}</div>}
      <div className="space-y-1">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-2">
            {r.color && <Swatch color={r.color} />}
            <span className={cn("flex-1 truncate", r.muted ? "text-muted-foreground" : "text-foreground/80")}>{r.label}</span>
            <span className="font-medium tabular-nums text-foreground">{r.value}</span>
          </div>
        ))}
      </div>
      {footer && <div className="mt-1.5 border-t pt-1.5 text-muted-foreground">{footer}</div>}
    </div>
  );
}

/** Legend chips; when `onToggle` is given each chip shows or hides its series. */
export function Legend({ items, hidden, onToggle, className }: {
  items: { key: string; label: string; color: string; line?: boolean }[];
  hidden?: Set<string>;
  onToggle?: (key: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-1 gap-y-1", className)}>
      {items.map((it) => {
        const off = hidden?.has(it.key);
        const body = (
          <>
            <Swatch color={off ? "var(--muted-foreground)" : it.color} line={it.line} className={off ? "opacity-40" : undefined} />
            <span className={cn(off && "text-muted-foreground line-through decoration-muted-foreground/50")}>{it.label}</span>
          </>
        );
        return onToggle ? (
          <button
            key={it.key}
            type="button"
            aria-pressed={!off}
            onClick={() => onToggle(it.key)}
            className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs text-foreground/80 transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
          >
            {body}
          </button>
        ) : (
          <span key={it.key} className="inline-flex h-6 items-center gap-1.5 px-1.5 text-xs text-foreground/80">{body}</span>
        );
      })}
    </div>
  );
}

/** A quiet "nothing here yet" for an empty chart, keeping the card's height. */
export function EmptyChart({ children = "No activity in this period", className }: { children?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-h-40 items-center justify-center rounded-lg border border-dashed text-[13px] text-muted-foreground", className)}>
      {children}
    </div>
  );
}
