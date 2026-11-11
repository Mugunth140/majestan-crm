"use client";
import { Fragment, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Check, ChevronDown, ChevronsUpDown, Info, Minus, TrendingDown, TrendingUp } from "lucide-react";
import { Avatar } from "@/components/record/feed";
import { cn } from "@/lib/utils";
import { EmptyChart, STATUS, seriesColor, useCountUp, useDash } from "./chart-kit";
import { formatValue, inr, metricDelta, shortDate, type Delta } from "./format";
import type { BlockOf, Insight, LeaderRow, MetricOut, QueueItem, TargetRow, Tone } from "./types";

export function DeltaPill({ d, className }: { d: Delta | null; className?: string }) {
  if (!d) return null;
  const Icon = d.direction === "up" ? ArrowUpRight : d.direction === "down" ? ArrowDownRight : Minus;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-medium tabular-nums",
        d.verdict === "good" ? "text-[var(--delta-good)]" : d.verdict === "bad" ? "text-[var(--delta-bad)]" : "text-muted-foreground",
        className,
      )}
    >
      <Icon aria-hidden className="size-3.5" />
      {d.text}
      <span className="sr-only">{d.verdict === "good" ? " (better)" : d.verdict === "bad" ? " (worse)" : ""}</span>
    </span>
  );
}

/* ────────────────────────────── KPIs ────────────────────────────── */

export function Kpis({ block }: { block: BlockOf<"kpis"> }) {
  const { focus, setFocus, trendKeys } = useDash();
  const many = block.metrics.length;
  return (
    <div className={cn("grid grid-cols-2 gap-3 sm:gap-4", many % 4 === 0 ? "lg:grid-cols-4" : many >= 4 && "md:grid-cols-3 xl:grid-cols-4", many === 3 && "md:grid-cols-3", many >= 10 && "2xl:grid-cols-5")}>
      {block.metrics.map((m, i) => {
        const linked = !!m.series && trendKeys.has(m.series);
        const active = linked && focus === m.series;
        return (
          <KpiTile
            key={m.key}
            m={m}
            i={i}
            active={active}
            onClick={linked ? () => {
              setFocus(active ? null : m.series!);
              if (!active) document.querySelector(`[data-series~="${m.series}"]`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
            } : undefined}
          />
        );
      })}
    </div>
  );
}

function KpiTile({ m, i, active, onClick }: { m: MetricOut; i: number; active: boolean; onClick?: () => void }) {
  const d = metricDelta(m);
  const { intro } = useDash();
  const shown = useCountUp(m.value, intro);
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className="text-[13px] leading-snug text-muted-foreground">{m.label}</span>
        {m.alert ? (
          <AlertTriangle aria-label="Needs attention" className="mt-0.5 size-3.5 shrink-0" style={{ color: STATUS.warn }} />
        ) : m.hint ? (
          <Info aria-hidden className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/60" />
        ) : null}
      </div>
      <div className="mt-3 text-[26px] font-semibold leading-none tracking-tight text-foreground">{formatValue(m.fmt, shown)}</div>
      <div className="mt-2.5 flex min-h-4 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        {d ? <><DeltaPill d={d} /><span>vs previous</span></> : m.snapshot ? <span>Right now</span> : <span>No earlier data</span>}
        {m.median !== undefined && m.median !== null && <span className="ml-auto">Median {formatValue(m.fmt, m.median)}</span>}
      </div>
    </>
  );
  const cls = cn(
    "dash-rise group relative min-w-0 rounded-xl border bg-card p-4 text-left transition-[box-shadow,border-color] sm:p-5",
    onClick && "cursor-pointer hover:border-foreground/20 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-ring",
    active && "border-[var(--series-1)] ring-1 ring-[var(--series-1)]",
  );
  return onClick ? (
    <button type="button" title={m.hint ? `${m.hint}. Click to chart it.` : "Click to chart it"} aria-pressed={active} onClick={onClick} className={cls} style={{ "--i": i } as CSSProperties}>{body}</button>
  ) : (
    <div title={m.hint} className={cls} style={{ "--i": i } as CSSProperties}>{body}</div>
  );
}

/* ─────────────────────────── Leaderboard ─────────────────────────── */

const FLAGS: Record<string, { label: string; tone: Tone | null }> = {
  top: { label: "Top performer", tone: "good" },
  behind: { label: "Behind target", tone: "bad" },
  slowing: { label: "Slowing down", tone: "bad" },
  overloaded: { label: "Overloaded", tone: "warn" },
  neglecting: { label: "Neglecting leads", tone: "warn" },
  "logger-offline": { label: "Logger offline", tone: "warn" },
  "no-activity": { label: "No activity", tone: null },
};

export function FlagChip({ flag }: { flag: string }) {
  const f = FLAGS[flag] ?? { label: flag, tone: null };
  return (
    <span className="inline-flex h-5 shrink-0 items-center gap-1 rounded-full bg-foreground/[0.06] px-2 text-[11px] font-medium text-foreground/75">
      <span aria-hidden className="size-1.5 rounded-full" style={{ background: f.tone ? STATUS[f.tone] : "var(--muted-foreground)" }} />
      {f.label}
    </span>
  );
}

type SortKey = "score" | "change" | "name" | string;

export function Leaderboard({ block }: { block: BlockOf<"leaderboard"> }) {
  const { openPerson, canOpen } = useDash();
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "score", desc: true });
  const rows = useMemo(() => {
    const val = (r: LeaderRow) => sort.key === "score" ? r.score : sort.key === "change" ? r.change : sort.key === "name" ? null : r.values[sort.key];
    return [...block.rows].sort((a, b) => {
      if (sort.key === "name") return sort.desc ? b.name.localeCompare(a.name) : a.name.localeCompare(b.name);
      const va = val(a), vb = val(b);
      if (va === null || va === undefined) return 1;
      if (vb === null || vb === undefined) return -1;
      return sort.desc ? vb - va : va - vb;
    });
  }, [block.rows, sort]);
  const best = useMemo(() => {
    const out: Record<string, number | null> = {};
    for (const c of block.columns) {
      const vals = block.rows.map((r) => r.values[c.key]).filter((v): v is number => v !== null && v !== undefined);
      out[c.key] = vals.length > 1 && c.better !== "none" ? (c.better === "up" ? Math.max(...vals) : Math.min(...vals)) : null;
    }
    return out;
  }, [block]);
  if (!rows.length) return <EmptyChart>No one to rank yet</EmptyChart>;

  const head = (key: SortKey, label: string, align: "left" | "right" = "right") => (
    <th scope="col" className={cn("whitespace-nowrap px-3 py-2.5 font-medium", align === "right" ? "text-right" : "text-left")} aria-sort={sort.key === key ? (sort.desc ? "descending" : "ascending") : "none"}>
      <button type="button" onClick={() => setSort((s) => ({ key, desc: s.key === key ? !s.desc : key !== "name" }))} className={cn("inline-flex items-center gap-1 hover:text-foreground", sort.key === key && "text-foreground")}>
        {label}
        <ChevronsUpDown aria-hidden className="size-3 opacity-50" />
      </button>
    </th>
  );

  return (
    <div className="table-scroll -mx-4 overflow-x-auto pb-1 sm:-mx-5">
      <table className="w-full min-w-[640px] border-collapse text-[13px]">
        <thead className="text-xs text-muted-foreground">
          <tr className="border-b">
            <th scope="col" className="w-10 py-2.5 pl-4 text-left font-medium sm:pl-5">#</th>
            {head("name", "Person", "left")}
            {head("score", "Score", "left")}
            {head("change", "Change")}
            {block.columns.map((c) => <Fragment key={c.key}>{head(c.key, c.label)}</Fragment>)}
            <th scope="col" className="px-3 py-2.5 pr-4 text-left font-medium sm:pr-5">Signals</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.personId} onClick={canOpen(r.personId) ? () => openPerson(r.personId) : undefined} className={cn("group border-b transition-colors last:border-0", canOpen(r.personId) && "cursor-pointer hover:bg-muted/50")}>
              <td className="py-3 pl-4 tabular-nums text-muted-foreground sm:pl-5">{i + 1}</td>
              <td className="px-3 py-3">
                <PersonCell r={r} open={canOpen(r.personId) ? () => openPerson(r.personId) : undefined} />
              </td>
              <td className="px-3 py-3"><ScoreBar score={r.score} basis={r.scoreBasis} /></td>
              <td className="px-3 py-3 text-right">{r.change === null ? <span className="text-muted-foreground">—</span> : <span className={cn("tabular-nums", r.change > 0 ? "text-[var(--delta-good)]" : r.change < 0 ? "text-[var(--delta-bad)]" : "text-muted-foreground")}>{r.change > 0 ? "+" : ""}{r.change}%</span>}</td>
              {block.columns.map((c) => {
                const v = r.values[c.key];
                const top = v !== null && v !== undefined && best[c.key] === v;
                return <td key={c.key} className={cn("px-3 py-3 text-right tabular-nums", top ? "font-semibold text-foreground" : "text-foreground/80")}>{formatValue(c.fmt, v)}</td>;
              })}
              <td className="px-3 py-3 pr-4 sm:pr-5">
                <div className="flex flex-wrap gap-1">{r.flags.length ? r.flags.map((f) => <FlagChip key={f} flag={f} />) : <span className="text-muted-foreground">—</span>}</div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PersonCell({ r, open }: { r: LeaderRow; open?: () => void }) {
  const body = (
    <>
      <Avatar name={r.name} src={r.avatar} userId={r.personId} staff className="size-7" />
      <span className="min-w-0">
        <span className={cn("block truncate font-medium text-foreground", open && "group-hover:underline")}>{r.name}</span>
        <span className="block truncate text-xs text-muted-foreground">{r.role}</span>
      </span>
    </>
  );
  if (!open) return <span className="flex min-w-0 items-center gap-2.5">{body}</span>;
  return (
    <button type="button" onClick={(e) => { e.stopPropagation(); open(); }} className="flex min-w-0 items-center gap-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {body}
    </button>
  );
}

export function ScoreBar({ score, basis }: { score: number | null; basis: "targets" | "peers" | null }) {
  if (score === null) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="flex items-center gap-2" title={basis === "targets" ? "Pace against monthly targets" : "Weighted percentile against the department"}>
      <span className="h-1.5 w-16 rounded-full bg-muted">
        <span className="block h-full rounded-full" style={{ width: `${Math.max(3, Math.min(100, score))}%`, background: seriesColor(0) }} />
      </span>
      <span className="w-7 font-medium tabular-nums">{Math.round(score)}</span>
    </span>
  );
}

/* ──────────────────────────── Insights ──────────────────────────── */

const INSIGHT_ICON: Record<Tone, typeof Check> = { good: TrendingUp, bad: TrendingDown, warn: AlertTriangle };

export function Insights({ block }: { block: BlockOf<"insights"> }) {
  const [all, setAll] = useState(false);
  if (!block.items.length) {
    return (
      <div className="flex min-h-32 items-center gap-3 rounded-lg bg-muted/40 px-4 text-[13px] text-muted-foreground">
        <Check aria-hidden className="size-4" style={{ color: STATUS.good }} />
        Nothing unusual stands out in this period.
      </div>
    );
  }
  const items = all ? block.items : block.items.slice(0, 6);
  return (
    <div>
      <ul className="-mx-2 divide-y">
        {items.map((it, i) => <InsightRow key={`${it.title}-${i}`} it={it} />)}
      </ul>
      {block.items.length > 6 && (
        <button type="button" onClick={() => setAll((v) => !v)} className="mt-2 inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
          {all ? "Show fewer" : `Show all ${block.items.length}`}
          <ChevronDown className={cn("size-3.5 transition-transform", all && "rotate-180")} />
        </button>
      )}
    </div>
  );
}

function InsightRow({ it }: { it: Insight }) {
  const { openPerson, canOpen } = useDash();
  const Icon = INSIGHT_ICON[it.tone];
  const body = (
    <span className="flex gap-3 px-2 py-3">
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-foreground/[0.05]">
        <Icon aria-label={it.tone === "good" ? "Shining" : it.tone === "bad" ? "Lacking" : "Watch"} className="size-3.5" style={{ color: STATUS[it.tone] }} />
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] font-medium text-foreground">{it.title}</span>
        <span className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">{it.detail}</span>
      </span>
    </span>
  );
  const cls = "block w-full rounded-md text-left transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-ring";
  if (canOpen(it.personId)) return <li><button type="button" onClick={() => openPerson(it.personId!)} className={cls}>{body}</button></li>;
  if (it.href) return <li><Link href={it.href} className={cls}>{body}</Link></li>;
  return <li>{body}</li>;
}

/* ───────────────────────────── Queue ───────────────────────────── */

const REASONS: Record<string, { label: string; tone: Tone }> = {
  overdue: { label: "Overdue", tone: "bad" },
  today: { label: "Due today", tone: "warn" },
  rnr: { label: "Not reachable ×3", tone: "warn" },
  neglected: { label: "No contact 7+ days", tone: "bad" },
  unscheduled: { label: "No follow-up set", tone: "warn" },
};

export function Queue({ block }: { block: BlockOf<"queue"> }) {
  const { openPerson, canOpen } = useDash();
  const [reason, setReason] = useState<string | null>(null);
  const [all, setAll] = useState(false);
  const counts = useMemo(() => block.items.reduce<Record<string, number>>((m, i) => ({ ...m, [i.reason]: (m[i.reason] ?? 0) + 1 }), {}), [block.items]);
  if (!block.items.length) {
    return (
      <div className="flex min-h-24 items-center gap-3 rounded-lg bg-muted/40 px-4 text-[13px] text-muted-foreground">
        <Check aria-hidden className="size-4" style={{ color: STATUS.good }} /> Every lead has a next step. Nothing is waiting.
      </div>
    );
  }
  const filtered = reason ? block.items.filter((i) => i.reason === reason) : block.items;
  const shown = all ? filtered : filtered.slice(0, 8);
  const showOwner = new Set(block.items.map((i) => i.ownerId)).size > 1;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by reason">
        <ReasonChip active={reason === null} onClick={() => setReason(null)} label="All" count={block.items.length} />
        {Object.keys(REASONS).filter((r) => counts[r]).map((r) => <ReasonChip key={r} active={reason === r} onClick={() => setReason(reason === r ? null : r)} label={REASONS[r].label} count={counts[r]} tone={REASONS[r].tone} />)}
      </div>
      <div className="table-scroll -mx-4 overflow-x-auto pb-1 sm:-mx-5">
        <table className="w-full min-w-[560px] text-[13px]">
          <thead className="text-xs text-muted-foreground">
            <tr className="border-b">
              <th className="py-2 pl-4 text-left font-medium sm:pl-5">Lead</th>
              <th className="px-3 py-2 text-left font-medium">Why</th>
              {showOwner && <th className="px-3 py-2 text-left font-medium">Owner</th>}
              <th className="px-3 py-2 text-right font-medium">Follow-up</th>
              <th className="py-2 pl-3 pr-4 text-right font-medium sm:pr-5">Idle</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((q) => <QueueRow key={q.id} q={q} showOwner={showOwner} openPerson={canOpen(q.ownerId) ? openPerson : undefined} />)}
          </tbody>
        </table>
      </div>
      {filtered.length > 8 && (
        <button type="button" onClick={() => setAll((v) => !v)} className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
          {all ? "Show fewer" : `Show all ${filtered.length}`}
          <ChevronDown className={cn("size-3.5 transition-transform", all && "rotate-180")} />
        </button>
      )}
    </div>
  );
}

function QueueRow({ q, showOwner, openPerson }: { q: QueueItem; showOwner: boolean; openPerson?: (id: number) => void }) {
  const r = REASONS[q.reason] ?? { label: q.reason, tone: "warn" as Tone };
  return (
    <tr className="border-b last:border-0 hover:bg-muted/40">
      <td className="py-2.5 pl-4 sm:pl-5">
        <Link href={`/leads/${q.id}`} className="font-medium text-foreground hover:underline">{q.name || `Lead #${q.id}`}</Link>
        <span className="block text-xs text-muted-foreground">{q.status}</span>
      </td>
      <td className="px-3 py-2.5">
        <span className="inline-flex items-center gap-1.5 text-foreground/80">
          <span aria-hidden className="size-1.5 rounded-full" style={{ background: STATUS[r.tone] }} />
          {r.label}
        </span>
      </td>
      {showOwner && (
        <td className="px-3 py-2.5">
          {openPerson ? <button type="button" onClick={() => openPerson(q.ownerId)} className="text-foreground/80 hover:text-foreground hover:underline">{q.owner ?? `#${q.ownerId}`}</button> : <span className="text-foreground/80">{q.owner ?? `#${q.ownerId}`}</span>}
        </td>
      )}
      <td className="px-3 py-2.5 text-right tabular-nums text-foreground/80">{q.due ? shortDate(q.due) : "—"}</td>
      <td className="py-2.5 pl-3 pr-4 text-right tabular-nums text-muted-foreground sm:pr-5">{q.idleDays} d</td>
    </tr>
  );
}

function ReasonChip({ active, onClick, label, count, tone }: { active: boolean; onClick: () => void; label: string; count: number; tone?: Tone }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring",
        active ? "border-foreground/80 bg-foreground text-background" : "border-border text-foreground/80 hover:bg-muted",
      )}
    >
      {tone && <span aria-hidden className="size-1.5 rounded-full" style={{ background: STATUS[tone] }} />}
      {label}
      <span className={cn("tabular-nums", active ? "text-background/70" : "text-muted-foreground")}>{count}</span>
    </button>
  );
}

/* ──────────────────────────── Targets ──────────────────────────── */

const amount = (r: TargetRow, v: number) => (r.unit === "amount" ? inr(v) : Math.round(v).toLocaleString("en-IN"));

export function Targets({ block }: { block: BlockOf<"targets"> }) {
  const { openPerson, canOpen } = useDash();
  if (!block.rows.length) return <EmptyChart>No targets set for this month</EmptyChart>;
  return (
    <div className={cn("grid gap-3", block.personal && block.rows.length > 1 && "md:grid-cols-2")}>
      {block.rows.map((r) => {
        const pct = r.monthly ? (r.achieved / r.monthly) * 100 : 0;
        const pace = r.monthly ? (r.expected / r.monthly) * 100 : 0;
        const ahead = r.achieved >= r.expected;
        const forecastPct = r.monthly ? Math.round((r.forecast / r.monthly) * 100) : 0;
        return (
          <div key={`${r.personId}-${r.metric}`} className="rounded-lg border p-4">
            <div className="flex items-baseline justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-[13px] font-medium text-foreground">{r.label}</div>
                {!block.personal && (canOpen(r.personId) ? <button type="button" onClick={() => openPerson(r.personId)} className="truncate text-xs text-muted-foreground hover:text-foreground hover:underline">{r.name}</button> : <span className="truncate text-xs text-muted-foreground">{r.name}</span>)}
              </div>
              <div className="shrink-0 text-right">
                <span className="text-lg font-semibold tabular-nums">{amount(r, r.achieved)}</span>
                <span className="text-[13px] text-muted-foreground"> / {amount(r, r.monthly)}</span>
              </div>
            </div>
            <div className="relative mt-3 h-2 rounded-full bg-muted" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={`${r.label}: ${Math.round(pct)}% of the monthly target`}>
              <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${Math.min(100, pct)}%`, background: ahead ? STATUS.good : seriesColor(0) }} />
              <span aria-hidden title={`Expected by today: ${amount(r, r.expected)}`} className="absolute -top-1 h-4 w-0.5 rounded-full bg-foreground/70" style={{ left: `calc(${Math.min(100, pace)}% - 1px)` }} />
            </div>
            <div className="mt-2 flex flex-wrap justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                {ahead ? <Check aria-hidden className="size-3" style={{ color: STATUS.good }} /> : <AlertTriangle aria-hidden className="size-3" style={{ color: STATUS.warn }} />}
                {ahead ? "Ahead of pace" : `${amount(r, Math.max(0, r.expected - r.achieved))} behind pace`}
              </span>
              <span>On course for {forecastPct}%</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 border-t pt-3 text-xs">
              <MiniGoal label="Today" achieved={r.today.achieved} goal={r.today.goal} fmt={(v) => amount(r, v)} />
              <MiniGoal label={`Week ${r.week.number}`} achieved={r.week.achieved} goal={r.week.target} fmt={(v) => amount(r, v)} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MiniGoal({ label, achieved, goal, fmt }: { label: string; achieved: number; goal: number; fmt: (v: number) => string }) {
  const done = goal > 0 && achieved >= goal;
  return (
    <div>
      <div className="text-muted-foreground">{label}</div>
      <div className="mt-0.5 flex items-center gap-1 font-medium tabular-nums text-foreground">
        {fmt(achieved)}<span className="font-normal text-muted-foreground">/ {goal > 0 ? fmt(goal) : "—"}</span>
        {done && <Check aria-label="Done" className="size-3.5" style={{ color: STATUS.good }} />}
      </div>
    </div>
  );
}

/* ───────────────────────── Metric table ───────────────────────── */

export function MetricTable({ block }: { block: BlockOf<"table"> }) {
  return (
    <div className="table-scroll -mx-4 overflow-x-auto pb-1 sm:-mx-5">
      <table className="w-full min-w-[560px] text-[13px]">
        <thead className="text-xs text-muted-foreground">
          <tr className="border-b">
            <th className="py-2.5 pl-4 text-left font-medium sm:pl-5">Metric</th>
            <th className="px-3 py-2.5 text-right font-medium">This period</th>
            <th className="px-3 py-2.5 text-right font-medium">Previous</th>
            <th className="px-3 py-2.5 text-right font-medium">Change</th>
            <th className="px-3 py-2.5 text-right font-medium">Team median</th>
            <th className="py-2.5 pl-3 pr-4 text-left font-medium sm:pr-5">Standing</th>
          </tr>
        </thead>
        <tbody>
          {block.metrics.map((m) => (
            <tr key={m.key} className="border-b last:border-0">
              <td className="py-2.5 pl-4 sm:pl-5">
                <span className="text-foreground/90">{m.label}</span>
                {m.hint && <span className="block text-xs text-muted-foreground">{m.hint}</span>}
              </td>
              <td className="px-3 py-2.5 text-right font-medium tabular-nums">{formatValue(m.fmt, m.value)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{m.snapshot ? "—" : formatValue(m.fmt, m.prev)}</td>
              <td className="px-3 py-2.5 text-right"><DeltaPill d={metricDelta(m)} /></td>
              <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{formatValue(m.fmt, m.median ?? null)}</td>
              <td className="py-2.5 pl-3 pr-4 sm:pr-5"><Standing p={m.percentile ?? null} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Where a value sits in the team, 0–100, with the median marked. */
export function Standing({ p }: { p: number | null }) {
  if (p === null) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="flex items-center gap-2" title={`Better than ${Math.round(p)}% of the team`}>
      <span className="relative h-1.5 w-20 rounded-full bg-muted">
        <span aria-hidden className="absolute left-1/2 top-[-2px] h-2.5 w-px bg-foreground/30" />
        <span className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card" style={{ left: `${Math.min(100, Math.max(0, p))}%`, background: p >= 50 ? STATUS.good : STATUS.bad }} />
      </span>
      <span className="w-8 text-xs tabular-nums text-muted-foreground">P{Math.round(p)}</span>
    </span>
  );
}
