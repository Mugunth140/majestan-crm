"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { RefreshCw } from "lucide-react";
import { apiFetch } from "@/lib/api-fetch";
import { cn } from "@/lib/utils";
import { useDebounce } from "@/hooks/use-debounce";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { DataTable } from "@/components/tables/data-table";
import { TableSkeleton } from "@/components/tables/table-skeleton";
import { IdCell, NameCell, StatusCell } from "@/components/tables/cells";
import { MobileHeader } from "@/components/layout/mobile-header";
import { PageActions } from "@/components/layout/page-actions";
import { ListBody, ListFrame, ListToolbar, SegmentTabs, ToolbarEnd, ToolbarSearch, headerButtonClass } from "@/components/layout/list-page";
import { ACTION_FILTERS, getActionFilterLabel, type ActionFilter } from "@/lib/action-filters";
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

type ModuleFilter = "all" | ScheduleModule;

/* eslint-disable @typescript-eslint/no-explicit-any -- module lists arrive as loose API JSON */

async function getJson(path: string) {
  const res = await apiFetch(API_URL + path);
  if (!res.ok) return null;
  return res.json();
}

const leadQuery = (view: ScheduleView, limit: number) =>
  `/leads?${new URLSearchParams({ page: "1", limit: String(limit), tab: "Action Required", actionFilter: view.bucket, todayViewMode: view.mode })}`;

export default function SchedulerPage() {
  const router = useRouter();
  const [bucket, setBucket] = usePersistedState<ActionFilter>("scheduler:bucket", "Today", { allowed: ACTION_FILTERS });
  const [mode, setMode] = usePersistedState<ScheduleMode>("scheduler:mode", "pending", { allowed: ["pending", "completed"] });
  const [moduleFilter, setModuleFilter] = usePersistedState<ModuleFilter>("scheduler:module", "all", {
    allowed: ["all", ...SCHEDULE_MODULES.map((m) => m.value)],
  });
  const [search, setSearch] = useState("");
  const query = useDebounce(search, 250);

  // Inbound, agents and HR come as whole lists and are bucketed here; leads
  // are bucketed by the server, so we keep its count per view and the rows of the open one.
  const [records, setRecords] = useState<Record<Exclude<ScheduleModule, "lead">, any[]>>({ inbound: [], agent: [], hr: [] });
  const [leadCounts, setLeadCounts] = useState<Record<string, number>>({});
  const [reloadKey, setReloadKey] = useState(0);
  const view: ScheduleView = { bucket, mode: bucket === "Today" ? mode : "pending" };
  const key = viewKey(view);
  // The open view's leads, tagged with the request they answer, so a stale view shows as loading.
  const [leads, setLeads] = useState<{ request: string; rows: ScheduleItem[] }>({ request: "", rows: [] });
  const request = `${key}#${reloadKey}`;
  const loading = leads.request !== request;
  const leadRows = leads.rows;

  useEffect(() => {
    let live = true;
    (async () => {
      // A module the user can't open (or a failed request) just contributes nothing.
      const safe = (path: string) => getJson(path).catch(() => null);
      const [inbounds, agents, candidates, ...counts] = await Promise.all([
        safe("/inbounds"),
        safe("/agents"),
        safe("/hr"),
        ...SCHEDULE_VIEWS.map((v) => safe(leadQuery(v, 1))),
      ]);
      if (!live) return;
      const list = (data: any) => (Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : []);
      setRecords({ inbound: list(inbounds).filter((r: any) => !r.is_queued), agent: list(agents), hr: list(candidates) });
      setLeadCounts(Object.fromEntries(SCHEDULE_VIEWS.map((v, i) => [viewKey(v), counts[i]?.meta?.total ?? 0])));
    })();
    return () => {
      live = false;
    };
  }, [reloadKey]);

  useEffect(() => {
    let live = true;
    getJson(leadQuery(view, LEAD_LIMIT))
      .catch(() => null)
      .then((data) => {
        if (live) setLeads({ request, rows: (data?.data ?? []).map(leadItem) });
      });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `request` names the view
  }, [request]);

  const itemsFor = useCallback(
    (v: ScheduleView): ScheduleItem[] => [
      ...records.inbound.filter((r) => inView("inbound", r, v)).map(inboundItem),
      ...records.agent.filter((r) => inView("agent", r, v)).map(agentItem),
      ...records.hr.filter((r) => inView("hr", r, v)).map(candidateItem),
    ],
    [records],
  );

  const counts = useMemo(() => {
    const out: Record<string, Record<ModuleFilter, number>> = {};
    for (const v of SCHEDULE_VIEWS) {
      const others = itemsFor(v);
      const lead = leadCounts[viewKey(v)] ?? 0;
      const per = { all: lead + others.length, lead, inbound: 0, agent: 0, hr: 0 } as Record<ModuleFilter, number>;
      for (const i of others) per[i.module]++;
      out[viewKey(v)] = per;
    }
    return out;
  }, [itemsFor, leadCounts]);

  const done = isDoneView(view);
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const all = [...leadRows, ...itemsFor(view)].filter((i) => moduleFilter === "all" || i.module === moduleFilter);
    const found = q ? all.filter((i) => [i.code, i.name, i.mobile, i.staff].some((v) => v.toLowerCase().includes(q))) : all;
    return sortItems(found, done);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` names the view
  }, [leadRows, itemsFor, key, moduleFilter, query, done]);

  const countOf = (v: ScheduleView) => counts[viewKey(v)]?.[moduleFilter] ?? 0;
  const bucketCount = (b: ActionFilter) => (b === "Today" ? countOf({ bucket: b, mode }) : countOf({ bucket: b, mode: "pending" }));
  const tally = (n: number, tone?: string) => (
    <span className={cn("ml-1.5 tabular-nums text-muted-foreground", n > 0 && tone)}>{n}</span>
  );

  const columns: ColumnDef<ScheduleItem>[] = [
    {
      id: "when",
      header: done ? "Followed up" : "Follow-up",
      cell: ({ row }) => {
        const i = row.original;
        return (
          <span className={cn("whitespace-nowrap tabular-nums", !done && bucket === "Overdue" && "text-rose-600 dark:text-rose-400")}>
            {done ? formatWhen(i.doneDate, i.doneTime) : formatWhen(i.nextDate, i.nextTime)}
          </span>
        );
      },
    },
    {
      id: "module",
      header: "Module",
      cell: ({ row }) => {
        const m = SCHEDULE_MODULES.find((x) => x.value === row.original.module)!;
        return (
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-muted-foreground">
            <span className={cn("size-1.5 rounded-full", m.dot)} />
            {m.label}
          </span>
        );
      },
    },
    { id: "code", header: "ID", cell: ({ row }) => <IdCell href={row.original.href}>{row.original.code}</IdCell> },
    { id: "name", header: "Name", cell: ({ row }) => <NameCell name={row.original.name} avatar /> },
    { id: "mobile", header: "Mobile", cell: ({ row }) => <span className="tabular-nums">{row.original.mobile || "—"}</span> },
    { id: "staff", header: "Assigned staff", cell: ({ row }) => row.original.staff },
    { id: "status", header: "Status", cell: ({ row }) => <StatusCell status={row.original.status} /> },
    { id: "priority", header: "Priority", cell: ({ row }) => row.original.priority || <span className="text-muted-foreground">—</span> },
  ];

  const empty = (
    <div className="py-16 text-center text-[13px] text-muted-foreground">
      {done ? "No follow-ups were logged for this day." : "Nothing scheduled here."}
    </div>
  );

  const table = (flush: boolean) =>
    loading ? (
      <TableSkeleton columns={7} rows={6} flush={flush} />
    ) : (
      <DataTable
        variant={flush ? "default" : "list"}
        flush={flush}
        columns={columns}
        data={rows}
        onRowClick={(i) => router.push(i.href)}
        emptyState={empty}
        persistKey={false}
      />
    );

  return (
    <>
      <MobileHeader title="Scheduler" />
      <PageActions>
        <button type="button" onClick={() => setReloadKey((k) => k + 1)} className={headerButtonClass}>
          <RefreshCw className="size-4" />
          Refresh
        </button>
      </PageActions>

      <ListFrame>
        <ListToolbar>
          <SegmentTabs
            label="When"
            value={bucket}
            onChange={setBucket}
            tabs={ACTION_FILTERS.map((b) => ({
              value: b,
              label: (
                <>
                  {getActionFilterLabel(b)}
                  {tally(bucketCount(b), b === "Overdue" ? "text-rose-600 dark:text-rose-400" : b === "Today" ? "text-foreground" : undefined)}
                </>
              ),
            }))}
          />
          {bucket === "Today" && (
            <SegmentTabs
              label="Follow-up state"
              value={mode}
              onChange={setMode}
              tabs={[
                { value: "pending", label: <>Follow up{tally(countOf({ bucket: "Today", mode: "pending" }))}</> },
                { value: "completed", label: <>Followed up{tally(countOf({ bucket: "Today", mode: "completed" }))}</> },
              ]}
            />
          )}
          <ToolbarEnd>
            <SegmentTabs
              label="Module"
              value={moduleFilter}
              onChange={setModuleFilter}
              tabs={[{ value: "all" as const, label: "All" }, ...SCHEDULE_MODULES.map((m) => ({ value: m.value, label: m.label }))]}
            />
            <ToolbarSearch value={search} onChange={setSearch} placeholder="Search ID, name, phone, staff" className="hidden md:block" />
          </ToolbarEnd>
        </ListToolbar>
        <div className="px-4 pb-2 md:hidden">
          <ToolbarSearch value={search} onChange={setSearch} placeholder="Search ID, name, phone, staff" />
        </div>
        <ListBody>
          <div className="hidden md:contents">{table(false)}</div>
          <div className="pb-4 md:hidden">{table(true)}</div>
        </ListBody>
      </ListFrame>
    </>
  );
}
