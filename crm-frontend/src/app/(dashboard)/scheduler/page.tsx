"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { apiFetch } from "@/lib/api-fetch";
import { cn } from "@/lib/utils";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { DataTable } from "@/components/tables/data-table";
import { TableSkeleton } from "@/components/tables/table-skeleton";
import { IdCell, NameCell, StatusCell } from "@/components/tables/cells";
import { EmptyState } from "@/components/shared/empty-state";
import { MobileHeader } from "@/components/layout/mobile-header";
import {
  ListBody,
  ListFrame,
  ToolbarClear,
  ToolbarSelect,
} from "@/components/layout/list-page";
import { ACTION_FILTERS, type ActionFilter } from "@/lib/action-filters";
import {
  SCHEDULE_MODULES,
  SCHEDULE_VIEWS,
  agentItem,
  candidateItem,
  formatWhen,
  inView,
  inboundItem,
  isDoneView,
  leadItem,
  sortItems,
  viewKey,
  type ScheduleItem,
  type ScheduleMode,
  type ScheduleModule,
  type ScheduleView,
} from "@/lib/scheduler";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";
// Leads are paged on the server; one view rarely holds more than this.
const LEAD_LIMIT = 500;

/** Each bucket as a tile: what it holds; Overdue's count turns red. */
const BUCKETS: Record<
  ActionFilter,
  { label: string; hint: string; count?: string }
> = {
  Overdue: {
    label: "Overdue",
    hint: "Past their date",
    count: "text-rose-600 dark:text-rose-400",
  },
  Yesterday: { label: "Yesterday", hint: "Followed up" },
  Today: { label: "Today", hint: "Due today" },
  Tomorrow: { label: "Tomorrow", hint: "Due tomorrow" },
  "All Scheduled": { label: "Later", hint: "After tomorrow" },
};

// ToolbarSelect needs a value for "no filter".
const ALL = "all";

type Filters = { module: "" | ScheduleModule; staff: string; status: string };
const NO_FILTERS: Filters = { module: "", staff: "", status: "" };

/* eslint-disable @typescript-eslint/no-explicit-any -- module lists arrive as loose API JSON */

async function getJson(path: string) {
  const res = await apiFetch(API_URL + path);
  if (!res.ok) return null;
  return res.json();
}
const safe = (path: string) => getJson(path).catch(() => null);

function leadQuery(view: ScheduleView, limit: number, filters: Filters) {
  const params = new URLSearchParams({
    page: "1",
    limit: String(limit),
    tab: "Action Required",
    actionFilter: view.bucket,
    todayViewMode: view.mode,
  });
  if (filters.staff) params.set("staff", filters.staff);
  if (filters.status) params.set("status", filters.status);
  return `/leads?${params}`;
}

/** The signed-in user as this page needs them. */
function readViewer() {
  try {
    const u = JSON.parse(localStorage.getItem("crm_user") || "null");
    return {
      id: Number(u?.id) || 0,
      role: String(u?.role?.name ?? u?.role ?? ""),
      department: String(u?.department?.name ?? u?.department ?? ""),
    };
  } catch {
    return { id: 0, role: "", department: "" };
  }
}

export default function SchedulerPage() {
  const router = useRouter();
  const [bucket, setBucket] = usePersistedState<ActionFilter>(
    "scheduler:bucket",
    "Today",
    { allowed: ACTION_FILTERS },
  );
  const [mode, setMode] = usePersistedState<ScheduleMode>(
    "scheduler:mode",
    "pending",
    { allowed: ["pending", "completed"] },
  );
  const [filters, setFilters] = usePersistedState<Filters>(
    "scheduler:filters",
    NO_FILTERS,
  );
  const [viewer, setViewer] = useState({ id: 0, role: "", department: "" });
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is client-only
    setViewer(readViewer());
  }, []);
  const seesAll = ["Admin", "Super Admin", "Manager"].includes(viewer.role);
  const picksStaff = seesAll || viewer.role === "Team Lead";

  // Inbound, agents and HR come as whole lists and are bucketed here; leads
  // are bucketed by the server, so we keep its count per view and the rows of the open one.
  const [records, setRecords] = useState<
    Record<Exclude<ScheduleModule, "lead">, any[]>
  >({ inbound: [], agent: [], hr: [] });
  const [leadCounts, setLeadCounts] = useState<Record<string, number>>({});
  const [leadOptions, setLeadOptions] = useState<{
    staff: string[];
    statuses: string[];
  }>({ staff: [], statuses: [] });
  const view: ScheduleView = {
    bucket,
    mode: bucket === "Today" ? mode : "pending",
  };
  const key = viewKey(view);
  const leadsShown = !filters.module || filters.module === "lead";
  const leadFilterKey = `${filters.staff}|${filters.status}`;

  useEffect(() => {
    let live = true;
    (async () => {
      const [inbounds, agents, candidates] = await Promise.all([
        safe("/inbounds"),
        safe("/agents"),
        safe("/hr"),
      ]);
      if (!live) return;
      const list = (data: any) =>
        Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
      setRecords({
        inbound: list(inbounds).filter((r: any) => !r.is_queued),
        agent: list(agents),
        hr: list(candidates),
      });
    })();
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    let live = true;
    (async () => {
      const counts = await Promise.all(
        SCHEDULE_VIEWS.map((v) => safe(leadQuery(v, 1, filters))),
      );
      if (!live) return;
      setLeadCounts(
        Object.fromEntries(
          SCHEDULE_VIEWS.map((v, i) => [
            viewKey(v),
            counts[i]?.meta?.total ?? 0,
          ]),
        ),
      );
      const options = counts.find((c) => c?.meta?.filterOptions)?.meta
        .filterOptions;
      if (options)
        setLeadOptions({
          staff: options.staff ?? [],
          statuses: options.statuses ?? [],
        });
    })();
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `leadFilterKey` names the filters
  }, [leadFilterKey]);

  // The open view's leads, tagged with the request they answer, so a stale view shows as loading.
  const [leads, setLeads] = useState<{ request: string; rows: ScheduleItem[] }>(
    { request: "", rows: [] },
  );
  const request = `${key}#${leadFilterKey}`;
  const loading = leads.request !== request;
  useEffect(() => {
    let live = true;
    safe(leadQuery(view, LEAD_LIMIT, filters)).then((data) => {
      if (live) setLeads({ request, rows: (data?.data ?? []).map(leadItem) });
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `request` names the view and filters
  }, [request]);

  // Staff and team leads see their own work: the server already narrows
  // leads, inbound and agents; HR lists every candidate, so keep HR
  // follow-ups to the HR department and to candidates assigned to them.
  const ownHr = useCallback(
    (c: any) =>
      seesAll ||
      /\bhr\b/i.test(viewer.department) ||
      Number(c.assignedStaff?.id) === viewer.id,
    [seesAll, viewer],
  );

  const matches = useCallback(
    (i: ScheduleItem) =>
      (!filters.module || i.module === filters.module) &&
      (!filters.staff || i.staff === filters.staff) &&
      (!filters.status || i.status === filters.status),
    [filters],
  );

  const othersFor = useCallback(
    (v: ScheduleView): ScheduleItem[] =>
      [
        ...records.inbound
          .filter((r) => inView("inbound", r, v))
          .map(inboundItem),
        ...records.agent.filter((r) => inView("agent", r, v)).map(agentItem),
        ...records.hr
          .filter((r) => ownHr(r) && inView("hr", r, v))
          .map(candidateItem),
      ].filter(matches),
    [records, ownHr, matches],
  );

  const counts = useMemo(
    () =>
      Object.fromEntries(
        SCHEDULE_VIEWS.map((v) => [
          viewKey(v),
          (leadsShown ? (leadCounts[viewKey(v)] ?? 0) : 0) +
            othersFor(v).length,
        ]),
      ),
    [othersFor, leadCounts, leadsShown],
  );
  const countOf = (v: ScheduleView) => counts[viewKey(v)] ?? 0;

  const done = isDoneView(view);
  const rows = useMemo(
    () =>
      sortItems([...(leadsShown ? leads.rows : []), ...othersFor(view)], done),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` names the view
    [leads.rows, leadsShown, othersFor, key, done],
  );

  // Filter choices: what's in the lists this user can see.
  const options = useMemo(() => {
    const all = [
      ...records.inbound.map(inboundItem),
      ...records.agent.map(agentItem),
      ...records.hr.filter(ownHr).map(candidateItem),
    ];
    const uniq = (values: string[]) =>
      [...new Set(values.filter((v) => v && v !== "Unassigned"))].sort();
    return {
      staff: uniq([...leadOptions.staff, ...all.map((i) => i.staff)]),
      statuses: uniq([...leadOptions.statuses, ...all.map((i) => i.status)]),
    };
  }, [records, ownHr, leadOptions]);

  const activeFilters =
    (seesAll && filters.module ? 1 : 0) +
    (picksStaff && filters.staff ? 1 : 0) +
    (filters.status ? 1 : 0);
  const setFilter = (patch: Partial<Filters>) =>
    setFilters((f) => ({ ...f, ...patch }));

  const columns: ColumnDef<ScheduleItem>[] = [
    {
      id: "when",
      header: done ? "Followed up" : "Follow-up",
      cell: ({ row }) => {
        const i = row.original;
        return (
          <span
            className={cn(
              "whitespace-nowrap tabular-nums",
              !done &&
                bucket === "Overdue" &&
                "text-rose-600 dark:text-rose-400",
            )}
          >
            {done
              ? formatWhen(i.doneDate, i.doneTime)
              : formatWhen(i.nextDate, i.nextTime)}
          </span>
        );
      },
    },
    {
      id: "module",
      header: "Module",
      cell: ({ row }) => {
        const m = SCHEDULE_MODULES.find(
          (x) => x.value === row.original.module,
        )!;
        return (
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-muted-foreground">
            <span className={cn("size-1.5 rounded-full", m.dot)} />
            {m.label}
          </span>
        );
      },
    },
    {
      id: "code",
      header: "ID",
      cell: ({ row }) => (
        <IdCell href={row.original.href}>{row.original.code}</IdCell>
      ),
    },
    {
      id: "name",
      header: "Name",
      cell: ({ row }) => <NameCell name={row.original.name} avatar />,
    },
    {
      id: "mobile",
      header: "Mobile",
      cell: ({ row }) => (
        <span className="tabular-nums">{row.original.mobile || "—"}</span>
      ),
    },
    {
      id: "staff",
      header: "Assigned staff",
      cell: ({ row }) => row.original.staff,
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => <StatusCell status={row.original.status} />,
    },
    {
      id: "priority",
      header: "Priority",
      cell: ({ row }) =>
        row.original.priority || (
          <span className="text-muted-foreground">—</span>
        ),
    },
  ];

  const empty = (
    <EmptyState
      className="sticky left-0"
      kind={done ? "inbox" : "tasks"}
      title={
        done
          ? "No follow-ups logged"
          : bucket === "Overdue"
            ? "Nothing overdue"
            : "Nothing scheduled"
      }
      description={
        activeFilters
          ? "Try clearing a filter."
          : done
            ? "Follow-ups made on this day will show up here."
            : bucket === "Overdue"
              ? "Every follow-up is on track."
              : "Follow-ups scheduled for this day will show up here."
      }
    />
  );

  const filterBar = (
    <>
      {seesAll && (
        <ToolbarSelect
          label="Module"
          closeOnSelect
          value={filters.module || ALL}
          onChange={(v) =>
            setFilter({ module: v === ALL ? "" : (v as ScheduleModule) })
          }
          options={[
            { value: ALL, label: "All" },
            ...SCHEDULE_MODULES.map((m) => ({
              value: m.value,
              label: m.label,
            })),
          ]}
        />
      )}
      {picksStaff && (
        <ToolbarSelect
          label="Staff"
          closeOnSelect
          value={filters.staff || ALL}
          onChange={(v) => setFilter({ staff: v === ALL ? "" : v })}
          options={[
            { value: ALL, label: "Anyone" },
            ...options.staff.map((s) => ({ value: s, label: s })),
          ]}
        />
      )}
      <ToolbarSelect
        label="Status"
        closeOnSelect
        value={filters.status || ALL}
        onChange={(v) => setFilter({ status: v === ALL ? "" : v })}
        options={[
          { value: ALL, label: "Any" },
          ...options.statuses.map((s) => ({ value: s, label: s })),
        ]}
      />
    </>
  );

  return (
    <>
      <MobileHeader title="Scheduler" />
      <div className="flex flex-col md:h-full">
        <ListFrame>
          {/* When: one tile per bucket, with how many are in it */}
          <div className="flex gap-2 overflow-x-auto px-4 pt-3 scrollbar-hide md:grid md:grid-cols-5 md:px-5">
            {ACTION_FILTERS.map((b) => {
              const meta = BUCKETS[b];
              const active = bucket === b;
              const n = countOf({ bucket: b, mode: "pending" });
              return (
                <button
                  key={b}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setBucket(b)}
                  className={cn(
                    "min-w-[128px] flex-1 rounded-lg border px-3 py-2.5 text-left transition-[border-color,background-color,box-shadow]",
                    active
                      ? "border-foreground/25 bg-background shadow-[0_1px_2px_rgba(0,0,0,0.06)] dark:border-white/25 dark:bg-white/[0.06]"
                      : "border-border/70 bg-muted/30 hover:border-border hover:bg-muted/60",
                  )}
                >
                  <span className="block text-[12px] font-medium text-muted-foreground">
                    {meta.label}
                  </span>
                  <span
                    className={cn(
                      "mt-1 block text-[22px] font-semibold leading-7 tabular-nums text-foreground",
                      n > 0 && meta.count,
                    )}
                  >
                    {n}
                  </span>
                  <span className="block text-[12px] text-muted-foreground">
                    {b === "Today"
                      ? `${countOf({ bucket: b, mode: "completed" })} followed up`
                      : meta.hint}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Under the tiles: Today's to-do / done split, and the filters */}
          <div className="flex min-h-11 items-end gap-2 border-b px-4 pt-2 md:px-5">
            {bucket === "Today" ? (
              <div role="tablist" aria-label="Today" className="flex gap-5">
                {(["pending", "completed"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="tab"
                    aria-selected={mode === m}
                    onClick={() => setMode(m)}
                    className={cn(
                      "-mb-px border-b-2 pb-2 text-[13px] transition-colors",
                      mode === m
                        ? "border-foreground font-medium text-foreground"
                        : "border-transparent text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {m === "pending" ? "To follow up" : "Followed up"}
                    <span className="ml-1.5 tabular-nums text-muted-foreground">
                      {countOf({ bucket: "Today", mode: m })}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="pb-2 text-[13px] font-medium text-foreground">
                {BUCKETS[bucket].label}
                <span className="ml-1.5 font-normal text-muted-foreground">
                  {BUCKETS[bucket].hint.toLowerCase()}
                </span>
              </p>
            )}
            <div className="mb-1.5 ml-auto flex flex-wrap items-center justify-end gap-1.5">
              {filterBar}
              {activeFilters > 0 && (
                <ToolbarClear
                  onClick={() => setFilters(NO_FILTERS)}
                  title="Clear filters"
                />
              )}
            </div>
          </div>

          <ListBody>
            {loading ? (
              <div className="px-5 pt-3">
                <TableSkeleton columns={7} rows={6} />
              </div>
            ) : (
              <div className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden">
                <DataTable
                  variant="list"
                  columns={columns}
                  data={rows}
                  onRowClick={(i) => router.push(i.href)}
                  emptyState={empty}
                  persistKey={false}
                />
              </div>
            )}
          </ListBody>
        </ListFrame>
      </div>
    </>
  );
}
