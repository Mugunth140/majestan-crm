"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight, RefreshCw } from "lucide-react";
import { PageActions } from "@/components/layout/page-actions";
import { SearchableFormSelect } from "@/components/shared/form-select";
import { apiFetch } from "@/lib/api-fetch";
import { cn } from "@/lib/utils";
import { DashboardPanel, DashboardSection } from "./DashboardPanels";
import { MetricCard } from "./MetricCard";

type Scope = "organization" | "department" | "self";
type Person = { id: number; name: string; department: string | null };
type Pipeline = { open: number; overdue: number; dueToday: number; unscheduled: number; untouched: number; rnr: number };
type Activity = { calls: number; messages: number; whatsapp: number; email: number; sms: number; followUps: number; visits: number; wins: number };
type Counts = Pipeline & Activity;
type Day = Activity & { day: string };
type Report = {
  scope: Scope;
  selected: Person | null;
  from: string;
  to: string;
  syncedAt: string | null;
  summary: Counts;
  staff: (Person & Counts)[];
  trend: Day[];
  targets: { id: number; ownerId: number; label: string; target: number; achieved: number; unit: string }[];
  queue: { id: number; name: string; ownerId: number; due: string | null; reason: string }[];
};

const number = (value: number) => value.toLocaleString("en-IN");
const shortDate = (date: string) =>
  new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(date));
const coverage = (row: Pick<Pipeline, "open" | "untouched">) => row.open ? `${Math.round((row.open - row.untouched) / row.open * 100)}%` : "—";
const activityChannels = [
  { key: "calls", name: "Calls", color: "bg-emerald-700 dark:bg-emerald-400" },
  { key: "messages", name: "Messages", color: "bg-sky-700 dark:bg-sky-400" },
  { key: "followUps", name: "Follow-ups", color: "bg-amber-600 dark:bg-amber-400" },
] as const;
const outcomeChannels = [
  { key: "visits", name: "Visit events", color: "bg-emerald-700 dark:bg-emerald-400" },
  { key: "wins", name: "Closed won events", color: "bg-sky-700 dark:bg-sky-400" },
] as const;

async function getData<T>(path: string, signal: AbortSignal): Promise<T> {
  const response = await apiFetch(`/api/v1/metrics/${path}`, { signal });
  if (!response.ok) throw new Error("Dashboard request failed");
  return (await response.json()).data;
}

export function CoachingDashboard({ role, legacy }: { role?: string; legacy: ReactNode }) {
  const [roster, setRoster] = useState<{ scope: Scope; people: Person[] } | null>(null);
  const [person, setPerson] = useState("");
  const [days, setDays] = useState("30");
  const [revision, setRevision] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [showLegacy, setShowLegacy] = useState(false);
  const [result, setResult] = useState<{ key: string; data: Report | null } | null>(null);
  const key = `${person}:${days}:${revision}`;
  const report = result?.key === key ? result.data : null;
  const loading = result?.key !== key;

  useEffect(() => {
    const controller = new AbortController();
    getData<{ scope: Scope; people: Person[] }>("coaching/people", controller.signal)
      .then(setRoster, () => {});
    return () => controller.abort();
  }, [revision]);

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({ days });
    if (person) query.set("person", person);
    getData<Report>(`coaching?${query}`, controller.signal)
      .then(
        data => { if (!controller.signal.aborted) setResult({ key, data }); },
        () => { if (!controller.signal.aborted) setResult({ key, data: null }); },
      );
    return () => controller.abort();
  }, [days, key, person]);

  const refresh = async () => {
    setRefreshing(true);
    try { await apiFetch("/api/v1/metrics/cache", { method: "DELETE" }); }
    finally {
      setRevision(value => value + 1);
      setRefreshing(false);
    }
  };

  const selectPerson = (value: string) => {
    setShowLegacy(false);
    setPerson(value);
  };

  const scope = report?.scope ?? roster?.scope;
  const groupLabel = scope === "department" ? "My department" : "All staff";
  const options = [
    { value: "", label: groupLabel },
    ...(roster?.people ?? []).map(p => ({
      value: String(p.id), label: p.department ? `${p.name} · ${p.department}` : p.name,
    })),
  ];
  const controls = (placement: string) => (
    <>
      {roster && roster.scope !== "self" && (
        <>
          <label htmlFor={`coaching-person-${placement}`} className="sr-only">Staff member</label>
          <SearchableFormSelect id={`coaching-person-${placement}`} name="person" value={person}
            options={options} placeholder={groupLabel} searchPlaceholder="Search staff"
            className="h-8! w-44 max-w-full rounded-md bg-card text-sm" onValueChange={selectPerson} />
        </>
      )}
      <label className="flex min-w-0 items-center">
        <span className="sr-only">Activity period</span>
        <select className="h-8 rounded-md border bg-card px-2 text-sm focus-visible:outline-2 focus-visible:outline-ring" value={days} onChange={event => setDays(event.target.value)}>
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
        </select>
      </label>
      <button type="button" aria-label="Refresh dashboard" title="Refresh dashboard" disabled={refreshing || loading} onClick={() => void refresh().catch(() => {})}
        className="grid size-8 shrink-0 place-items-center rounded-md border bg-card hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50">
        <RefreshCw aria-hidden className={cn("size-4", refreshing && "motion-safe:animate-spin")} />
      </button>
    </>
  );

  const title = report?.selected?.name ?? (scope === "self" || role === "Staff"
    ? "My work queue" : scope === "department" || role === "Team Lead"
      ? "Department coaching" : role === "Manager" ? "Staff coaching" : "Organization coaching");

  return (
    <div className="min-w-0 space-y-6">
      <PageActions>{controls("desktop")}</PageActions>
      <div className="flex flex-wrap items-center gap-2 md:hidden">{controls("phone")}</div>
      {loading ? (
        <DashboardSection title={title} context="Loading analytics">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {["Open leads", "Overdue follow-ups", "Due today", "Owner coverage"].map(label => <MetricCard key={label} label={label} value="—" loading />)}
          </div>
        </DashboardSection>
      ) : report ? (
        <CoachingReport report={report} title={title} role={role} onSelect={id => selectPerson(String(id))} />
      ) : (
        <div role="alert" className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">Analytics could not load. Use Refresh to try again.</div>
      )}
      {!person && (
        <details className="hidden rounded-lg border bg-card p-4 md:block" onToggle={event => setShowLegacy(event.currentTarget.open)}>
          <summary className="cursor-pointer text-sm font-medium">{role === "Staff" ? "Task progress and milestones" : role === "Team Lead" ? "Additional team metrics" : "Operations and pipeline metrics"}</summary>
          {showLegacy && <div className="mt-4" key={revision}>{legacy}</div>}
        </details>
      )}
    </div>
  );
}

function CoachingReport({ report, title, role, onSelect }: { report: Report; title: string; role?: string; onSelect: (id: number) => void }) {
  const { summary: m, from, to, selected, staff, queue } = report;
  const team = report.scope !== "self" && !selected;
  const names = new Map(staff.map(person => [person.id, person.name]));
  const attention = [
    { label: "Overdue follow-ups", count: m.overdue, detail: "Start with the oldest scheduled callbacks.", color: "text-red-700 dark:text-red-400" },
    { label: "No next follow-up", count: m.unscheduled, detail: "Set a next step for active leads without one.", color: "text-amber-700 dark:text-amber-400" },
    { label: "3+ unanswered attempts", count: m.rnr, detail: "Review the contact channel or try a different time.", color: "text-amber-700 dark:text-amber-400" },
    { label: "No recent owner activity", count: m.untouched, detail: "Review leads with no owner contact log or follow-up in the selected period.", color: "text-muted-foreground" },
  ];

  const staffBreakdown = (
    <DashboardSection title={report.scope === "department" ? "Department staff" : "Staff breakdown"} context="Sorted by overdue work">
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full min-w-max text-left text-sm">
          <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
            <tr>{["Staff member", "Open", "Overdue", "No next step", "Coverage", "Calls", "Follow-ups", "Visit events"].map(label => <th key={label} scope="col" className="px-4 py-2 font-medium">{label}</th>)}</tr>
          </thead>
          <tbody className="divide-y">
            {staff.map(row => (
              <tr key={row.id} className="hover:bg-muted/30">
                <th scope="row" className="px-4 py-2 text-left font-medium">
                  <button type="button" className="rounded-sm text-left hover:underline focus-visible:outline-2 focus-visible:outline-ring" onClick={() => onSelect(row.id)}>{row.name}</button>
                  {row.department && <span className="block text-xs font-normal text-muted-foreground">{row.department}</span>}
                </th>
                {[row.open, row.overdue, row.unscheduled, coverage(row), row.calls, row.followUps, row.visits].map((value, index) => <td key={index} className="px-4 py-2 tabular-nums">{typeof value === "number" ? number(value) : value}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
        {!staff.length && <p className="p-4 text-sm text-muted-foreground">No active staff in this scope.</p>}
      </div>
    </DashboardSection>
  );
  const departments = new Map<string, { open: number; overdue: number; untouched: number }>();
  for (const row of staff) {
    const name = row.department ?? "No department";
    const group = departments.get(name) ?? { open: 0, overdue: 0, untouched: 0 };
    departments.set(name, { open: group.open + row.open, overdue: group.overdue + row.overdue, untouched: group.untouched + row.untouched });
  }

  return (
    <>
      <DashboardSection title={title} context={selected?.department ?? "Current lead portfolio"}>
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <MetricCard label="Open leads" value={m.open} />
          <MetricCard label="Overdue follow-ups" value={m.overdue} className={m.overdue ? "border-red-200 dark:border-red-900" : undefined} />
          <MetricCard label="Due today" value={m.dueToday} />
          <MetricCard label="Owner coverage" value={coverage(m)} subtitle={`${number(m.open - m.untouched)} of ${number(m.open)} open leads touched in period`} />
        </div>
      </DashboardSection>

      {team && role === "Manager" && staffBreakdown}
      {team && (role === "Admin" || role === "Super Admin") && departments.size > 0 && (
        <DashboardSection title="Department workload" context="Current portfolio">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {[...departments].sort((a, b) => b[1].overdue - a[1].overdue).map(([name, row]) => (
              <div key={name} className="min-w-0 rounded-lg border bg-card px-4 py-3">
                <h3 className="text-sm font-medium">{name}</h3>
                <p className="mt-1 text-sm tabular-nums text-muted-foreground">
                  {number(row.open)} open · {number(row.overdue)} overdue · {coverage(row)} coverage
                </p>
              </div>
            ))}
          </div>
        </DashboardSection>
      )}

      <div className="grid items-start gap-3 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <DashboardPanel title={team ? "Where to coach" : "Where to focus"}>
          <ul className="divide-y">
            {attention.map(item => (
              <li key={item.label} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                <span className={cn("min-w-8 text-lg font-semibold tabular-nums", item.count > 0 && item.color)}>{number(item.count)}</span>
                <div><div className="text-sm font-medium">{item.label}</div><p className="mt-1 text-xs text-muted-foreground">{item.detail}</p></div>
              </li>
            ))}
          </ul>
        </DashboardPanel>
        <DashboardPanel title="Leads to review">
          {queue.length ? (
            <ul className="max-h-72 divide-y overflow-y-auto">
              {queue.map(lead => (
                <li key={lead.id}>
                  <Link href={`/leads/${lead.id}`} className="flex items-center justify-between gap-3 rounded-sm px-1 py-2 text-sm hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-ring">
                    <div className="min-w-0">
                      <span className="block truncate font-medium">{lead.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {lead.reason}{team ? ` · ${names.get(lead.ownerId) ?? "Staff"}` : ""}
                      </span>
                    </div>
                    <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                      {lead.due && shortDate(lead.due)} <ArrowUpRight aria-hidden className="size-3.5" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : <p className="py-4 text-sm text-muted-foreground">No leads match the review flags.</p>}
        </DashboardPanel>
      </div>

      {team && role !== "Manager" && staffBreakdown}

      <DashboardSection title="Assigned task targets" context={new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(to))}>
        <div className="rounded-lg border bg-card px-4 py-3">
          {report.targets.length ? (
            <>
              <p className="text-sm font-medium">{number(report.targets.filter(t => t.achieved >= t.target).length)} of {number(report.targets.length)} targets met</p>
              <ul className="mt-2 max-h-72 divide-y overflow-y-auto">
                {report.targets.map(target => (
                  <li key={target.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 py-2 text-sm">
                    <span>{target.label}{team && <span className="block text-xs text-muted-foreground">{names.get(target.ownerId)}</span>}</span>
                    <span className="text-right tabular-nums">
                      {number(target.achieved)} / {number(target.target)}
                      <span className="block text-xs text-muted-foreground">{target.achieved >= target.target ? "Met" : `${number(target.target - target.achieved)} remaining`}</span>
                    </span>
                    <progress className="col-span-2 h-1 w-full appearance-none overflow-hidden rounded-full [&::-moz-progress-bar]:bg-emerald-600 [&::-webkit-progress-bar]:bg-muted [&::-webkit-progress-value]:bg-emerald-600" aria-label={target.label} max={target.target} value={Math.min(target.achieved, target.target)} />
                  </li>
                ))}
              </ul>
            </>
          ) : <p className="text-sm text-muted-foreground">No monthly targets assigned in this scope.</p>}
        </div>
      </DashboardSection>

      <DashboardSection title="Activity and outcomes" context={`${shortDate(from)} to ${shortDate(to)}`}>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <MetricCard label="Calls logged" value={m.calls} />
          <MetricCard label="Messages logged" value={m.messages} subtitle={`${number(m.whatsapp ?? 0)} WhatsApp · ${number(m.email ?? 0)} email · ${number(m.sms ?? 0)} SMS`} />
          <MetricCard label="Lead follow-ups logged" value={m.followUps} />
          <MetricCard label="Visit events" value={m.visits} />
          <MetricCard label="Closed won events" value={m.wins} />
        </div>
        <DashboardPanel title="Daily trends"><ActivityChart days={report.trend} /></DashboardPanel>
        <p className="text-xs text-muted-foreground">
          Portfolio counts follow current ownership. Activity and stage events follow the person who logged them. Calls and messages include all CRM modules.
          {report.syncedAt && ` Data synced ${new Date(report.syncedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST.`}
        </p>
      </DashboardSection>
    </>
  );
}

function ActivityChart({ days }: { days: Day[] }) {
  const [mode, setMode] = useState<"activity" | "outcomes">("activity");
  const channels = mode === "activity" ? activityChannels : outcomeChannels;
  const total = (day: Day) => channels.reduce((sum, channel) => sum + day[channel.key], 0);
  const max = Math.max(0, ...days.map(total));
  const describe = (day: Day) => `${shortDate(day.day)} · ${channels.map(channel => `${day[channel.key]} ${channel.name.toLowerCase()}`).join(" · ")}`;

  return (
    <div className="space-y-3">
      <div className="inline-flex gap-1 rounded-md border bg-muted/40 p-1" aria-label="Chart metric">
        {(["activity", "outcomes"] as const).map(item => (
          <button key={item} type="button" aria-pressed={mode === item} onClick={() => setMode(item)}
            className={cn("rounded-sm px-2 py-1 text-xs font-medium capitalize focus-visible:outline-2 focus-visible:outline-ring", mode === item ? "bg-card text-foreground" : "text-muted-foreground hover:text-foreground")}>{item}</button>
        ))}
      </div>
      {!max ? <p className="py-6 text-center text-sm text-muted-foreground">No {mode === "activity" ? "activity" : "visit or win events"} logged in this period.</p> : <>
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          {channels.map(channel => <span key={channel.key} className="inline-flex items-center gap-2"><span aria-hidden className={cn("size-2 rounded-full", channel.color)} />{channel.name}</span>)}
        </div>
        <div aria-hidden className="flex h-32 items-end gap-px border-b sm:gap-1">
          {days.map(day => (
            <div key={day.day} className="flex h-full min-w-0 flex-1 flex-col-reverse" title={describe(day)}>
              {channels.map(channel => <div key={channel.key} className={channel.color} style={{ height: `${day[channel.key] / max * 100}%` }} />)}
            </div>
          ))}
        </div>
        <div className="flex justify-between text-xs text-muted-foreground"><span>{shortDate(days[0].day)}</span><span>{shortDate(days.at(-1)!.day)}</span></div>
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer">View daily counts</summary>
          <ul className="mt-2 max-h-48 divide-y overflow-y-auto">
            {days.map(day => <li key={day.day} className="py-1">{describe(day)}</li>)}
          </ul>
        </details>
      </>}
    </div>
  );
}
