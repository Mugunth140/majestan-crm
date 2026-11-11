"use client";
import { GettingStarted } from "@/components/onboarding/getting-started";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { PageActions } from "@/components/layout/page-actions";
import { apiFetch, apiJson } from "@/lib/api-fetch";
import { cn } from "@/lib/utils";
import { DashContext } from "./chart-kit";
import { BarList, Donut, Funnel, Heatmap, Radar, Scatter, StackedBars, TrendChart } from "./charts";
import { RANGES } from "./format";
import { PeriodPicker } from "@/components/shared/period-picker";
import { Insights, Kpis, Leaderboard, MetricTable, Queue, Targets } from "./lists";
import { Progress, confetti } from "./progress";
import { DashboardSkeleton } from "./skeleton";
import { SubjectPicker } from "./subject-picker";
import type { Block, RangeKey, Report, Section, Span, Subjects } from "./types";

const API = process.env.NEXT_PUBLIC_API_URL || "/api/v1";
const RANGE_KEYS = RANGES.map((r) => r.value);
const CUSTOM_RANGE = /^(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})$/;

/** Reports already fetched this visit, so switching back to a tab is instant. */
const cache = new Map<string, Report>();

/** The entry animation plays once per visit, on the first report shown. */
let introPlayed = false;
const INTRO_MS = 2200;

type Load<T> = { data: T | null; error: string | null; loading: boolean };

function useSubjects() {
  const [state, setState] = useState<Load<Subjects>>({ data: null, error: null, loading: true });
  useEffect(() => {
    const ctrl = new AbortController();
    apiJson<{ success: boolean; data: Subjects; message?: string }>(`${API}/dashboard/subjects`, { signal: ctrl.signal })
      .then((r) => setState({ data: r.success ? r.data : null, error: r.success ? null : r.message ?? "Could not load the dashboard", loading: false }))
      .catch((e: Error) => { if (!ctrl.signal.aborted) setState({ data: null, error: e.message, loading: false }); });
    return () => ctrl.abort();
  }, []);
  return state;
}

function useReport(url: string | null, nonce: number) {
  const [state, setState] = useState<Load<Report> & { url: string | null }>({ data: null, error: null, loading: true, url: null });
  useEffect(() => {
    if (!url) return;
    const ctrl = new AbortController();
    const hit = nonce === 0 ? cache.get(url) : undefined;
    queueMicrotask(() => {
      if (ctrl.signal.aborted) return;
      setState((s) => ({ data: hit ?? s.data, error: null, loading: !hit, url: hit ? url : s.url }));
    });
    if (hit) return () => ctrl.abort();
    apiJson<{ success: boolean; data: Report; message?: string }>(url, { signal: ctrl.signal })
      .then((r) => {
        if (ctrl.signal.aborted) return;
        if (r.success) cache.set(url, r.data);
        setState((s) => (r.success ? { data: r.data, error: null, loading: false, url } : { ...s, error: r.message ?? "Could not load the dashboard", loading: false }));
      })
      .catch((e: Error) => { if (!ctrl.signal.aborted) setState((s) => ({ ...s, error: e.message, loading: false })); });
    return () => ctrl.abort();
  }, [url, nonce]);
  return state;
}

export function Dashboard() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const subjects = useSubjects();
  const [nonce, setNonce] = useState(0);

  // A preset key, or a custom period written from..to (both days included).
  const rawRange = params.get("range");
  const customRange = rawRange ? CUSTOM_RANGE.exec(rawRange) : null;
  const range: string = customRange ? rawRange! : rawRange && (RANGE_KEYS as string[]).includes(rawRange) ? rawRange : "30d";
  const subject = params.get("subject") ?? subjects.data?.defaultSubject ?? null;
  const tab = params.get("tab");

  const setParams = useCallback((patch: Record<string, string | null>, push = false) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) if (v === null) next.delete(k); else next.set(k, v);
    const qs = next.toString();
    const href = qs ? `${pathname}?${qs}` : pathname;
    if (push) router.push(href, { scroll: false }); else router.replace(href, { scroll: false });
  }, [params, pathname, router]);

  const url = subject ? `${API}/dashboard?${new URLSearchParams({ subject, range, ...(tab ? { tab } : {}) })}` : null;
  const report = useReport(subjects.data ? url : null, nonce);
  const data = report.data;
  const visibleIds = useMemo(() => new Set(subjects.data?.people.map((p) => p.id) ?? []), [subjects.data]);

  const openSubject = useCallback((key: string) => {
    setParams({ subject: key, tab: null }, true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [setParams]);
  const canOpen = useCallback((id: number | undefined) => id !== undefined && visibleIds.has(id) && subjects.data?.scope !== "self", [visibleIds, subjects.data]);
  const openPerson = useCallback((id: number) => { if (canOpen(id)) openSubject(`user:${id}`); }, [openSubject, canOpen]);

  const [focusState, setFocusState] = useState<{ url: string | null; key: string | null }>({ url: null, key: null });
  const focus = focusState.url === report.url ? focusState.key : null;
  const setFocus = useCallback((key: string | null) => setFocusState({ url: report.url, key }), [report.url]);
  const trendKeys = useMemo(() => new Set(data?.sections.flatMap((s) => s.blocks.flatMap((b) => (b.kind === "trend" ? b.series.map((x) => x.key) : [])))), [data]);
  const [intro, setIntro] = useState(() => !introPlayed);
  const hasData = !!data;
  useEffect(() => {
    if (!intro || !hasData) return;
    introPlayed = true;
    const id = window.setTimeout(() => setIntro(false), INTRO_MS);
    return () => window.clearTimeout(id);
  }, [intro, hasData]);
  const ctx = useMemo(() => ({ openPerson, canOpen, focus, setFocus, trendKeys, intro }), [openPerson, canOpen, focus, setFocus, trendKeys, intro]);

  useCelebrations(data);

  if (subjects.error) return <ErrorState message={subjects.error} />;
  if (!subjects.data || (!data && !report.error)) return <DashboardSkeleton />;
  if (!data) return <ErrorState message={report.error ?? "Could not load the dashboard"} onRetry={() => setNonce((n) => n + 1)} />;

  const s = subjects.data;
  const controls = (
    <>
      {s.scope !== "self" && <SubjectPicker subjects={s} value={data.subject.key} onChange={openSubject} />}
      <PeriodPicker presets={RANGES} value={customRange ? "custom" : (range as Exclude<RangeKey, "custom">)} from={customRange?.[1]} to={customRange?.[2]}
        timeZone="Asia/Kolkata" note="Days are India time"
        onPreset={(r) => setParams({ range: r === "30d" ? null : r })}
        onRange={(from, to) => setParams({ range: `${from}..${to}` })} />
    </>
  );

  return (
    <DashContext.Provider value={ctx}>
      <PageActions>{controls}</PageActions>
      <div className={cn("dash-palette mx-auto w-full min-w-0 max-w-screen-2xl px-4 pb-16 pt-4 lg:px-0 lg:pt-0", intro && "dash-intro")}>
        <div className="space-y-4">
          <GettingStarted />
          <Crumbs report={data} subjects={s} onOpen={openSubject} />
          <div className="flex flex-wrap items-center gap-2 md:hidden">{controls}</div>
          <Tabs tabs={data.tabs} active={data.tab} onChange={(id) => setParams({ tab: id === data.tabs[0]?.id ? null : id })} />
        </div>
        <div className={cn("relative mt-8 space-y-12 transition-opacity duration-200", report.loading && "pointer-events-none opacity-60")} aria-busy={report.loading}>
          {report.loading && <div aria-hidden className="absolute -top-5 left-0 h-0.5 w-full overflow-hidden rounded-full bg-muted"><div className="h-full w-1/3 animate-[dash-load_1.1s_ease-in-out_infinite] rounded-full bg-[var(--series-1)]" /></div>}
          {report.error && <p className="rounded-lg border border-dashed px-4 py-3 text-[13px] text-muted-foreground">Could not refresh: {report.error}. Showing the last loaded view.</p>}
          {data.sections.map((sec) => <SectionView key={`${data.subject.key}-${data.tab}-${sec.id}`} section={sec} />)}
        </div>
      </div>
    </DashContext.Provider>
  );
}

/** Where a drill-down came from: Everyone › Department › person. Absent at the top level. */
function Crumbs({ report, subjects, onOpen }: { report: Report; subjects: Subjects; onOpen: (key: string) => void }) {
  const sub = report.subject;
  const crumbs: { key: string; label: string }[] = [];
  if (sub.kind !== "all" && subjects.scope === "organization") crumbs.push({ key: "all", label: "Everyone" });
  if (sub.kind === "person" && subjects.scope !== "self" && sub.person.departmentId !== null) {
    const d = subjects.departments.find((x) => x.id === sub.person.departmentId);
    if (d) crumbs.push({ key: `dept:${d.id}`, label: d.label });
  }
  if (!crumbs.length) return null;
  return (
    <nav aria-label="Dashboard level" className="flex items-center gap-1 text-[13px] text-muted-foreground">
      {crumbs.map((c) => (
        <span key={c.key} className="inline-flex items-center gap-1">
          <button type="button" onClick={() => onOpen(c.key)} className="rounded px-1 hover:bg-muted hover:text-foreground">{c.label}</button>
          <ChevronRight aria-hidden className="size-3.5" />
        </span>
      ))}
      <span className="px-1 text-foreground">{sub.label}</span>
    </nav>
  );
}

function Tabs({ tabs, active, onChange }: { tabs: Report["tabs"]; active: string; onChange: (id: string) => void }) {
  if (tabs.length < 2) return null;
  return (
    <div role="tablist" aria-label="Dashboard views" className="flex gap-6 overflow-x-auto border-b">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={t.id === active}
          onClick={() => onChange(t.id)}
          className={cn(
            "relative h-10 shrink-0 text-[14px] font-medium transition-colors",
            t.id === active ? "text-foreground after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:rounded-full after:bg-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

const SPAN: Record<Span, string> = {
  full: "md:col-span-2 lg:col-span-12",
  twoThirds: "md:col-span-2 lg:col-span-8",
  half: "md:col-span-2 lg:col-span-6",
  third: "md:col-span-1 lg:col-span-4",
};

function SectionView({ section }: { section: Section }) {
  const blocks = section.blocks;
  if (!blocks.length) return null;
  return (
    <section aria-labelledby={`sec-${section.id}`} className="animate-in fade-in-0 duration-300">
      <div className={cn("mb-4", section.hideHeader && "sr-only")}>
        <h2 id={`sec-${section.id}`} className="text-[15px] font-semibold text-foreground">{section.title}</h2>
        {section.description && <p className="mt-0.5 text-[13px] text-muted-foreground">{section.description}</p>}
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-12">
        {blocks.map((b, i) => (
          // Charts rise in after the metric tiles.
          <div key={b.id} className={cn("min-w-0", b.kind !== "kpis" && "dash-rise", SPAN[b.span ?? "full"])} style={{ "--i": 6 + i * 2 } as CSSProperties}>
            <BlockView block={b} />
          </div>
        ))}
      </div>
    </section>
  );
}

function BlockView({ block }: { block: Block }) {
  if (block.kind === "kpis") return <Kpis block={block} />;
  if (block.kind === "progress") return <Progress hero={block.hero} />;
  return (
    <article
      data-series={block.kind === "trend" ? block.series.map((s) => s.key).join(" ") : undefined}
      className="h-full rounded-xl border bg-card p-4 sm:p-5"
    >
      <header className="mb-4">
        <h3 className="text-[14px] font-semibold text-foreground">{block.title}</h3>
        {block.subtitle && <p className="mt-0.5 text-[12.5px] leading-snug text-muted-foreground">{block.subtitle}</p>}
      </header>
      <BlockBody block={block} />
    </article>
  );
}

/**
 * Charts that stop reading well when squeezed keep a minimum width and scroll
 * sideways inside their card, with a visible scrollbar, on narrow screens.
 */
function Wide({ min, children }: { min: number; children: ReactNode }) {
  return (
    <div className="table-scroll -mx-4 overflow-x-auto px-4 pb-1 sm:-mx-5 sm:px-5">
      <div style={{ minWidth: min }}>{children}</div>
    </div>
  );
}

function BlockBody({ block }: { block: Block }) {
  switch (block.kind) {
    case "trend": return <Wide min={560}><TrendChart block={block} /></Wide>;
    case "bars": return <BarList block={block} />;
    case "stacked": return <Wide min={480}><StackedBars block={block} /></Wide>;
    case "donut": return <Donut block={block} />;
    case "funnel": return <Funnel block={block} />;
    case "heatmap": return <Wide min={block.cols.length > 16 ? 680 : 480}><Heatmap block={block} /></Wide>;
    case "scatter": return <Wide min={440}><Scatter block={block} /></Wide>;
    case "radar": return <Radar block={block} />;
    case "leaderboard": return <Leaderboard block={block} />;
    case "insights": return <Insights block={block} />;
    case "queue": return <Queue block={block} />;
    case "targets": return <Targets block={block} />;
    case "table": return <MetricTable block={block} />;
    default: return null;
  }
}

/** Fire confetti once for each newly unlocked achievement, then tell the server they were seen. */
function useCelebrations(report: Report | null) {
  const fired = useRef(new Set<string>());
  useEffect(() => {
    if (!report) return;
    const fresh = report.sections
      .flatMap((s) => s.blocks)
      .flatMap((b) => (b.kind === "progress" ? b.hero.achievements : []))
      .filter((a) => a.celebrate && !fired.current.has(`${a.key}:${a.period}`));
    if (!fresh.length) return;
    for (const a of fresh) fired.current.add(`${a.key}:${a.period}`);
    const t = setTimeout(() => {
      confetti();
      for (const a of fresh) toast.success(a.title, { description: a.detail });
    }, 400);
    void apiFetch(`${API}/dashboard/achievements/seen`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: fresh.map((a) => ({ key: a.key, period: a.period })) }),
    }).then(() => cache.clear()).catch(() => {});
    return () => clearTimeout(t);
  }, [report]);
}

function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="mx-auto mt-16 max-w-md rounded-xl border bg-card p-6 text-center">
      <p className="text-[14px] font-medium">The dashboard could not load</p>
      <p className="mt-1 text-[13px] text-muted-foreground">{message}</p>
      {onRetry && <button type="button" onClick={onRetry} className="mt-4 h-8 rounded-md bg-foreground px-3 text-[13px] font-medium text-background">Try again</button>}
    </div>
  );
}
