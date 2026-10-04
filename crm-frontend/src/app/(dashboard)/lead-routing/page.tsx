"use client";

import { apiFetch } from "@/lib/api-fetch";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { DataTable } from "@/components/tables/data-table";
import { Checkbox } from "@/components/ui/checkbox";
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
import { MobileHeader } from "@/components/layout/mobile-header";
import { Device } from "@/components/shared/device";
import { canTakeLeadFromQueue, assignRoutingLeads } from "@/lib/lead-routing";
import { timeAgo } from "@/lib/time-ago";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

type MainTab = "queue" | "enquiry" | "history";
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

interface EnquiryLead {
  id: number;
  display_id: string;
  name: string;
  mobile_number: string;
  status: string;
  type: "New" | "Repeat";
  repeat_count: number;
  last_enquiry_at: string;
  property_code: string | null;
  property_title: string | null;
  intent: string;
  visit_date: string | null;
  visit_slot: string | null;
  assigned_staff_id: number | null;
  assigned_staff_name: string | null;
}

interface HistoryEntry {
  id: number;
  created_at: string;
  lead?: { id: number; name: string };
  event_type?: string;
  from_staff?: { name: string };
  to_staff?: { name: string };
  department?: { name: string };
  feedback?: string;
}

const EVENT_TYPE_OPTIONS = [
  { label: "All Events", value: "" },
  { label: "Assigned", value: "Assigned" },
  { label: "Claimed", value: "Claimed" },
  { label: "Auto-transferred", value: "Auto-transferred" },
  { label: "Auto-unassigned", value: "Auto-unassigned" },
  { label: "Converted", value: "Converted" },
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
  const router = useRouter();
  const [role, setRole] = useState<string>("");
  const [userDept, setUserDept] = useState<string>("");

  const [mainTab, setMainTab] = useState<MainTab>("queue");
  const [deptTab, setDeptTab] = useState<DeptTab>("telecalling");
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);

  // Queue state
  const [queue, setQueue] = useState<QueueLead[]>([]);
  const [queueLoading, setQueueLoading] = useState(false);
  const [queuePage, setQueuePage] = useState(1);
  const [queueTotal, setQueueTotal] = useState(0);
  const LIMIT = 10;

  // Enquiry queue state
  const [enquiry, setEnquiry] = useState<EnquiryLead[]>([]);
  const [enquiryLoading, setEnquiryLoading] = useState(false);
  const [enquiryPage, setEnquiryPage] = useState(1);
  const [enquiryTotal, setEnquiryTotal] = useState(0);

  // History state
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyEventFilter, setHistoryEventFilter] = useState("");
  const [historyDateFrom, setHistoryDateFrom] = useState<Date | undefined>(undefined);
  const [historyDateTo, setHistoryDateTo] = useState<Date | undefined>(undefined);

  // Assign lead modal
  const [assignLeadIds, setAssignLeadIds] = useState<number[]>([]);
  const [isAssigning, setIsAssigning] = useState(false);

  // Claim loading
  const [claimingId, setClaimingId] = useState<number | null>(null);

  // Acknowledge loading
  const [acknowledgingId, setAcknowledgingId] = useState<number | null>(null);

  // Delete loading
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [bulkDeleteIds, setBulkDeleteIds] = useState<number[] | null>(null);
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const user = JSON.parse(localStorage.getItem("crm_user") || "{}");
        const roleName = user?.role?.name || user?.role || "";
        const deptName = (user?.department?.name || user?.department || "").toLowerCase();
        if (user?.id != null) setCurrentUserId(Number(user.id));
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
      const res = await apiFetch(`${API_URL}/lead-routing/queue?${params}`);
      const data = await res.json();
      if (data.success) {
        setQueue(data.data?.items || data.data || []);
        setQueueTotal(data.data?.total || data.total || 0);
      } else {
        toast.error("Failed to load routing queue");
      }
    } catch {
      toast.error("Failed to load routing queue");
    } finally {
      setQueueLoading(false);
    }
  }, [deptTab, queuePage]);

  const fetchEnquiry = useCallback(async () => {
    setEnquiryLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(enquiryPage),
        limit: String(LIMIT),
      });
      const res = await apiFetch(`${API_URL}/lead-routing/enquiry-queue?${params}`);
      const data = await res.json();
      if (data.success) {
        setEnquiry(data.data?.items || data.data || []);
        setEnquiryTotal(data.data?.total || data.total || 0);
      } else {
        toast.error("Failed to load enquiry queue");
      }
    } catch {
      toast.error("Failed to load enquiry queue");
    } finally {
      setEnquiryLoading(false);
    }
  }, [enquiryPage]);

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
      const res = await apiFetch(`${API_URL}/lead-routing/history?${params}`);
      const data = await res.json();
      if (data.success) {
        setHistory(data.data?.items || data.data || []);
        setHistoryTotal(data.data?.total || data.total || 0);
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
    if (mainTab === "enquiry") fetchEnquiry();
  }, [mainTab, fetchEnquiry]);

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
      let currentUserId = 0;
      const stored = localStorage.getItem("crm_user");
      if (stored) currentUserId = JSON.parse(stored).id;

      const res = await apiFetch(`${API_URL}/lead-routing/claim/${leadId}`, { 
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actioned_by_id: currentUserId || null })
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Lead claimed successfully");
        if (mainTab === "enquiry") fetchEnquiry();
        else fetchQueue();
      } else {
        toast.error(data.message || data.error || "Failed to claim lead");
      }
    } catch {
      toast.error("Failed to claim lead");
    } finally {
      setClaimingId(null);
    }
  };

  const handleAssignLead = async (toUserId: number) => {
    if (assignLeadIds.length === 0) return;
    setIsAssigning(true);
    try {
      let currentUserId = 0;
      try {
        const stored = localStorage.getItem("crm_user");
        if (stored) currentUserId = JSON.parse(stored).id;
      } catch {}

      const { assigned, failed } = await assignRoutingLeads(async (leadId) => {
        const res = await apiFetch(`${API_URL}/lead-routing/assign/${leadId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to_user_id: toUserId, actioned_by_id: currentUserId || null }),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.message || "Failed to assign lead");
      }, assignLeadIds);
      if (assigned > 0) toast.success(`${assigned} lead(s) assigned successfully`);
      if (failed > 0) toast.error(`Failed to assign ${failed} lead(s)`);
      if (mainTab === "enquiry") fetchEnquiry();
      else fetchQueue();
    } catch {
      toast.error("Failed to assign lead");
    } finally {
      setIsAssigning(false);
      setAssignLeadIds([]);
    }
  };

  const handleAcknowledge = async (leadId: number) => {
    setAcknowledgingId(leadId);
    try {
      const res = await apiFetch(`${API_URL}/leads/${leadId}/acknowledge-enquiry`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        toast.success("Enquiry acknowledged");
        fetchEnquiry();
      } else {
        toast.error(data.message || data.error || "Failed to acknowledge enquiry");
      }
    } catch {
      toast.error("Failed to acknowledge enquiry");
    } finally {
      setAcknowledgingId(null);
    }
  };

  const executeDeleteQueueLead = async () => {
    if (!deletingId) return;
    try {
      const res = await apiFetch(`${API_URL}/leads/${deletingId}`, { method: "DELETE" });
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

  const handleBulkDelete = async () => {
    if (!bulkDeleteIds || bulkDeleteIds.length === 0) return;
    setIsDeletingBulk(true);
    try {
      const promises = bulkDeleteIds.map(id => apiFetch(`${API_URL}/leads/${id}`, { method: "DELETE" }));
      await Promise.all(promises);
      toast.success(`${bulkDeleteIds.length} lead(s) deleted successfully`);
      fetchQueue();
    } catch {
      toast.error("Failed to delete some or all leads");
    } finally {
      setIsDeletingBulk(false);
      setBulkDeleteIds(null);
    }
  };

  const queueColumns = useMemo<ColumnDef<QueueLead>[]>(() => [
    {
      id: "select",
      header: ({ table }) => (
        <div className="flex items-center justify-center">
          <Checkbox
            checked={table.getIsAllPageRowsSelected()}
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            aria-label="Select all"
            className="data-[state=checked]:bg-[#0052FF] data-[state=checked]:border-[#0052FF]"
          />
        </div>
      ),
      cell: ({ row }) => (
        <div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Select row"
            className="data-[state=checked]:bg-[#0052FF] data-[state=checked]:border-[#0052FF]"
          />
        </div>
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "display_id",
      header: "Lead ID",
      cell: ({ row }) => (
        <span 
          onClick={() => router.push(`/leads/${row.original.id}`)}
          className="font-mono text-[13px] text-[#0052FF] font-medium cursor-pointer hover:underline"
        >
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
      id: "days_in_queue",
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
  ], [role, router]);

  const enquiryColumns = useMemo<ColumnDef<EnquiryLead>[]>(() => [
    {
      id: "select",
      header: ({ table }) => (
        <div className="flex items-center justify-center">
          <Checkbox
            checked={table.getIsAllPageRowsSelected()}
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            aria-label="Select all"
            className="data-[state=checked]:bg-[#0052FF] data-[state=checked]:border-[#0052FF]"
          />
        </div>
      ),
      cell: ({ row }) => (
        <div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Select row"
            className="data-[state=checked]:bg-[#0052FF] data-[state=checked]:border-[#0052FF]"
          />
        </div>
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "display_id",
      header: "Lead ID",
      cell: ({ row }) => (
        <span
          onClick={() => router.push(`/leads/${row.original.id}`)}
          className="font-mono text-[13px] text-[#0052FF] font-medium cursor-pointer hover:underline"
        >
          {row.original.display_id}
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
      accessorKey: "type",
      header: "Type",
      cell: ({ row }) => {
        const isRepeat = row.original.type === "Repeat";
        return (
          <Badge className={`border text-xs ${isRepeat ? "bg-amber-100 text-amber-700 border-amber-200" : "bg-blue-100 text-blue-700 border-blue-200"}`}>
            {row.original.type}
          </Badge>
        );
      },
    },
    {
      accessorKey: "intent",
      header: "Purpose",
      cell: ({ row }) => {
        const isVisit = row.original.intent === "site_visit";
        return (
          <Badge className={`border text-xs whitespace-nowrap ${isVisit ? "bg-violet-100 text-violet-700 border-violet-200" : "bg-slate-100 text-slate-600 border-slate-200"}`}>
            {isVisit ? "Site Visit" : "Enquiry"}
          </Badge>
        );
      },
    },
    {
      accessorKey: "repeat_count",
      header: "Repeat Enquiries",
      cell: ({ row }) => (
        <span className="font-mono text-sm block text-center">{row.original.repeat_count}</span>
      ),
    },
    {
      accessorKey: "last_enquiry_at",
      header: "Last Enquiry",
      cell: ({ row }) => (
        <span className="text-sm" title={formatDateTime(row.original.last_enquiry_at)}>
          {timeAgo(row.original.last_enquiry_at) || "—"}
        </span>
      ),
    },
    {
      id: "property",
      header: "Property",
      cell: ({ row }) => {
        const lead = row.original;
        if (!lead.property_title) return <span>—</span>;
        const slot = lead.intent === "site_visit" && lead.visit_slot ? ` ${lead.visit_slot.slice(0, 5)}` : "";
        return (
          <div className="flex flex-col">
            <span className="text-sm font-medium">{lead.property_title}{slot}</span>
            {lead.property_code && (
              <span className="text-xs text-muted-foreground font-mono">{lead.property_code}</span>
            )}
          </div>
        );
      },
    },
    {
      id: "assigned",
      header: "Assigned",
      cell: ({ row }) => row.original.assigned_staff_name ? (
        <span className="text-sm">{row.original.assigned_staff_name}</span>
      ) : (
        <Badge variant="outline" className="text-xs whitespace-nowrap">
          Unassigned
        </Badge>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const lead = row.original;
        const unassigned = lead.assigned_staff_id == null;
        const isOwner = currentUserId != null && Number(lead.assigned_staff_id) === currentUserId;
        return (
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            {canTakeLeadFromQueue(role) && unassigned && (
              <Button
                variant="outline"
                size="sm"
                className="border-[#0052FF]/30 text-[#0052FF] hover:bg-[#0052FF]/10"
                disabled={claimingId === lead.id}
                onClick={() => handleClaim(lead.id)}
              >
                {claimingId === lead.id ? <Loader2 size={14} className="animate-spin" /> : "Take"}
              </Button>
            )}
            {role !== "Staff" && (
              <Button
                variant="outline"
                size="sm"
                className="border-[#0052FF]/30 text-[#0052FF] hover:bg-[#0052FF]/10"
                onClick={() => setAssignLeadIds([lead.id])}
              >
                {unassigned ? "Assign" : "Reassign"}
              </Button>
            )}
            {!unassigned && isOwner && (
              <Button
                variant="outline"
                size="sm"
                className="border-green-500/30 text-green-600 hover:bg-green-500/10"
                disabled={acknowledgingId === lead.id}
                onClick={() => handleAcknowledge(lead.id)}
              >
                {acknowledgingId === lead.id ? <Loader2 size={14} className="animate-spin" /> : "Acknowledge"}
              </Button>
            )}
          </div>
        );
      },
    },
  ], [role, router, claimingId, acknowledgingId, currentUserId]);

  const historyColumns = useMemo<ColumnDef<HistoryEntry>[]>(() => [
    {
      accessorKey: "created_at",
      header: "Date",
      cell: ({ row }) => <span className="text-sm">{formatDateTime(row.original.created_at)}</span>,
    },
    {
      id: "lead_name",
      header: "Lead Name",
      cell: ({ row }) => {
        if (row.original.lead?.id) {
          return (
            <span 
              onClick={() => router.push(`/leads/${row.original.lead!.id}`)}
              className="font-medium text-[#0052FF] cursor-pointer hover:underline"
            >
              {row.original.lead?.name || "—"}
            </span>
          );
        }
        return <span className="font-medium">{row.original.lead?.name || "—"}</span>;
      },
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
  ], [router]);

  const deptTabs: { label: string; value: DeptTab }[] = [
    { label: "Telecalling Queue", value: "telecalling" },
    { label: "Sales Queue", value: "sales" },
  ];

  const visibleDeptTabs = role === "Staff"
    ? deptTabs.filter((d) => d.value === (userDept === "sales" ? "sales" : "telecalling"))
    : deptTabs;

  const totalQueuePages = Math.max(1, Math.ceil(queueTotal / LIMIT));
  const totalEnquiryPages = Math.max(1, Math.ceil(enquiryTotal / LIMIT));
  const totalHistoryPages = Math.max(1, Math.ceil(historyTotal / LIMIT));

  return (
    <>
      <MobileHeader title="Lead Routing" />
      <div className="w-full flex flex-col space-y-4 md:space-y-6 pt-4 lg:p-0 md:h-full">
        <Device
          mobile={null}
          desktop={
            <div className="flex h-[48px] items-center justify-between pr-[150px]">
              <h1 className="text-[28px] font-bold tracking-tight">Lead Routing</h1>
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 rounded-full border-border/60"
                onClick={() => mainTab === "queue" ? fetchQueue() : mainTab === "enquiry" ? fetchEnquiry() : fetchHistory()}
                title="Refresh"
              >
                <RefreshCw size={16} className={(queueLoading || enquiryLoading || historyLoading) ? "animate-spin" : ""} />
              </Button>
            </div>
          }
        />

        <div className="bg-card border-y md:border md:rounded-xl overflow-hidden shadow-sm md:flex md:flex-col md:flex-1 md:min-h-0">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between px-4 md:px-6 border-b bg-muted/10 pt-4 gap-4">
          <div className="flex items-center gap-8">
            {(["queue", "enquiry", "history"] as MainTab[]).map((tab) => {
              const labels = { queue: "Routing Queue", enquiry: "Enquiry Queue", history: "Routing History" };
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

          {mainTab === "queue" && visibleDeptTabs.length > 1 && (
            <div className="flex items-center gap-2 pb-3 sm:pb-4">
              {visibleDeptTabs.map((d) => (
                <button
                  key={d.value}
                  onClick={() => setDeptTab(d.value)}
                  className={[
                    "h-9 px-4 rounded-full text-[13px] font-medium border transition-all duration-200",
                    deptTab === d.value
                      ? "bg-[#0052FF] text-white border-[#0052FF] shadow-sm"
                      : "bg-background text-muted-foreground border-border/60 hover:bg-muted hover:text-foreground",
                  ].join(" ")}
                >
                  {d.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Queue Tab */}
        {mainTab === "queue" && (
          <div className="w-full md:flex-1 md:min-h-0 md:overflow-hidden flex flex-col p-4 md:p-0">
            {queueLoading ? (
              <TableSkeleton />
            ) : (
              <>
                <div className="flex-1 min-h-0 overflow-hidden w-full h-full flex flex-col pt-2">
                <DataTable 
                  flush={true}
                  hidePagination={true}
                  pageSize={100}
                  columns={queueColumns} 
                  data={queue} 
                  showToolbar={true}
                  showDeleteAction={role === "Admin"}
                  onDeleteSelected={(rows) => setBulkDeleteIds(rows.map(r => r.id))}
                  renderToolbarActions={(selectedRows, clearSelection) => {
                    return (
                      <>
                        {canTakeLeadFromQueue(role) && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-[#0052FF]/30 text-[#0052FF] hover:bg-[#0052FF]/10"
                            onClick={async () => {
                              try {
                                const promises = selectedRows.map(r => 
                                  apiFetch(`${API_URL}/lead-routing/claim/${r.id}`, { 
                                    method: "POST", headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ actioned_by_id: null }) 
                                  })
                                );
                                await Promise.all(promises);
                                toast.success(`${selectedRows.length} lead(s) claimed successfully`);
                                fetchQueue();
                                clearSelection();
                              } catch {
                                toast.error("Failed to claim leads");
                              }
                            }}
                          >
                            Take Lead
                          </Button>
                        )}
                        {role !== "Staff" && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-[#0052FF]/30 text-[#0052FF] hover:bg-[#0052FF]/10"
                            onClick={() => {
                              if (selectedRows.length > 0) {
                                setAssignLeadIds(selectedRows.map((r) => r.id));
                              }
                            }}
                          >
                            Assign Lead
                          </Button>
                        )}
                      </>
                    );
                  }}
                />
                {/* Server-side pagination */}
                {true && (
                  <div className="flex items-center justify-between px-6 pb-24 pt-4 md:py-4 border-t border-border/40 mt-auto sticky bottom-0 bg-card z-30 shadow-[0_-10px_20px_rgba(0,0,0,0.05)] md:shadow-none">
                    <span className="text-sm text-muted-foreground">
                      Showing {queueTotal > 0 ? Math.min((queuePage - 1) * LIMIT + 1, queueTotal) : 0} to {Math.min(queuePage * LIMIT, queueTotal)} of {queueTotal} entries
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
              </div>
              </>
            )}
          </div>
        )}

        {/* Enquiry Tab */}
        {mainTab === "enquiry" && (
          <div className="w-full md:flex-1 md:min-h-0 md:overflow-hidden flex flex-col p-4 md:p-0">
            {enquiryLoading ? (
              <TableSkeleton />
            ) : (
              <>
                <div className="flex-1 min-h-0 overflow-hidden w-full h-full flex flex-col pt-2">
                <DataTable
                  flush={true}
                  hidePagination={true}
                  pageSize={100}
                  columns={enquiryColumns}
                  data={enquiry}
                  showToolbar={true}
                  renderToolbarActions={(selectedRows, clearSelection) => {
                    if (selectedRows.length === 0) return null;
                    return (
                      <>
                        {canTakeLeadFromQueue(role) && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-[#0052FF]/30 text-[#0052FF] hover:bg-[#0052FF]/10"
                            onClick={async () => {
                              // Bulk Take: only unassigned rows are claimable.
                              const takeable = selectedRows.filter((r: EnquiryLead) => r.assigned_staff_id == null);
                              if (takeable.length === 0) {
                                toast.error("Selected enquiries are already assigned");
                                return;
                              }
                              try {
                                const promises = takeable.map(r =>
                                  apiFetch(`${API_URL}/lead-routing/claim/${r.id}`, {
                                    method: "POST", headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ actioned_by_id: null })
                                  })
                                );
                                await Promise.all(promises);
                                toast.success(`${takeable.length} lead(s) claimed successfully`);
                                fetchEnquiry();
                                clearSelection();
                              } catch {
                                toast.error("Failed to claim leads");
                              }
                            }}
                          >
                            Take Selected
                          </Button>
                        )}
                        {role !== "Staff" && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-[#0052FF]/30 text-[#0052FF] hover:bg-[#0052FF]/10"
                            onClick={() => {
                              setAssignLeadIds(selectedRows.map((r: EnquiryLead) => r.id));
                            }}
                          >
                            Assign Selected
                          </Button>
                        )}
                      </>
                    );
                  }}
                />
                {/* Server-side pagination */}
                {true && (
                  <div className="flex items-center justify-between px-6 pb-24 pt-4 md:py-4 border-t border-border/40 mt-auto sticky bottom-0 bg-card z-30 shadow-[0_-10px_20px_rgba(0,0,0,0.05)] md:shadow-none">
                    <span className="text-sm text-muted-foreground">
                      Showing {enquiryTotal > 0 ? Math.min((enquiryPage - 1) * LIMIT + 1, enquiryTotal) : 0} to {Math.min(enquiryPage * LIMIT, enquiryTotal)} of {enquiryTotal} entries
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEnquiryPage((p) => Math.max(1, p - 1))}
                        disabled={enquiryPage <= 1}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEnquiryPage((p) => Math.min(totalEnquiryPages, p + 1))}
                        disabled={enquiryPage >= totalEnquiryPages}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </div>
              </>
            )}
          </div>
        )}

        {/* History Tab */}
        {mainTab === "history" && (
          <div className="w-full md:flex-1 md:min-h-0 md:overflow-hidden flex flex-col p-4 md:p-0">
            {/* Filters */}
            <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide pb-2 md:pb-0 md:flex-wrap md:px-6 md:pt-4">
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
                <div className="flex-1 min-h-0 overflow-hidden w-full h-full flex flex-col pt-2">
                  <DataTable flush={true} hidePagination={true} pageSize={100} columns={historyColumns} data={history} />
                {/* Server-side pagination */}
                {true && (
                  <div className="flex items-center justify-between px-6 pb-24 pt-4 md:py-4 border-t border-border/40 mt-auto sticky bottom-0 bg-card z-30 shadow-[0_-10px_20px_rgba(0,0,0,0.05)] md:shadow-none">
                    <span className="text-sm text-muted-foreground">
                      Showing {historyTotal > 0 ? Math.min((historyPage - 1) * LIMIT + 1, historyTotal) : 0} to {Math.min(historyPage * LIMIT, historyTotal)} of {historyTotal} entries
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
              </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Assign Lead Modal */}
      <AssignLeadModal
        open={assignLeadIds.length > 0}
        onClose={() => setAssignLeadIds([])}
        onConfirm={handleAssignLead}
        leadId={assignLeadIds[0]}
        department={deptTab}
        isLoading={isAssigning}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={deletingId !== null || bulkDeleteIds !== null} onOpenChange={(open) => {
        if (!open) {
          setDeletingId(null);
          setBulkDeleteIds(null);
        }
      }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Lead(s)</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {bulkDeleteIds ? `${bulkDeleteIds.length} lead(s)` : 'this lead'}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => { setDeletingId(null); setBulkDeleteIds(null); }} disabled={isDeletingBulk || deletingId !== null && isDeletingBulk}>Cancel</Button>
            <Button variant="destructive" onClick={bulkDeleteIds ? handleBulkDelete : executeDeleteQueueLead} disabled={isDeletingBulk}>
              {isDeletingBulk || (deletingId !== null && isDeletingBulk) ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </>
  );
}
