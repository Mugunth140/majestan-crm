"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ColumnDef, PaginationState, Updater } from "@tanstack/react-table";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api-fetch";
import { timeAgo } from "@/lib/time-ago";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { DataTable } from "@/components/tables/data-table";
import { IdCell, NameCell } from "@/components/tables/cells";
import { TableSkeleton } from "@/components/tables/table-skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";
const LIMIT = 10;

interface VerificationInbound {
  id: number;
  property_id?: string | null;
  property_title?: string | null;
  property_type?: string | null;
  locality?: string | null;
  city?: string | null;
  owner_name?: string | null;
  mobile_number?: string | null;
  uploaded_by_name?: string | null;
  assigned_staff_name?: string | null;
  updated_at?: string;
}

type Outcome = "verification_done" | "available" | "not_available";
const OUTCOME_TOAST: Record<Outcome, string> = {
  verification_done: "moved to Closed as verified",
  available: "sent to the inbound Queue as available",
  not_available: "moved to Closed as not available",
};

const humanize = (v?: string | null) => (v ? v.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "");

/**
 * Inbounds marked "Fixed verification", waiting for the sourcing team. Setting
 * an outcome moves them on: verified or not available close them, available
 * sends them to the inbound Queue.
 */
export function VerificationQueue() {
  const router = useRouter();
  const [rows, setRows] = useState<VerificationInbound[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = usePersistedState("routing:verificationPage", 1);
  const [busy, setBusy] = useState<number | "bulk" | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`${API_URL}/inbounds/verification-queue?page=${page}&limit=${LIMIT}`);
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message);
      setRows(data.data.items);
      setTotal(data.data.total);
    } catch {
      toast.error("Failed to load the verification queue");
    } finally {
      setLoading(false);
    }
  }, [page]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount and page change
  useEffect(() => { void load(); }, [load]);

  const settle = useCallback(async (ids: number[], outcome: Outcome, key: number | "bulk") => {
    setBusy(key);
    try {
      const results = await Promise.all(ids.map((id) =>
        apiFetch(`${API_URL}/inbounds/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ inbound_status: outcome }),
        })));
      if (results.some((r) => !r.ok)) throw new Error();
      toast.success(`${ids.length === 1 ? "Inbound" : `${ids.length} inbounds`} ${OUTCOME_TOAST[outcome]}.`);
      void load();
    } catch {
      toast.error("Could not update the inbound");
    } finally {
      setBusy(null);
    }
  }, [load]);

  const columns = useMemo<ColumnDef<VerificationInbound>[]>(() => [
    {
      id: "select",
      header: ({ table }) => (
        <div className="flex items-center justify-center">
          <Checkbox checked={table.getIsAllPageRowsSelected()} onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)} aria-label="Select all" />
        </div>
      ),
      cell: ({ row }) => (
        <div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
          <Checkbox checked={row.getIsSelected()} onCheckedChange={(v) => row.toggleSelected(!!v)} aria-label="Select row" />
        </div>
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "property_id",
      header: "ID",
      cell: ({ row }) => <IdCell href={`/inbound/${row.original.id}`}>{row.original.property_id || `I${String(row.original.id).padStart(5, "0")}`}</IdCell>,
    },
    {
      accessorKey: "property_title",
      header: "Property",
      cell: ({ row }) => (
        <NameCell
          name={row.original.property_title || humanize(row.original.property_type) || "Untitled"}
          sub={[humanize(row.original.property_type), [row.original.locality, row.original.city].filter(Boolean).join(", ")].filter(Boolean).join(" · ") || undefined}
        />
      ),
    },
    {
      accessorKey: "owner_name",
      header: "Owner",
      cell: ({ row }) => (
        <span className="flex flex-col leading-tight">
          <span>{row.original.owner_name || "—"}</span>
          {row.original.mobile_number && <span className="text-[12px] tabular-nums text-muted-foreground">{row.original.mobile_number}</span>}
        </span>
      ),
    },
    {
      accessorKey: "uploaded_by_name",
      header: "Added by",
      cell: ({ row }) => <span>{row.original.uploaded_by_name || "—"}</span>,
    },
    {
      accessorKey: "updated_at",
      header: "Waiting",
      cell: ({ row }) => <span className="whitespace-nowrap text-muted-foreground">{timeAgo(row.original.updated_at)}</span>,
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
          <Button size="sm" variant="outline" className="h-7 gap-1.5" disabled={busy !== null} onClick={() => settle([row.original.id], "verification_done", row.original.id)}>
            {busy === row.original.id && <Loader2 className="size-3.5 animate-spin" />}
            Verification done
          </Button>
        </div>
      ),
      enableSorting: false,
      enableHiding: false,
    },
  ], [busy, settle]);

  if (loading && !rows.length) return <TableSkeleton />;
  if (!rows.length) {
    return <EmptyState kind="inbox" title="Nothing to verify" description='Inbounds marked "Fixed verification" show up here for the sourcing team.' />;
  }

  return (
    <DataTable
      variant="list"
      flush
      manualPagination
      pageCount={Math.max(1, Math.ceil(total / LIMIT))}
      totalCount={total}
      pagination={{ pageIndex: page - 1, pageSize: LIMIT }}
      onPaginationChange={(u: Updater<PaginationState>) => setPage((p) => (typeof u === "function" ? u({ pageIndex: p - 1, pageSize: LIMIT }) : u).pageIndex + 1)}
      pageSizeOptions={[LIMIT]}
      persistKey="verification"
      columns={columns}
      data={rows}
      onRowClick={(r) => router.push(`/inbound/${r.id}`)}
      showToolbar
      renderToolbarActions={(selected, clear) => selected.length > 0 && (
        <>
          <Button size="sm" variant="outline" disabled={busy !== null} onClick={async () => { await settle(selected.map((r) => r.id), "verification_done", "bulk"); clear(); }}>
            {busy === "bulk" && <Loader2 className="size-3.5 animate-spin" />}
            Verification done
          </Button>
          <Button size="sm" variant="outline" disabled={busy !== null} onClick={async () => { await settle(selected.map((r) => r.id), "available", "bulk"); clear(); }}>
            Available
          </Button>
          <Button size="sm" variant="outline" disabled={busy !== null} onClick={async () => { await settle(selected.map((r) => r.id), "not_available", "bulk"); clear(); }}>
            Not available
          </Button>
        </>
      )}
    />
  );
}
