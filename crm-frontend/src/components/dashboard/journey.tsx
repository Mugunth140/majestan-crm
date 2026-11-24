"use client";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { delta, shortDate } from "./format";
import type { BlockOf, JourneyStage } from "./types";

const n = new Intl.NumberFormat("en-IN");

/** Each step as a share of the first step (the records that came in), rounded; null when nothing came in. */
export function shareOfFirst(stages: JourneyStage[], i: number) {
  const base = stages[0]?.value ?? 0;
  return base > 0 ? Math.round((stages[i].value / base) * 100) : null;
}

/** "26 Oct – 24 Nov", or one day. */
export const periodLabel = (from: string, to: string) => (from === to ? shortDate(from) : `${shortDate(from)} – ${shortDate(to)}`);

function Change({ value, prev, better }: { value: number; prev: number; better: "up" | "down" }) {
  const d = delta(value, prev, "n", better);
  if (!d) return null;
  const Icon = d.direction === "up" ? ArrowUpRight : d.direction === "down" ? ArrowDownRight : Minus;
  return (
    <span
      title={`${n.format(prev)} in the previous period`}
      className={cn(
        "inline-flex w-[4.25rem] items-center justify-end gap-0.5 text-xs font-medium tabular-nums",
        d.verdict === "good" ? "text-[var(--delta-good)]" : d.verdict === "bad" ? "text-[var(--delta-bad)]" : "text-muted-foreground",
      )}
    >
      <Icon aria-hidden className="size-3.5" />
      {d.direction === "flat" ? "0%" : prev === 0 ? "new" : `${value > prev ? "+" : "−"}${Math.round((Math.abs(value - prev) / prev) * 100)}%`}
    </span>
  );
}

function Row({ stage, pct, color, better = "up" }: { stage: JourneyStage; pct: number | null; color: string; better?: "up" | "down" }) {
  const width = Math.min(100, pct ?? 0);
  const inside = width >= 16;
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 sm:grid-cols-[11.5rem_minmax(0,1fr)_auto]">
      <span title={stage.detail} className="truncate text-[13px] font-medium text-foreground">{stage.label}</span>
      <div className="relative col-span-2 h-7 overflow-hidden rounded-md bg-muted sm:col-span-1 sm:col-start-2 sm:row-start-1">
        <div className="h-full rounded-md transition-[width] duration-500 ease-out" style={{ width: `${width}%`, background: color }} />
        {pct !== null && (
          <span
            className={cn("absolute top-1/2 -translate-y-1/2 text-[12px] font-semibold tabular-nums", inside ? "text-background" : "text-foreground")}
            style={inside ? { right: `calc(${100 - width}% + 8px)` } : { left: `calc(${width}% + 8px)` }}
          >
            {pct}%
          </span>
        )}
      </div>
      <span className="col-start-2 row-start-1 flex items-center justify-end gap-2 sm:col-start-3">
        <span className="min-w-8 text-right text-[15px] font-semibold tabular-nums">{n.format(stage.value)}</span>
        <Change value={stage.value} prev={stage.prev} better={better} />
      </span>
    </li>
  );
}

/** A status pipeline as progress bars: each step as a % of what came in, its count, and the change on the previous period. */
export function Journey({ block }: { block: BlockOf<"journey"> }) {
  const { stages, exits, period } = block;
  const last = Math.max(1, stages.length - 1);
  return (
    <article className="rounded-xl border bg-card p-4 sm:p-5">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold text-foreground">{block.title}</h3>
          <p className="text-[12px] text-muted-foreground">% of {stages[0]?.label.toLowerCase()} · change vs {periodLabel(period.prevFrom, period.prevTo)}</p>
        </div>
        <span className="rounded-full bg-muted px-2.5 py-1 text-[12px] font-medium tabular-nums text-foreground">{periodLabel(period.from, period.to)}</span>
      </header>
      <ol className="space-y-3">
        {stages.map((s, i) => (
          <Row key={s.key} stage={s} pct={shareOfFirst(stages, i)} color={`var(--seq-${6 - Math.round((i * 2) / last)})`} />
        ))}
      </ol>
      {exits.length > 0 && (
        <ol className="mt-4 space-y-3 border-t border-dashed pt-4">
          {exits.map((e) => (
            <Row key={e.key} stage={e} pct={shareOfFirst([stages[0], e], 1)} color="var(--status-bad)" better="down" />
          ))}
        </ol>
      )}
    </article>
  );
}

/** This period against the previous one, step by step, as paired columns. */
export function Compare({ block }: { block: BlockOf<"compare"> }) {
  const max = Math.max(1, ...block.groups.flatMap((g) => [g.value, g.prev]));
  const h = (v: number) => `${v ? Math.max(2, (v / max) * 100) : 0}%`;
  return (
    <div>
      <div className="mb-3 flex gap-4 text-[11.5px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ background: "var(--seq-6)" }} />This period</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-muted-foreground/30" />Previous</span>
      </div>
      <div className="flex gap-1 border-b pb-px pt-5">
        {block.groups.map((g) => (
          <div key={g.label} className="flex h-44 min-w-0 flex-1 items-end justify-center gap-1" title={`${g.label}: ${n.format(g.value)} now, ${n.format(g.prev)} before`}>
            <div className="relative flex h-full w-[32%] max-w-7 items-end">
              <div className="w-full rounded-t-[3px] bg-muted-foreground/30 transition-[height] duration-500" style={{ height: h(g.prev) }} />
            </div>
            <div className="relative flex h-full w-[32%] max-w-7 items-end">
              <div className="w-full rounded-t-[3px] transition-[height] duration-500" style={{ height: h(g.value), background: g.bad ? "var(--status-bad)" : "var(--seq-6)" }} />
              <span className="absolute left-1/2 -translate-x-1/2 text-[11px] font-semibold tabular-nums text-foreground" style={{ bottom: `calc(${h(g.value)} + 3px)` }}>{n.format(g.value)}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-1">
        {block.groups.map((g) => (
          <span key={g.label} className="line-clamp-2 min-w-0 flex-1 text-center text-[11px] leading-tight text-muted-foreground">{g.label}</span>
        ))}
      </div>
    </div>
  );
}
