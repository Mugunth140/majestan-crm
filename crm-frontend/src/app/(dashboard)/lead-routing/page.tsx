"use client";

import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { DataTable } from "@/components/tables/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Trash2, RefreshCw, Filter } from "lucide-react";
import { toast } from "sonner";
import { motion } from "motion/react";
import { TableSkeleton } from "@/components/tables/table-skeleton";
import { AssignLeadModal } from "@/components/shared/assign-lead-modal";
import { FormSelect } from "@/components/shared/form-select";
import { DatePicker } from "@/components/shared/date-picker";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

type MainTab = "queue" | "history";
type DeptTab = "telecalling" | "sales";

interface QueueLead {
  id: number;
  display_id?: string;
  name: string;
  mobile_number?: string;
  status?: string;
  last_follow_up_date?: string;
  previously_held_by?: string;
  release_reason?: string;
  days_in_queue?: number;
  department?: { name: string };
}

interface HistoryEntry {
  id: number;
  created_at: string;
  lead?: { name: string };
  event_type?: string;
  from_staff?: { name: string };
  to_staff?: { name: string };
  department?: { name: string };
  feedback?: string;
}

const EVENT_TYPE_OPTIONS = [
  { label: "All Events", value: "" },
  { label: "Assigned", value: "assigned" },
  { label: "Claimed", value: "claimed" },
  { label: "Released", value: "released" },
  { label: "Converted", value: "converted" },
];

function formatDate(d?: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function formatDateTime(d?: string) {
  if (!d) return "—";
  const dt = new Date(d);
  return dt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) +
    " " + dt.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true });
}

export default function LeadRoutingPage() {
  const [role, setRole] = useState<string>("");
  const [userDept, setUserDept] = useState<string>("");

  const [mainTab, setMainTab] = useState<MainTab>("queue");
  const [deptTab, setDeptTab] = useState<DeptTab>("telecalling");

  // Queue state
  const [queue, setQueue] = useState<QueueLead[]>([]);
  const [queueLoading, setQueueLoading] = useState(false);
  const [queuePage, setQueuePage] = useState(1);
  const [queueTotal, setQueueTotal] = useState(0);
  const LIMIT = 25;

  // History state
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyEventFilter, setHistoryEventFilter] = useState("");
  const [historyDateFrom, setHistoryDateFrom] = useState<Date | undefined>(undefined);
  const [historyDateTo, setHistoryDateTo] = useState<Date | undefined>(undefined);

  // Assign lead modal
  const [assignLeadId, setAssignLeadId] = useState<number | null>(null);
  const [isAssigning, setIsAssigning] = useState(false);

  // Claim loading
  const [claimingId, setClaimingId] = useState<number | null>(null);

  // Delete loading
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const user = JSON.parse(localStorage.getItem("crm_user") || "{}");
        const roleName = user?.role?.name || "";
        const deptName = (user?.department?.name || "").toLowerCase();
        setRole(roleName);
        setUserDept(deptName);
        if (roleName === "Staff") {
          setDeptTab(deptName === "sales" ? "sales" : "telecalling");
        }
      } catch {
        // ignore
      }
    }
  }, []);

  const fetchQueue = useCallback(async () => {
    setQueueLoading(true);
    try {
      const params = new URLSearchParams({
        department: deptTab,
        page: String(queuePage),
        limit: String(LIMIT),
      });
      const res = await fetch(`${API_URL}/lead-routing/queue?${params}`);
      const data = await res.json();
      if (data.success) {
        setQueue(data.data || []);
        setQueueTotal(data.total || data.data?.length || 0);
      } else {
        toast.error("Failed to load routing queue");
      }
    } catch {
      toast.error("Failed to load routing queue");
    } finally {
      setQueueLoading(false);
    }
  }, [deptTab, queuePage]);

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(historyPage),
        limit: String(LIMIT),
      });
      if (historyEventFilter) params.set("event_type", historyEventFilter);
      if (historyDateFrom) params.set("date_from", format(historyDateFrom, "yyyy-MM-dd"));
      if (historyDateTo) params.set("date_to", format(historyDateTo, "yyyy-MM-dd"));
      const res = await fetch(`${API_URL}/lead-routing/history?${params}`);
      const data = await res.json();
      if (data.success) {
        setHistory(data.data || []);
        setHistoryTotal(data.total || data.data?.length || 0);
      } else {
        toast.error("Failed to load routing history");
      }
    } catch {
      toast.error("Failed to load routing history");
    } finally {
      setHistoryLoading(false);
    }
  }, [historyPage, historyEventFilter, historyDateFrom, historyDateTo]);

  useEffect(() => {
    if (mainTab === "queue") fetchQueue();
  }, [mainTab, fetchQueue]);

  useEffect(() => {
    if (mainTab === "history") fetchHistory();
  }, [mainTab, fetchHistory]);

  // When dept tab changes, reset page and refetch
  useEffect(() => {
    setQueuePage(1);
  }, [deptTab]);

  const handleClaim = async (leadId: number) => {
    setClaimingId(leadId);
    try {
      const res = await fetch(`${API_URL}/lead-routing/claim/${leadId}`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        toast.success("Lead claimed successfully");
        fetchQueue();
      } else {
        toast.error(data.message || "Failed to claim lead");
      }
    } catch {
      toast.error("Failed to claim lead");
    } finally {
      setClaimingId(null);
    }
  };

  const handleAssignLead = async (toUserId: number) => {
    if (!assignLeadId) return;
    setIsAssigning(true);
    try {
      const res = await fetch(`${API_URL}/lead-routing/assign/${assignLeadId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to_user_id: toUserId }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Lead assigned successfully");
        fetchQueue();
      } else {
        toast.error(data.message || "Failed to assign lead");
      }
    } catch {
      toast.error("Failed to assign lead");
    } finally {
      setIsAssigning(false);
      setAssignLeadId(null);
    }
  };

  const handleDeleteQueueLead = async (leadId: number) => {
    setDeletingId(leadId);
    try {
      const res = await fetch(`${API_URL}/leads/${leadId}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Lead deleted");
        fetchQueue();
      } else {
        toast.error("Failed to delete lead");
      }
    } catch {
      toast.error("Failed to delete lead");
    } finally {
      setDeletingId(null);
    }
  };

  const queueColumns: ColumnDef<QueueLead>[] = [
    {
      accessorKey: "display_id",
      header: "Lead ID",
      cell: ({ row }) => (
        <span className="font-mono text-[13px] text-[#0052FF] font-medium">
          {row.original.display_id || `L${String(row.original.id).padStart(5, "0")}`}
        </span>
      ),
    },
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center font-bold text-xs text-blue-900 dark:text-blue-300 shrink-0">
            {row.original.name?.charAt(0)?.toUpperCase() ?? "?"}
          </div>
          <span className="font-medium">{row.original.name}</span>
        </div>
      ),
    },
    {
      accessorKey: "mobile_number",
      header: "Mobile",
      cell: ({ row }) => <span>{row.original.mobile_number || "—"}</span>,
    },
    {
      accessorKey: "status",
      header: "Last Status",
      cell: ({ row }) => (
        <Badge variant="outline" className="text-xs whitespace-nowrap">
          {row.original.status || "—"}
        </Badge>
      ),
    },
    {
      accessorKey: "last_follow_up_date",
      header: "Last Follow-up",
      cell: ({ row }) => <span className="text-sm">{formatDate(row.original.last_follow_up_date)}</span>,
    },
    {
      accessorKey: "previously_held_by",
      header: "Previously Held By",
      cell: ({ row }) => <span className="text-sm">{row.original.previously_held_by || "—"}</span>,
    },
    {
      accessorKey: "release_reason",
      header: "Release Reason",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground max-w-[140px] truncate block">
          {row.original.release_reason || "—"}
        </span>
      ),
    },
    {
      accessorKey: "days_in_queue",
      header: "Days in Queue",
      cell: ({ row }) => {
        const days = row.original.days_in_queue ?? 0;
        return (
          <span className={`font-semibold text-sm ${days > 7 ? "text-red-500" : days > 3 ? "text-amber-500" : "text-green-600"}`}>
            {days}d
          </span>
        );
      },
    },
    {
      id: "actions",
      header: "Action",
      cell: ({ row }) => (
        <div className="flex items-center justify-center gap-2" onClick={(e) => e.stopPropagation()}>
          {role === "Staff" ? (
            <Button
              size="sm"
              className="h-8 px-4 text-xs rounded-full bg-[#0052FF] text-white hover:bg-[#0052FF]/90 shadow"
              disabled={claimingId === row.original.id}
              onClick={() => handleClaim(row.original.id)}
            >
              {claimingId === row.original.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Take Lead"}
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-4 text-xs rounded-full border-[#0052FF]/30 text-[#0052FF] hover:bg-[#0052FF]/10"
              onClick={() => setAssignLeadId(row.original.id)}
            >
              Assign Lead
            </Button>
          )}
          {role === "Admin" && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
              title="Delete"
              disabled={deletingId === row.original.id}
              onClick={() => handleDeleteQueueLead(row.original.id)}
            >
              {deletingId === row.original.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 size={15} />}
            </Button>
          )}
        </div>
      ),
    },
  ];

  const historyColumns: ColumnDef<HistoryEntry>[] = [
    {
      accessorKey: "created_at",
      header: "Date",
      cell: ({ row }) => <span className="text-sm">{formatDateTime(row.original.created_at)}</span>,
    },
    {
      id: "lead_name",
      header: "Lead Name",
      cell: ({ row }) => <span className="font-medium">{row.original.lead?.name || "—"}</span>,
    },
    {
      accessorKey: "event_type",
      header: "Event Type",
      cell: ({ row }) => {
        const evt = row.original.event_type || "";
        const styles: Record<string, string> = {
          assigned: "bg-blue-100 text-blue-700 border-blue-200",
          claimed: "bg-green-100 text-green-700 border-green-200",
          released: "bg-amber-100 text-amber-700 border-amber-200",
          converted: "bg-purple-100 text-purple-700 border-purple-200",
        };
        const cls = styles[evt.toLowerCase()] || "bg-gray-100 text-gray-700 border-gray-200";
        return (
          <Badge className={`capitalize border text-xs ${cls}`}>{evt || "—"}</Badge>
        );
      },
    },
    {
      id: "from_staff",
      header: "From Staff",
      cell: ({ row }) => <span className="text-sm">{row.original.from_staff?.name || "—"}</span>,
    },
    {
      id: "to_staff",
      header: "To Staff",
      cell: ({ row }) => <span className="text-sm">{row.original.to_staff?.name || "—"}</span>,
    },
    {
      id: "department",
      header: "Department",
      cell: ({ row }) => (
        <span className="text-sm capitalize">{row.original.department?.name || "—"}</span>
      ),
    },
    {
      accessorKey: "feedback",
      header: "Feedback",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground max-w-[200px] truncate block">
          {row.original.feedback || "—"}
        </span>
      ),
    },
  ];

  const deptTabs: { label: string; value: DeptTab }[] = [
    { label: "Telecalling Queue", value: "telecalling" },
    { label: "Sales Queue", value: "sales" },
  ];

  const visibleDeptTabs = role === "Staff"
    ? deptTabs.filter((d) => d.value === (userDept === "sales" ? "sales" : "telecalling"))
    : deptTabs;

  const totalQueuePages = Math.ceil(queueTotal / LIMIT);
  const totalHistoryPages = Math.ceil(historyTotal / LIMIT);

  return (
    <div className="flex flex-col space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex h-[48px] items-center justify-between pr-[150px]">
        <h1 className="text-[28px] font-bold tracking-tight">Lead Routing</h1>
        <Button
          variant="outline"
          size="icon"
          className="h-10 w-10 rounded-full border-border/60"
          onClick={() => mainTab === "queue" ? fetchQueue() : fetchHistory()}
          title="Refresh"
        >
          <RefreshCw size={16} className={(queueLoading || historyLoading) ? "animate-spin" : ""} />
        </Button>
      </div>

      {/* Main Tabs */}
      <div className="bg-card border rounded-2xl shadow-sm overflow-hidden">
        <div className="flex items-center gap-8 px-6 border-b bg-muted/10 pt-4">
          {(["queue", "history"] as MainTab[]).map((tab) => {
            const labels = { queue: "Routing Queue", history: "Routing History" };
            return (
              <button
                key={tab}
                onClick={() => setMainTab(tab)}
                className={[
                  "relative pb-4 text-[15px] whitespace-nowrap font-semibold transition-colors duration-200 ease-out",
                  mainTab === tab ? "text-[#0052FF]" : "text-muted-foreground hover:text-foreground",
                ].join(" ")}
              >
                {labels[tab]}
                {mainTab === tab && (
                  <motion.div
                    layoutId="routingTabUnderline"
                    className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#0052FF] rounded-t-full"
                    initial={false}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Queue Tab */}
        {mainTab === "queue" && (
          <div className="p-6 space-y-4">
            {/* Department sub-tabs */}
            <div className="flex items-center gap-2">
              {visibleDeptTabs.map((d) => (
                <button
                  key={d.value}
                  onClick={() => setDeptTab(d.value)}
                  className={[
                    "h-9 px-4 rounded-full text-[13px] font-medium border transition-all duration-200",
                    deptTab === d.value
                      ? "bg-[#0052FF] text-white border-[#0052FF]"
                      : "bg-transparent text-muted-foreground border-border/60 hover:bg-muted hover:text-foreground",
                  ].join(" ")}
                >
                  {d.label}
                </button>
              ))}
            </div>

            {queueLoading ? (
              <TableSkeleton />
            ) : (
              <>
                <DataTable columns={queueColumns} data={queue} />
                {/* Server-side pagination */}
                {totalQueuePages > 1 && (
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-sm text-muted-foreground">
                      Page {queuePage} of {totalQueuePages} ({queueTotal} total)
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setQueuePage((p) => Math.max(1, p - 1))}
                        disabled={queuePage <= 1}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setQueuePage((p) => Math.min(totalQueuePages, p + 1))}
                        disabled={queuePage >= totalQueuePages}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* History Tab */}
        {mainTab === "history" && (
          <div className="p-6 space-y-4">
            {/* Filters */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <DatePicker
                  value={historyDateFrom}
                  onChange={(d) => { setHistoryDateFrom(d); setHistoryPage(1); }}
                  placeholder="From date"
                  className="w-40"
                />
                <span className="text-muted-foreground text-sm">to</span>
                <DatePicker
                  value={historyDateTo}
                  onChange={(d) => { setHistoryDateTo(d); setHistoryPage(1); }}
                  placeholder="To date"
                  className="w-40"
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <div className="w-44">
                  <FormSelect
                    name="eventType"
                    options={EVENT_TYPE_OPTIONS}
                    value={historyEventFilter}
                    onValueChange={(v) => { setHistoryEventFilter(v || ""); setHistoryPage(1); }}
                    placeholder="All Events"
                  />
                </div>
              </div>
              {(historyDateFrom !== undefined || historyDateTo !== undefined || historyEventFilter) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 text-muted-foreground hover:text-red-500"
                  onClick={() => {
                    setHistoryDateFrom(undefined);
                    setHistoryDateTo(undefined);
                    setHistoryEventFilter("");
                    setHistoryPage(1);
                  }}
                >
                  Clear
                </Button>
              )}
            </div>

            {historyLoading ? (
              <TableSkeleton />
            ) : (
              <>
                <DataTable columns={historyColumns} data={history} />
                {/* Server-side pagination */}
                {totalHistoryPages > 1 && (
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-sm text-muted-foreground">
                      Page {historyPage} of {totalHistoryPages} ({historyTotal} total)
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                        disabled={historyPage <= 1}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setHistoryPage((p) => Math.min(totalHistoryPages, p + 1))}
                        disabled={historyPage >= totalHistoryPages}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Assign Lead Modal */}
      <AssignLeadModal
        open={assignLeadId !== null}
        onClose={() => setAssignLeadId(null)}
        onConfirm={handleAssignLead}
        leadId={assignLeadId ?? undefined}
        department={deptTab}
        isLoading={isAssigning}
      />
    </div>
  );
}
