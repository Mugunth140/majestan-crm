"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRightLeft, Building2, CalendarCheck, Check, CircleDashed, Hand, MessageSquare, PencilLine, Phone, PhoneOff,
  Plus, Receipt, Smartphone, UserPlus, Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { amount, dayGroup, paceGap, STATUS_META, timeLabel, TONE_COLOR } from "./format";
import type { ActivityItem, MetricPace, PaceStatus } from "./types";

/* ───────────────────────── Status ───────────────────────── */

export function StatusPill({ status, className }: { status: PaceStatus; className?: string }) {
  const meta = STATUS_META[status];
  return (
    <span className={cn("inline-flex h-[22px] shrink-0 items-center gap-1.5 rounded-full border px-2 text-[12px] font-medium text-foreground/85", className)}>
      <span aria-hidden className="size-1.5 rounded-full" style={{ background: TONE_COLOR[meta.tone] }} />
      {meta.label}
    </span>
  );
}

/** Progress toward the month, with a tick where a steady pace would be today. */
export function PaceBar({ m, size = "md" }: { m: Pick<MetricPace, "pct" | "expected" | "monthly" | "status" | "label">; size?: "sm" | "md" }) {
  const pct = Math.min(100, m.pct);
  const pace = m.monthly ? Math.min(100, (m.expected / m.monthly) * 100) : 0;
  const tone = STATUS_META[m.status].tone;
  return (
    <div
      className={cn("relative rounded-full bg-muted", size === "sm" ? "h-1.5" : "h-2")}
      role="progressbar" aria-valuenow={Math.round(m.pct)} aria-valuemin={0} aria-valuemax={100}
      aria-label={`${m.label}: ${Math.round(m.pct)}% of the monthly target`}
    >
      <div className="h-full rounded-full transition-[width] duration-700 ease-out" style={{ width: `${pct}%`, background: tone === "muted" || tone === "info" ? "var(--series-1)" : TONE_COLOR[tone] }} />
      {m.status !== "upcoming" && m.status !== "done" && pace > 0 && pace < 100 && (
        <span aria-hidden className={cn("absolute w-0.5 rounded-full bg-foreground/60", size === "sm" ? "-top-[3px] h-3" : "-top-1 h-4")} style={{ left: `calc(${pace}% - 1px)` }} />
      )}
    </div>
  );
}

/** Auto-counted or logged by hand, with what is counted on hover. */
export function SourceChip({ m }: { m: Pick<MetricPace, "tracking" | "source"> }) {
  const auto = m.tracking === "auto";
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span tabIndex={0} className={cn("inline-flex h-5 cursor-default items-center gap-1 rounded px-1.5 text-[11px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring", auto ? "bg-[var(--series-1)]/10 text-[var(--series-1)]" : "bg-muted text-muted-foreground")} />
        }
      >
        {auto ? <Zap aria-hidden className="size-3" /> : <Hand aria-hidden className="size-3" />}
        {auto ? "Auto" : "Manual"}
      </TooltipTrigger>
      <TooltipContent className="max-w-64 text-[12px]">{m.source}</TooltipContent>
    </Tooltip>
  );
}

/* ───────────────────────── One target ───────────────────────── */

export function MetricCard({ m, onLog, compact }: { m: MetricPace; onLog?: () => void; compact?: boolean }) {
  const live = m.status !== "upcoming" && m.status !== "missed";
  return (
    <div className="flex flex-col rounded-xl border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-[13.5px] font-medium text-foreground">{m.label}</h3>
            <SourceChip m={m} />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-[24px] font-semibold leading-none tracking-tight tabular-nums">{amount(m.unit, m.achieved)}</span>
            <span className="text-[13px] text-muted-foreground tabular-nums">/ {amount(m.unit, m.monthly)}</span>
          </div>
        </div>
        <StatusPill status={m.status} />
      </div>

      <div className="mt-3.5"><PaceBar m={m} /></div>
      <div className="mt-2 flex flex-wrap justify-between gap-x-3 gap-y-1 text-[12px] text-muted-foreground">
        <span>{paceGap(m)}</span>
        {live && m.status !== "done" && <span className="tabular-nums">On course for {m.monthly ? Math.round((m.forecast / m.monthly) * 100) : 0}%</span>}
        {m.status === "done" && <span className="tabular-nums">{m.pct}%</span>}
      </div>

      {!compact && live && (
        <div className="mt-4 grid grid-cols-3 gap-2 border-t pt-3.5">
          <Remaining label="Today" left={m.today.remaining} done={m.today.achieved} goal={m.today.goal} unit={m.unit} />
          <Remaining label={`Week ${m.week.number}`} left={m.week.remaining} done={m.week.achieved} goal={m.week.target} unit={m.unit}
            note={m.week.carried > 0 ? `incl. ${amount(m.unit, m.week.carried)} carried over` : undefined} />
          <Remaining label="Month" left={m.remaining} done={m.achieved} goal={m.monthly} unit={m.unit} />
        </div>
      )}

      {onLog && (
        <button type="button" onClick={onLog} className="mt-3.5 inline-flex h-8 items-center justify-center gap-1.5 self-start rounded-md border bg-background px-3 text-[13px] font-medium transition-colors hover:bg-muted">
          <Plus aria-hidden className="size-3.5" /> Log progress
        </button>
      )}
    </div>
  );
}

/** "12 to go" that turns into a check when the goal is met. */
function Remaining({ label, left, done, goal, unit, note }: { label: string; left: number; done: number; goal: number; unit: MetricPace["unit"]; note?: string }) {
  const met = goal > 0 && left <= 0;
  return (
    <div className="min-w-0">
      <div className="text-[11.5px] text-muted-foreground">{label}</div>
      {goal <= 0 ? (
        <div className="mt-0.5 text-[13px] text-muted-foreground">—</div>
      ) : met ? (
        <div className="mt-0.5 inline-flex items-center gap-1 text-[13px] font-medium" style={{ color: TONE_COLOR.good }}>
          <Check aria-hidden className="size-3.5" /> Met
        </div>
      ) : (
        <div className="mt-0.5 text-[13px] font-medium tabular-nums text-foreground">
          {amount(unit, left)} <span className="font-normal text-muted-foreground">to go</span>
        </div>
      )}
      <div className="truncate text-[11px] tabular-nums text-muted-foreground" title={note}>
        {goal > 0 ? `${amount(unit, done)} of ${amount(unit, goal)}` : ""}{note ? ` · ${note}` : ""}
      </div>
    </div>
  );
}

/* ───────────────────────── Today ───────────────────────── */

/** What is left for today across every target, largest gap first. */
export function TodayList({ metrics }: { metrics: MetricPace[] }) {
  const items = metrics.filter((m) => m.today.goal > 0).sort((a, b) => Number(a.today.remaining === 0) - Number(b.today.remaining === 0) || b.today.remaining / b.today.goal - a.today.remaining / a.today.goal);
  if (!items.length) return <p className="text-[13px] text-muted-foreground">No goals today. Sunday is a day off, and finished targets need nothing more.</p>;
  return (
    <ul className="divide-y">
      {items.map((m) => {
        const met = m.today.remaining === 0;
        const pct = Math.min(100, (m.today.achieved / m.today.goal) * 100);
        return (
          <li key={m.key} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
            <span aria-hidden className={cn("flex size-6 shrink-0 items-center justify-center rounded-full border", met && "border-transparent")} style={met ? { background: TONE_COLOR.good } : undefined}>
              {met ? <Check className="size-3.5 text-white" /> : <CircleDashed className="size-3.5 text-muted-foreground" />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className={cn("truncate text-[13px]", met ? "text-muted-foreground line-through decoration-muted-foreground/40" : "font-medium text-foreground")}>{m.label}</span>
                <span className="shrink-0 text-[12px] tabular-nums text-muted-foreground">
                  {met ? "Met" : <><span className="font-medium text-foreground">{amount(m.unit, m.today.remaining)}</span> to go</>}
                  <span className="ml-2">{amount(m.unit, m.today.achieved)}/{amount(m.unit, m.today.goal)}</span>
                </span>
              </div>
              <div className="mt-1.5 h-1 rounded-full bg-muted">
                <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${pct}%`, background: met ? TONE_COLOR.good : "var(--series-1)" }} />
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** A ring of how many of today's goals are met. */
export function GoalRing({ met, total, size = 88 }: { met: number; total: number; size?: number }) {
  const r = 38, c = 2 * Math.PI * r, v = total ? met / total : 0;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 96 96" className="size-full -rotate-90" aria-hidden>
        <circle cx={48} cy={48} r={r} fill="none" stroke="var(--muted)" strokeWidth={8} />
        {met > 0 && <circle cx={48} cy={48} r={r} fill="none" stroke={v >= 1 ? TONE_COLOR.good : "var(--series-1)"} strokeWidth={8} strokeLinecap="round" strokeDasharray={`${v * c} ${c}`} className="transition-[stroke-dasharray] duration-1000" />}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center" role="img" aria-label={`${met} of ${total} goals met today`}>
        <span className="text-[22px] font-semibold leading-none tabular-nums">{met}<span className="text-[14px] font-normal text-muted-foreground">/{total}</span></span>
        <span className="mt-1 text-[10.5px] text-muted-foreground">goals met</span>
      </div>
    </div>
  );
}

/* ───────────────────────── Weeks ───────────────────────── */

/** Target and result for each task week, with the current week marked. */
export function WeekStrip({ m }: { m: MetricPace }) {
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {[1, 2, 3, 4].map((w) => {
        const target = m.weekTargets[w] ?? 0;
        const got = m.byWeek[w] ?? 0;
        const current = w === m.week.number && m.status !== "missed" && m.status !== "upcoming";
        const past = w < m.week.number || m.status === "missed";
        const met = target > 0 && got >= target;
        return (
          <div key={w} className={cn("rounded-md border px-2 py-1.5", current && "border-foreground/30 bg-muted/40")}>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>W{w}</span>
              {past && target > 0 && (met ? <Check aria-label="Met" className="size-3" style={{ color: TONE_COLOR.good }} /> : <span style={{ color: TONE_COLOR.warn }}>−{amount(m.unit, target - got)}</span>)}
            </div>
            <div className="mt-0.5 text-[12.5px] tabular-nums">
              <span className="font-medium text-foreground">{amount(m.unit, got)}</span>
              <span className="text-muted-foreground"> / {amount(m.unit, current ? m.week.target : target)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ───────────────────────── Activity ───────────────────────── */

const KIND_ICON = {
  call: Phone, message: MessageSquare, follow_up: CalendarCheck, status: ArrowRightLeft,
  listing: Building2, candidate: UserPlus, receipt: Receipt, manual: PencilLine,
} as const;

/** Everything that counted toward the targets, newest first, grouped by day. */
export function ActivityFeed({ items, labels, today, limit = 30 }: { items: ActivityItem[]; labels: Map<string, string>; today: string; limit?: number }) {
  const [filter, setFilter] = useState<string | null>(null);
  const [all, setAll] = useState(false);
  const metricsSeen = useMemo(() => [...new Set(items.flatMap((i) => i.metrics))].filter((k) => labels.has(k)), [items, labels]);
  const shown = (filter ? items.filter((i) => i.metrics.includes(filter)) : items).slice(0, all ? undefined : limit);
  const groups: { day: string; items: ActivityItem[] }[] = [];
  for (const it of shown) {
    const day = dayGroup(it.at, today);
    if (groups.at(-1)?.day !== day) groups.push({ day, items: [] });
    groups.at(-1)!.items.push(it);
  }
  if (!items.length) return <p className="py-6 text-center text-[13px] text-muted-foreground">Nothing counted yet this month. Calls from the call logger, follow-ups and status changes will show up here as they happen.</p>;
  return (
    <div>
      {metricsSeen.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label="Show activity for">
          {[null, ...metricsSeen].map((k) => (
            <button key={k ?? "all"} type="button" onClick={() => setFilter(k)} aria-pressed={filter === k}
              className={cn("h-7 rounded-full border px-2.5 text-[12px] transition-colors", filter === k ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
              {k ? labels.get(k) : "All"}
            </button>
          ))}
        </div>
      )}
      <div className="space-y-4">
        {groups.map((g) => (
          <section key={g.day}>
            <h4 className="mb-1 text-[11.5px] font-medium text-muted-foreground">{g.day}</h4>
            <ul>
              {g.items.map((it, i) => <FeedRow key={`${it.at}-${i}`} it={it} labels={labels} />)}
            </ul>
          </section>
        ))}
      </div>
      {!all && (filter ? items.filter((i) => i.metrics.includes(filter)) : items).length > limit && (
        <button type="button" onClick={() => setAll(true)} className="mt-3 h-8 w-full rounded-md text-[13px] text-muted-foreground hover:bg-muted hover:text-foreground">Show all</button>
      )}
    </div>
  );
}

function FeedRow({ it, labels }: { it: ActivityItem; labels: Map<string, string> }) {
  const missed = it.kind === "call" && it.detail?.includes("Not connected");
  const Icon = missed ? PhoneOff : KIND_ICON[it.kind];
  const title = it.href && !it.href.startsWith("http")
    ? <Link href={it.href} className="truncate font-medium text-foreground hover:underline">{it.title}</Link>
    : it.href ? <a href={it.href} target="_blank" rel="noreferrer" className="truncate font-medium text-foreground hover:underline">{it.title}</a>
    : <span className="truncate font-medium text-foreground">{it.title}</span>;
  return (
    <li className="flex gap-3 rounded-md px-1 py-2 hover:bg-muted/40">
      <span aria-hidden className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2 text-[13px]">
          {title}
          <span className="shrink-0 text-[11.5px] tabular-nums text-muted-foreground">{timeLabel(it.at)}</span>
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted-foreground">
          {it.source === "logger" && <span className="inline-flex items-center gap-1 text-foreground/75"><Smartphone aria-hidden className="size-3" />Call logger</span>}
          {it.detail && <span className="truncate">{it.detail}</span>}
        </div>
        <div className="mt-1 flex flex-wrap gap-1">
          {it.metrics.filter((k) => labels.has(k)).map((k) => (
            <span key={k} className="rounded bg-[var(--series-1)]/10 px-1.5 text-[11px] leading-[18px] text-[var(--series-1)]">+ {labels.get(k)}</span>
          ))}
        </div>
      </div>
    </li>
  );
}
