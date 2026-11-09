"use client";
import Link from "next/link";
import { Fragment, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Copy, Plus, RefreshCw, UserPlus, Zap } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/record/feed";
import { PageActions } from "@/components/layout/page-actions";
import { SegmentTabs, ToolbarSearch, ToolbarSelect, headerPrimaryClass, headerButtonClass } from "@/components/layout/list-page";
import { EmptyState } from "@/components/shared/empty-state";
import { amount, monthLabel, STATUS_META, TONE_COLOR } from "./format";
import { PaceBar, SourceChip, StatusPill } from "./parts";
import { send, useAgo, type Live } from "./use-tasks";
import type { Board, PaceStatus, TaskRow } from "./types";

type Filter = "all" | "behind" | "on_pace" | "ahead" | "done";
const FILTERS: { value: Filter; label: string; match: (s: PaceStatus) => boolean }[] = [
  { value: "all", label: "Everyone", match: () => true },
  { value: "behind", label: "Behind", match: (s) => s === "behind" || s === "missed" },
  { value: "on_pace", label: "On pace", match: (s) => s === "on_pace" || s === "upcoming" },
  { value: "ahead", label: "Ahead", match: (s) => s === "ahead" },
  { value: "done", label: "Done", match: (s) => s === "done" },
];

/** Everyone's targets for a month, live, for managers and team leads. */
export function TargetBoard({ board, live, month, setMonth, meId }: { board: Board; live: Live<Board>; month: string; setMonth: (m: string) => void; meId: number | null }) {
  const router = useRouter();
  const [dept, setDept] = useState<string>("all");
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Set<number>>(() => new Set());
  const [copying, setCopying] = useState(false);
  const ago = useAgo(live.updatedAt);

  const inDept = useMemo(() => board.rows.filter((r) => dept === "all" || String(r.department_id) === dept), [board.rows, dept]);
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const f = FILTERS.find((x) => x.value === filter)!;
    return inDept.filter((r) => f.match(r.overall.status) && (!q || r.person.name.toLowerCase().includes(q) || r.metrics.some((m) => m.label.toLowerCase().includes(q))));
  }, [inDept, filter, query]);
  const without = board.without.filter((p) => dept === "all" || String(p.department_id) === dept);
  const live_ = month === board.current;

  const toggle = (id: number) => setOpen((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const copy = async () => {
    setCopying(true);
    try {
      const r = await send<{ created: number[] }>("/copy", "POST", { month });
      toast.success(r.created.length ? `Repeated last month's targets for ${r.created.length} ${r.created.length === 1 ? "person" : "people"}` : "Everyone already has targets");
      live.reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCopying(false);
    }
  };

  const controls = (
    <>
      <ToolbarSelect label="Month" value={month} closeOnSelect onChange={setMonth}
        options={board.months.map((m) => ({ value: m, label: monthLabel(m) + (m === board.current ? " (this month)" : "") }))} />
      {board.departments.length > 1 && (
        <ToolbarSelect label="Team" value={dept} closeOnSelect onChange={setDept}
          options={[{ value: "all", label: "All teams" }, ...board.departments.map((d) => ({ value: String(d.id), label: d.name.replace(/\s+Department$/i, ""), count: board.rows.filter((r) => r.department_id === d.id).length }))]} />
      )}
      <button type="button" onClick={live.reload} disabled={live.refreshing} title={ago ? `Updated ${ago}. Refreshes every minute.` : "Refresh"} aria-label="Refresh"
        className="flex size-8 items-center justify-center rounded-md bg-muted/70 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-60">
        <RefreshCw className={cn("size-4", live.refreshing && "animate-spin")} />
      </button>
      {board.can.copy && (
        <button type="button" onClick={copy} disabled={copying} className={headerButtonClass}>
          <Copy className="size-4" /> Repeat last month
        </button>
      )}
      {board.can.create && (
        <button type="button" onClick={() => router.push(`/tasks/new?month=${month}`)} className={headerPrimaryClass}>
          <Plus className="size-4" /> Set targets
        </button>
      )}
    </>
  );

  const counts = Object.fromEntries(FILTERS.map((f) => [f.value, inDept.filter((r) => f.match(r.overall.status)).length])) as Record<Filter, number>;
  const avg = inDept.length ? Math.round(inDept.reduce((s, r) => s + r.overall.pct, 0) / inDept.length) : 0;
  const goals = inDept.reduce((a, r) => ({ met: a.met + r.overall.today.met, total: a.total + r.overall.today.total }), { met: 0, total: 0 });
  const mine = meId ? board.rows.find((r) => r.person.id === meId) : undefined;

  return (
    <>
      <PageActions>{controls}</PageActions>
      <div className="mx-auto w-full min-w-0 max-w-screen-2xl space-y-5 px-4 pb-16 pt-4 lg:px-0 lg:pt-0">
        <div className="flex flex-wrap items-center gap-2 md:hidden">{controls}</div>

        <p className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
          <Zap aria-hidden className="size-3.5 text-[var(--series-1)]" />
          {live_ ? <>Counted live from the call logger, follow-ups and status changes{ago ? ` · updated ${ago}` : ""}</> : month > board.current ? "Planned targets. Counting starts on the 1st." : `Final results for ${monthLabel(month)}.`}
          {mine && <Link href={`/tasks/${mine.id}`} className="ml-auto font-medium text-foreground hover:underline">Your targets →</Link>}
        </p>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Tile label="With targets" value={String(inDept.length)} detail={without.length ? `${without.length} without targets` : "Everyone is covered"} tone={without.length ? "warn" : undefined} />
          <Tile label="On pace or ahead" value={`${counts.on_pace + counts.ahead + counts.done}`} detail={`of ${inDept.length}`} meter={inDept.length ? (counts.on_pace + counts.ahead + counts.done) / inDept.length : 0} />
          <Tile label="Behind" value={String(counts.behind)} detail={counts.behind ? "Need a push" : "Nobody behind"} tone={counts.behind ? "warn" : undefined} />
          {live_
            ? <Tile label="Today's goals met" value={`${goals.met}`} detail={`of ${goals.total}`} meter={goals.total ? goals.met / goals.total : 0} />
            : <Tile label="Average completion" value={`${avg}%`} detail={monthLabel(month)} meter={avg / 100} />}
        </div>

        {board.rows.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <SegmentTabs label="Show" value={filter} onChange={setFilter}
              tabs={FILTERS.map((f) => ({ value: f.value, label: <>{f.label} <span className="ml-0.5 tabular-nums text-muted-foreground">{counts[f.value]}</span></> }))} />
            <div className="ml-auto w-full md:w-auto"><ToolbarSearch value={query} onChange={setQuery} placeholder="Search people or targets" /></div>
          </div>
        )}

        {board.rows.length === 0 ? (
          <EmptyState kind="tasks" title={`No targets for ${monthLabel(month)}`} description={board.can.create ? "Set monthly targets and they will count themselves from calls, follow-ups and status changes." : undefined}
            action={board.can.create ? <button type="button" onClick={() => router.push(`/tasks/new?month=${month}`)} className={headerPrimaryClass}><Plus className="size-4" /> Set targets</button> : undefined} />
        ) : rows.length === 0 ? (
          <p className="rounded-xl border border-dashed px-4 py-10 text-center text-[13px] text-muted-foreground">Nobody matches. Try another filter.</p>
        ) : (
          <>
            <PeopleTable rows={rows} open={open} toggle={toggle} />
            <div className="space-y-3 md:hidden">{rows.map((r) => <PersonCard key={r.id} r={r} open={open.has(r.id)} toggle={() => toggle(r.id)} />)}</div>
          </>
        )}

        {without.length > 0 && board.can.create && (
          <section className="rounded-xl border border-dashed p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-[14px] font-medium">No targets yet</h2>
                <p className="text-[12.5px] text-muted-foreground">They have nothing to aim for in {monthLabel(month)}.</p>
              </div>
              <button type="button" onClick={() => router.push(`/tasks/new?month=${month}&people=${without.map((p) => p.id).join(",")}`)} className={headerButtonClass}>
                <UserPlus className="size-4" /> Set targets for {without.length === 1 ? without[0].name.split(" ")[0] : `all ${without.length}`}
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {without.map((p) => (
                <Link key={p.id} href={`/tasks/new?month=${month}&people=${p.id}`} className="inline-flex h-8 items-center gap-2 rounded-full border bg-card pl-1 pr-3 text-[13px] hover:bg-muted">
                  <Avatar name={p.name} src={p.avatar} userId={p.id} staff className="size-6" />
                  {p.name}
                  <span className="text-[11.5px] text-muted-foreground">{p.department?.replace(/\s+Department$/i, "")}</span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}

function Tile({ label, value, detail, meter, tone }: { label: string; value: string; detail: string; meter?: number; tone?: "warn" }) {
  return (
    <div className="min-w-0 rounded-xl border bg-card p-4 sm:p-5">
      <div className="text-[13px] text-muted-foreground">{label}</div>
      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="text-[26px] font-semibold leading-none tracking-tight tabular-nums">{value}</span>
        <span className="truncate text-[12.5px]" style={{ color: tone ? TONE_COLOR[tone] : "var(--muted-foreground)" }}>{detail}</span>
      </div>
      {meter !== undefined && (
        <div className="mt-3 h-1.5 rounded-full bg-muted">
          <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${Math.min(100, meter * 100)}%`, background: "var(--series-1)" }} />
        </div>
      )}
    </div>
  );
}

function TodayCell({ r }: { r: TaskRow }) {
  const { met, total } = r.overall.today;
  if (!total) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="inline-flex items-center gap-2 tabular-nums">
      <span className="flex gap-0.5" aria-hidden>
        {Array.from({ length: total }, (_, i) => <span key={i} className="h-3 w-1.5 rounded-sm" style={{ background: i < met ? TONE_COLOR.good : "var(--muted)" }} />)}
      </span>
      <span className={met === total ? "font-medium" : "text-muted-foreground"}>{met}/{total}</span>
    </span>
  );
}

function PeopleTable({ rows, open, toggle }: { rows: TaskRow[]; open: Set<number>; toggle: (id: number) => void }) {
  return (
    <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
      <table className="w-full text-[13px]">
        <thead className="text-xs text-muted-foreground">
          <tr className="border-b">
            <th className="w-10" />
            <th className="py-2.5 pr-3 text-left font-medium">Person</th>
            <th className="w-[28%] px-3 py-2.5 text-left font-medium">Month</th>
            <th className="px-3 py-2.5 text-left font-medium">Pace</th>
            <th className="px-3 py-2.5 text-left font-medium">Today&apos;s goals</th>
            <th className="py-2.5 pl-3 pr-5 text-left font-medium">Needs attention</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const isOpen = open.has(r.id);
            const behind = r.metrics.filter((m) => m.status === "behind" || m.status === "missed");
            return (
              <Fragment key={r.id}>
                <tr className={cn("cursor-pointer border-b transition-colors hover:bg-muted/40", isOpen && "bg-muted/30")} onClick={() => toggle(r.id)}>
                  <td className="py-3 pl-4">
                    <button type="button" aria-expanded={isOpen} aria-label={`${isOpen ? "Hide" : "Show"} ${r.person.name}'s targets`} onClick={(e) => { e.stopPropagation(); toggle(r.id); }}
                      className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground">
                      {isOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                    </button>
                  </td>
                  <td className="py-3 pr-3">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={r.person.name} src={r.person.avatar} userId={r.person.id} staff className="size-7 text-[11px]" />
                      <div className="min-w-0">
                        <Link href={`/tasks/${r.id}`} onClick={(e) => e.stopPropagation()} className="block truncate font-medium text-foreground hover:underline">{r.person.name}</Link>
                        <div className="truncate text-[12px] text-muted-foreground">{r.person.department?.replace(/\s+Department$/i, "")} · {r.metrics.length} targets</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex-1"><PaceBar size="sm" m={{ pct: r.overall.pct, expected: 0, monthly: 0, status: r.overall.status, label: "Average" }} /></div>
                      <span className="w-10 text-right tabular-nums">{r.overall.pct}%</span>
                    </div>
                  </td>
                  <td className="px-3 py-3"><StatusPill status={r.overall.status} /></td>
                  <td className="px-3 py-3"><TodayCell r={r} /></td>
                  <td className="py-3 pl-3 pr-5 text-[12.5px] text-muted-foreground">
                    {behind.length ? behind.slice(0, 2).map((m) => `${m.label} (${amount(m.unit, Math.max(0, m.expected - m.achieved))} short)`).join(", ") + (behind.length > 2 ? ` +${behind.length - 2}` : "") : "—"}
                  </td>
                </tr>
                {isOpen && (
                  <tr className="border-b bg-muted/20">
                    <td />
                    <td colSpan={5} className="pb-4 pr-5 pt-1"><MetricLines r={r} /></td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Each target of a person on one line: progress, pace, and what is left today and this week. */
function MetricLines({ r }: { r: TaskRow }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-[12.5px]">
        <thead className="text-[11.5px] text-muted-foreground">
          <tr>
            <th className="py-2 pr-3 text-left font-medium">Target</th>
            <th className="px-3 py-2 text-right font-medium">Done</th>
            <th className="w-[24%] px-3 py-2 text-left font-medium">Progress</th>
            <th className="px-3 py-2 text-right font-medium">Today to go</th>
            <th className="px-3 py-2 text-right font-medium">Week {r.metrics[0]?.week.number} to go</th>
            <th className="py-2 pl-3 text-left font-medium">Pace</th>
          </tr>
        </thead>
        <tbody>
          {r.metrics.map((m) => (
            <tr key={m.key} className="border-t border-border/60">
              <td className="py-2 pr-3"><span className="mr-2 text-foreground">{m.label}</span><SourceChip m={m} /></td>
              <td className="px-3 py-2 text-right tabular-nums"><span className="font-medium">{amount(m.unit, m.achieved)}</span><span className="text-muted-foreground"> / {amount(m.unit, m.monthly)}</span></td>
              <td className="px-3 py-2"><PaceBar size="sm" m={m} /></td>
              <td className="px-3 py-2 text-right tabular-nums">{m.today.goal ? (m.today.remaining ? amount(m.unit, m.today.remaining) : <span style={{ color: TONE_COLOR.good }}>Met</span>) : "—"}</td>
              <td className="px-3 py-2 text-right tabular-nums">{m.week.remaining ? amount(m.unit, m.week.remaining) : <span style={{ color: TONE_COLOR.good }}>Met</span>}</td>
              <td className="py-2 pl-3"><span className="inline-flex items-center gap-1.5"><span aria-hidden className="size-1.5 rounded-full" style={{ background: TONE_COLOR[STATUS_META[m.status].tone] }} />{STATUS_META[m.status].label}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PersonCard({ r, open, toggle }: { r: TaskRow; open: boolean; toggle: () => void }) {
  return (
    <div className="rounded-xl border bg-card">
      <button type="button" onClick={toggle} aria-expanded={open} className="flex w-full items-center gap-3 p-4 text-left">
        <Avatar name={r.person.name} src={r.person.avatar} userId={r.person.id} staff className="size-8 text-[11px]" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-[14px] font-medium">{r.person.name}</span>
            <StatusPill status={r.overall.status} />
          </div>
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1"><PaceBar size="sm" m={{ pct: r.overall.pct, expected: 0, monthly: 0, status: r.overall.status, label: "Average" }} /></div>
            <span className="text-[12px] tabular-nums text-muted-foreground">{r.overall.pct}%</span>
          </div>
          <div className="mt-1.5 text-[12px] text-muted-foreground">Today <TodayCell r={r} /></div>
        </div>
      </button>
      {open && (
        <div className="space-y-3 border-t px-4 pb-4 pt-3">
          {r.metrics.map((m) => (
            <div key={m.key}>
              <div className="flex items-baseline justify-between gap-2 text-[13px]">
                <span className="truncate">{m.label}</span>
                <span className="shrink-0 tabular-nums"><span className="font-medium">{amount(m.unit, m.achieved)}</span><span className="text-muted-foreground"> / {amount(m.unit, m.monthly)}</span></span>
              </div>
              <div className="mt-1.5"><PaceBar size="sm" m={m} /></div>
              <div className="mt-1 text-[11.5px] text-muted-foreground">{m.today.goal ? `${m.today.remaining ? `${amount(m.unit, m.today.remaining)} to go today` : "Today met"} · ` : ""}{m.week.remaining ? `${amount(m.unit, m.week.remaining)} to go this week` : "Week met"}</div>
            </div>
          ))}
          <Link href={`/tasks/${r.id}`} className="block pt-1 text-[13px] font-medium text-foreground hover:underline">Open {r.person.name.split(" ")[0]}&apos;s targets →</Link>
        </div>
      )}
    </div>
  );
}
