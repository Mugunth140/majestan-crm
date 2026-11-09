"use client";

import { apiFetch } from "@/lib/api-fetch";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { MobileHeader } from "@/components/layout/mobile-header";
import { ListBody, ListFrame, ListToolbar, SegmentTabs, ToolbarEnd, ToolbarSearch } from "@/components/layout/list-page";
import { DataTable } from "@/components/tables/data-table";
import { TableSkeleton } from "@/components/tables/table-skeleton";
import { NameCell } from "@/components/tables/cells";
import { EmptyState } from "@/components/shared/empty-state";
import { DeviceCard, HealthPill, Stamp, deviceLine } from "@/components/logger/device-card";
import { fetchLoggerDevices, healthOf, type LoggerDevice } from "@/lib/logger-devices";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

type View = "all" | "attention" | "healthy";

const columns: ColumnDef<LoggerDevice>[] = [
  {
    id: "staff",
    header: "Staff",
    accessorFn: (d) => d.staff?.name,
    cell: ({ row }) => <NameCell name={row.original.staff?.name || "Unknown staff"} staffId={row.original.staff?.id ?? null} sub={[row.original.staff?.role, row.original.staff?.email].filter(Boolean).join(" · ")} avatar />,
  },
  {
    id: "device",
    header: "Device",
    accessorFn: (d) => d.device_model,
    cell: ({ row }) => <span className="block max-w-[240px] truncate text-muted-foreground" title={deviceLine(row.original)}>{deviceLine(row.original)}</span>,
  },
  {
    id: "health",
    header: "Health",
    accessorFn: (d) => healthOf(d),
    cell: ({ row }) => (
      <span className="flex flex-col items-start gap-0.5">
        <HealthPill device={row.original} />
        {row.original.last_error && <span className="block max-w-[220px] truncate text-[12px] text-rose-700 dark:text-rose-400" title={row.original.last_error}>{row.original.last_error}</span>}
      </span>
    ),
  },
  {
    id: "last_seen",
    header: "Last check-in",
    accessorFn: (d) => d.last_seen_at,
    cell: ({ row }) => <Stamp value={row.original.last_seen_at} className="tabular-nums" />,
  },
  {
    id: "last_sync",
    header: "Last sync",
    accessorFn: (d) => d.last_successful_sync_at ?? "",
    cell: ({ row }) => <Stamp value={row.original.last_successful_sync_at} className="tabular-nums" />,
  },
  {
    id: "calls",
    header: "Calls synced",
    accessorFn: (d) => d.last_sync_count,
    cell: ({ row }) => <span className="tabular-nums">{row.original.last_sync_count}</span>,
  },
  {
    id: "access",
    header: "Call-log access",
    accessorFn: (d) => d.call_log_permission,
    cell: ({ row }) => row.original.call_log_permission
      ? <span className="text-muted-foreground">Granted</span>
      : <span className="text-amber-700 dark:text-amber-400">Not granted</span>,
  },
];

export default function LoggerPage() {
  const router = useRouter();
  const [devices, setDevices] = useState<LoggerDevice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAllowed, setIsAllowed] = useState(true);
  const [view, setView] = useState<View>("all");
  const [search, setSearch] = useState("");

  // Loads on open, then refreshes quietly every minute (no skeleton).
  useEffect(() => {
    let live = true;
    const load = () => fetchLoggerDevices(apiFetch, API_URL)
      .then((list) => {
        if (!live) return;
        if (list === null) setIsAllowed(false);
        else setDevices(list);
      })
      .catch(() => { /* keep what's on screen; the next refresh tries again */ })
      .finally(() => { if (live) setIsLoading(false); });
    load();
    const interval = window.setInterval(load, 60_000);
    return () => { live = false; window.clearInterval(interval); };
  }, []);

  const healthy = devices.filter((d) => healthOf(d) === "healthy");
  const attention = devices.filter((d) => healthOf(d) !== "healthy");
  const q = search.trim().toLowerCase();
  const shown = useMemo(() => {
    const inView = view === "healthy" ? devices.filter((d) => healthOf(d) === "healthy") : view === "attention" ? devices.filter((d) => healthOf(d) !== "healthy") : devices;
    if (!q) return inView;
    return inView.filter((d) => [d.staff?.name, d.staff?.email, d.device_model].some((v) => v?.toLowerCase().includes(q)));
  }, [devices, view, q]);

  const open = (d: LoggerDevice) => { if (d.staff?.id) router.push(`/users/${d.staff.id}?tab=devices`); };

  if (!isAllowed) {
    return (
      <>
        <MobileHeader title="Logger" />
        <EmptyState kind="records" className="py-24" title="Admin or manager access required" description="Device health is visible to admins and managers only." />
      </>
    );
  }

  const tabs = [
    { value: "all" as const, label: <>All <span className="tabular-nums text-muted-foreground">{devices.length}</span></> },
    { value: "attention" as const, label: <>Needs attention <span className="tabular-nums text-muted-foreground">{attention.length}</span></> },
    { value: "healthy" as const, label: <>Healthy <span className="tabular-nums text-muted-foreground">{healthy.length}</span></> },
  ];
  const empty = devices.length === 0
    ? <EmptyState kind="records" className="py-16" title="No phones have registered" description="Install the logger app on a staff phone and sign in with their CRM account. The phone shows up here after its first check-in." />
    : <EmptyState kind="records" className="py-16" title="No devices match" description="Try another search or view." />;

  return (
    <div className="flex flex-col md:h-full">
      <MobileHeader title="Logger" />
      <ListFrame>
        <ListToolbar>
          <SegmentTabs tabs={tabs} value={view} onChange={setView} label="Device health" />
          <span className="hidden text-[13px] text-muted-foreground lg:inline">Updates every minute</span>
          <ToolbarEnd>
            <ToolbarSearch value={search} onChange={setSearch} placeholder="Search staff or device" className="w-full md:w-auto" />
          </ToolbarEnd>
        </ListToolbar>
        <ListBody>
          {isLoading ? <TableSkeleton columns={8} rows={6} flush /> : (
            <>
              <div className="space-y-3 px-4 pb-24 pt-1 md:hidden">
                {shown.length ? shown.map((d) => (
                  <DeviceCard key={d.id} device={d} onOpen={() => open(d)}
                    title={d.staff?.name || "Unknown staff"} />
                )) : empty}
              </div>
              <div className="hidden min-h-0 flex-1 flex-col md:flex">
                <DataTable variant="list" columns={columns} data={shown} onRowClick={open} persistKey={false} emptyState={empty} />
              </div>
            </>
          )}
        </ListBody>
      </ListFrame>
    </div>
  );
}

