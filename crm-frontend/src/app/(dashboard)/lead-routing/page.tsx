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
import { Loader2, RefreshCw, Filter, ChevronDown, Check, X } from "lucide-react";
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
  id: number | null;
  display_id: string;
  enquiry_id: number;
  enquiry_at: string;
  name: string;
  mobile_number: string;
  email: string | null;
  status: string;
  assigned_staff_id: number | null;
  assigned_staff_name: string | null;
  type: "New" | "Repeat";
  repeat_count: number;
  property_code: string | null;
  property_title: string | null;
  intent: string;
  visit_date: string | null;
  visit_slot: string | null;
}

interface MatchedLead {
  name: string;
  mobile_number: string;
  email?: string | null;
  status?: string | null;
  assigned_staff?: { name?: string | null } | null;
  interestedProperty?: { title?: string | null; code?: string | null } | null;
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
  { label: "Auto-transferred", value: "Auto-transferred" },
  { label: "Auto-unassigned", value: "Auto-unassigned" },
  { label: "Claimed", value: "Claimed" },
  { label: "Converted", value: "Converted" },
  { label: "Enquiry Acknowledged", value: "Enquiry Acknowledged" },
  { label: "Enquiry Attached", value: "Enquiry Attached" },
  { label: "Queued", value: "Queued" },
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

function PurposeBadge({ intent }: { intent: string }) {
  const isVisit = intent === "site_visit";
  return (
    <Badge className={`border text-xs whitespace-nowrap ${isVisit ? "bg-violet-100 text-violet-700 border-violet-200" : "bg-slate-100 text-slate-600 border-slate-200"}`}>
      {isVisit ? "Site Visit" : "Enquiry"}
    </Badge>
  );
}

// ── Matched-lead decision dialog ─────────────────────────────────────────────
// Review step for the ✓ action on a matched event: shows the matched lead
// (owner, status, existing property interest) next to the incoming event.
// Accept attaches the event to the lead's Interested In; Acknowledge dismisses
// it. A 409 means someone else already decided the event — the dialog stays
// open and shows who handled it.
function MatchedLeadDialog({
  event,
  lead,
  loading,
  conflict,
  busy,
  onAccept,
  onAcknowledge,
  onClose,
}: {
  event: EnquiryLead | null;
  lead: MatchedLead | null;
  loading: boolean;
  conflict: string | null;
  busy: "accept" | "ack" | null;
  onAccept: () => void;
  onAcknowledge: () => void;
  onClose: () => void;
}) {
  const visitBits = event && event.intent === "site_visit"
    ? [event.visit_date ? String(event.visit_date).slice(0, 10) : null, event.visit_slot ? event.visit_slot.slice(0, 5) : null].filter(Boolean).join(" · ")
    : null;
  return (
    <Dialog open={event != null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Review matched enquiry</DialogTitle>
          <DialogDescription>
            This enquiry matches an existing lead. Add it to their Interested In, or acknowledge it to dismiss.
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 size={16} className="animate-spin" /> Loading lead…
          </div>
        ) : (
          <div className="space-y-4 py-1">
            <div className="rounded-lg border border-border/60 p-3 space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Matched lead</p>
              <p className="font-semibold">{lead?.name || event?.name || "—"}</p>
              <p className="text-sm text-muted-foreground">{lead?.mobile_number || event?.mobile_number || "—"}{lead?.email ? ` · ${lead.email}` : event?.email ? ` · ${event.email}` : ""}</p>
              <div className="flex items-center gap-2 pt-1">
                <Badge variant="outline" className="text-xs whitespace-nowrap">{lead?.status || event?.status || "—"}</Badge>
                {lead?.assigned_staff?.name ? (
                  <span className="text-xs text-muted-foreground">Owner: {lead.assigned_staff.name}</span>
                ) : (
                  <Badge variant="outline" className="text-xs whitespace-nowrap">Unassigned</Badge>
                )}
              </div>
              <div className="pt-1 text-sm">
                <span className="text-muted-foreground">Interested in: </span>
                {lead?.interestedProperty ? (
                  <span className="font-medium">{lead.interestedProperty.title}{lead.interestedProperty.code ? ` (${lead.interestedProperty.code})` : ""}</span>
                ) : (
                  <span className="italic text-muted-foreground">none</span>
                )}
              </div>
            </div>
            <div className="rounded-lg border border-border/60 p-3 space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Incoming enquiry</p>
              <div className="flex items-center gap-2">
                <PurposeBadge intent={event?.intent || ""} />
                <span className="text-sm text-muted-foreground" title={event ? formatDateTime(event.enquiry_at) : undefined}>
                  {event ? (timeAgo(event.enquiry_at) || "—") : "—"}
                </span>
              </div>
              <p className="text-sm font-medium">
                {event?.property_title || "—"}
                {event?.property_code ? <span className="ml-1 font-mono text-xs text-muted-foreground">{event.property_code}</span> : null}
              </p>
              {visitBits ? <p className="text-xs text-muted-foreground">Visit: {visitBits}</p> : null}
            </div>
            {conflict && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">{conflict}</p>
            )}
          </div>
        )}
        <DialogFooter className="mt-2 gap-2 sm:gap-2">
          <Button
            variant="outline"
            className="border-green-500/30 text-green-600 hover:bg-green-500/10"
            disabled={busy != null || loading}
            onClick={onAccept}
          >
            {busy === "accept" ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Add to Interested In
          </Button>
          <Button
            variant="outline"
            className="border-border/60"
            disabled={busy != null || loading}
            onClick={onAcknowledge}
          >
            {busy === "ack" ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
            Acknowledge
          </Button>
          <button
            type="button"
            className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
            onClick={onClose}
          >
            Cancel
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function LeadRoutingPage() {
  const router = useRouter();
  const [role, setRole] = useState<string>("");
  const [userDept, setUserDept] = useState<string>("");

  const [mainTab, setMainTab] = useState<MainTab>("queue");
  const [deptTab, setDeptTab] = useState<DeptTab>("telecalling");

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
  const [enquiryTypeFilter, setEnquiryTypeFilter] = useState("");
  const [enquiryIntentFilter, setEnquiryIntentFilter] = useState("");
  const [enquiryDateFrom, setEnquiryDateFrom] = useState<Date | undefined>(undefined);
  const [enquiryDateTo, setEnquiryDateTo] = useState<Date | undefined>(undefined);
  const enquiryHasFilters =
    enquiryTypeFilter !== "" || enquiryIntentFilter !== "" ||
    enquiryDateFrom !== undefined || enquiryDateTo !== undefined;
  const enquiryActiveFilterCount =
    (enquiryTypeFilter !== "" ? 1 : 0) + (enquiryIntentFilter !== "" ? 1 : 0) +
    (enquiryDateFrom !== undefined ? 1 : 0) + (enquiryDateTo !== undefined ? 1 : 0);
  const [enquiryFilterOpen, setEnquiryFilterOpen] = useState(false);

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

  // Enquiry groups: expand/collapse + selection (tracked by enquiry_id)
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [selectedEnquiryIds, setSelectedEnquiryIds] = useState<number[]>([]);
  const [convertingEnquiryId, setConvertingEnquiryId] = useState<number | null>(null);
  const [ackEnquiryId, setAckEnquiryId] = useState<number | null>(null);
  const [enquiryBulkBusy, setEnquiryBulkBusy] = useState(false);

  // Matched-lead decision dialog
  const [dialogEvent, setDialogEvent] = useState<EnquiryLead | null>(null);
  const [dialogLead, setDialogLead] = useState<any>(null);
  const [dialogLoading, setDialogLoading] = useState(false);
  const [dialogConflict, setDialogConflict] = useState<string | null>(null);
  const [dialogBusy, setDialogBusy] = useState<"accept" | "ack" | null>(null);

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
      if (enquiryTypeFilter) params.set("propertyType", enquiryTypeFilter);
      if (enquiryIntentFilter) params.set("intent", enquiryIntentFilter);
      if (enquiryDateFrom) params.set("dateFrom", format(enquiryDateFrom, "yyyy-MM-dd"));
      if (enquiryDateTo) params.set("dateTo", format(enquiryDateTo, "yyyy-MM-dd"));
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
  }, [enquiryPage, enquiryTypeFilter, enquiryIntentFilter, enquiryDateFrom, enquiryDateTo]);

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

  // Selection/expansion are per result-set; drop them when page/filters change.
  useEffect(() => {
    setSelectedEnquiryIds([]);
    setExpandedGroups({});
  }, [enquiryPage, enquiryTypeFilter, enquiryIntentFilter, enquiryDateFrom, enquiryDateTo]);

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

  // ── Enquiry queue: event decisions ─────────────────────────────────────────
  // Unmatched event → Convert creates an UNASSIGNED lead (lands in the
  // Routing Queue, not with the clicker). Matched events → Accept attaches
  // to the lead's Interested In; Acknowledge dismisses (one click by design,
  // the dialog is the review step for ✓).

  const handleConvertEvent = async (ev: EnquiryLead) => {
    setConvertingEnquiryId(ev.enquiry_id);
    try {
      const res = await apiFetch(`${API_URL}/lead-routing/enquiry-queue/convert/${ev.enquiry_id}`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        toast.success("Converted — lead queued in Routing");
        fetchEnquiry();
      } else {
        toast.error(data.message || data.error || "Failed to convert enquiry");
      }
    } catch {
      toast.error("Failed to convert enquiry");
    } finally {
      setConvertingEnquiryId(null);
    }
  };

  const handleAckEvent = async (ev: EnquiryLead) => {
    setAckEnquiryId(ev.enquiry_id);
    try {
      const res = await apiFetch(`${API_URL}/lead-routing/enquiry-queue/acknowledge/${ev.enquiry_id}`, { method: "POST" });
      const data = await res.json().catch(() => null);
      if (data?.success) {
        toast.success("Enquiry acknowledged");
        fetchEnquiry();
      } else if (res.status === 409) {
        const who = data?.handledBy != null ? ` (handled by #${data.handledBy})` : "";
        toast.error(`${data?.message || "This enquiry was already handled"}${who}`);
        fetchEnquiry();
      } else {
        toast.error(data?.message || data?.error || "Failed to acknowledge enquiry");
      }
    } catch {
      toast.error("Failed to acknowledge enquiry");
    } finally {
      setAckEnquiryId(null);
    }
  };

  const openMatchedDialog = async (ev: EnquiryLead) => {
    if (ev.id == null) return;
    setDialogEvent(ev);
    setDialogConflict(null);
    setDialogLead(null);
    setDialogLoading(true);
    try {
      const res = await apiFetch(`${API_URL}/leads/${ev.id}`);
      const data = await res.json();
      if (data.success) setDialogLead(data.data);
      else toast.error("Failed to load lead details");
    } catch {
      toast.error("Failed to load lead details");
    } finally {
      setDialogLoading(false);
    }
  };

  const closeMatchedDialog = () => {
    if (dialogBusy) return;
    setDialogEvent(null);
    setDialogLead(null);
    setDialogConflict(null);
  };

  const handleDialogAction = async (kind: "accept" | "ack") => {
    if (!dialogEvent) return;
    setDialogBusy(kind);
    try {
      const res = await apiFetch(`${API_URL}/lead-routing/enquiry-queue/${kind}/${dialogEvent.enquiry_id}`, { method: "POST" });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success) {
        toast.success(kind === "accept" ? "Enquiry added to Interested In" : "Enquiry acknowledged");
        setDialogEvent(null);
        setDialogLead(null);
        setDialogConflict(null);
        fetchEnquiry();
      } else if (res.status === 409) {
        const who = data?.handledBy != null ? ` (handled by #${data.handledBy})` : "";
        setDialogConflict(`${data?.message || "This enquiry was already handled"}${who}`);
      } else if (res.status === 403) {
        toast.error(data?.message || "Not allowed");
        setDialogEvent(null);
        setDialogLead(null);
        setDialogConflict(null);
      } else {
        toast.error(data?.message || `Failed to ${kind === "accept" ? "accept" : "acknowledge"} enquiry`);
      }
    } catch {
      toast.error(`Failed to ${kind === "accept" ? "accept" : "acknowledge"} enquiry`);
    } finally {
      setDialogBusy(null);
    }
  };

  const handleBulkConvert = async () => {
    const selected = enquiry.filter((e) => selectedEnquiryIds.includes(e.enquiry_id));
    const unmatched = selected.filter((e) => e.id == null);
    const skipped = selected.length - unmatched.length;
    if (unmatched.length === 0) {
      toast.error("No unmatched enquiries selected");
      return;
    }
    setEnquiryBulkBusy(true);
    let done = 0;
    let failed = 0;
    for (const ev of unmatched) {
      try {
        const res = await apiFetch(`${API_URL}/lead-routing/enquiry-queue/convert/${ev.enquiry_id}`, { method: "POST" });
        const data = await res.json();
        if (data.success) done++;
        else failed++;
      } catch {
        failed++;
      }
    }
    setEnquiryBulkBusy(false);
    if (failed > 0) toast.error(`Failed to convert ${failed} enquir${failed === 1 ? "y" : "ies"}`);
    toast.success(`Converted ${done} — lead(s) queued in Routing${skipped > 0 ? ` (skipped ${skipped} matched)` : ""}`);
    fetchEnquiry();
    setSelectedEnquiryIds([]);
  };

  const handleBulkMatched = async (kind: "accept" | "ack") => {
    const selected = enquiry.filter((e) => selectedEnquiryIds.includes(e.enquiry_id));
    const matched = selected.filter((e) => e.id != null);
    const skipped = selected.length - matched.length;
    if (matched.length === 0) {
      toast.error("No matched enquiries selected");
      return;
    }
    setEnquiryBulkBusy(true);
    let done = 0;
    let failed = 0;
    for (const ev of matched) {
      try {
        const res = await apiFetch(`${API_URL}/lead-routing/enquiry-queue/${kind}/${ev.enquiry_id}`, { method: "POST" });
        const data = await res.json();
        if (data.success) done++;
        else failed++;
      } catch {
        failed++;
      }
    }
    setEnquiryBulkBusy(false);
    if (failed > 0) toast.error(`Failed on ${failed} enquir${failed === 1 ? "y" : "ies"}`);
    toast.success(`${kind === "accept" ? "Accepted" : "Acknowledged"} ${done} enquir${done === 1 ? "y" : "ies"}${skipped > 0 ? ` (skipped ${skipped} unmatched)` : ""}`);
    fetchEnquiry();
    setSelectedEnquiryIds([]);
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

  // ── Enquiry queue: client-side grouping ────────────────────────────────────
  // One row per open event; groups keyed by matched lead (L<id>) or by mobile
  // for unmatched events. Groups render collapsed by default, one tap expands.
  interface EnquiryGroup {
    key: string;
    matched: boolean;
    leadId: number | null;
    rows: EnquiryLead[];
  }

  const enquiryGroups = useMemo<EnquiryGroup[]>(() => {
    const map = new Map<string, EnquiryLead[]>();
    for (const e of enquiry) {
      const key = e.id != null ? `L${e.id}` : `MOBILE:${e.mobile_number}`;
      const arr = map.get(key);
      if (arr) arr.push(e);
      else map.set(key, [e]);
    }
    return [...map.entries()].map(([key, rows]) => ({
      key,
      matched: rows[0].id != null,
      leadId: rows[0].id,
      rows,
    }));
  }, [enquiry]);

  const toggleGroup = (key: string) =>
    setExpandedGroups((prev) => ({ ...prev, [key]: !prev[key] }));

  const toggleEventSelection = (enquiryId: number) =>
    setSelectedEnquiryIds((prev) =>
      prev.includes(enquiryId) ? prev.filter((id) => id !== enquiryId) : [...prev, enquiryId]
    );

  const toggleGroupSelection = (group: EnquiryGroup) => {
    const ids = group.rows.map((r) => r.enquiry_id);
    setSelectedEnquiryIds((prev) => {
      const allSelected = ids.every((id) => prev.includes(id));
      if (allSelected) return prev.filter((id) => !ids.includes(id));
      return [...new Set([...prev, ...ids])];
    });
  };

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

          {mainTab === "enquiry" && (
            <div className="relative pb-3 sm:pb-4">
              <Button
                variant="outline"
                size="sm"
                className="h-9 gap-2 border-border/60"
                onClick={() => setEnquiryFilterOpen((o) => !o)}
              >
                <Filter className="h-4 w-4 text-muted-foreground" />
                Filters
                {enquiryActiveFilterCount > 0 && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#0052FF] text-[11px] font-semibold text-white">
                    {enquiryActiveFilterCount}
                  </span>
                )}
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${enquiryFilterOpen ? "rotate-180" : ""}`} />
              </Button>

              {enquiryFilterOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setEnquiryFilterOpen(false)}
                  />
                  <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-xl border border-border bg-card p-4 shadow-lg space-y-4">
                    <div className="space-y-1.5">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Property Type</p>
                      <FormSelect
                        name="enquiryPropertyType"
                        options={[
                          { label: "Apartment", value: "apartment" },
                          { label: "Villa", value: "villa" },
                          { label: "Individual House", value: "individual_portion" },
                          { label: "Plot", value: "plot" },
                          { label: "Commercial", value: "commercial" },
                          { label: "Farmland", value: "farmland" },
                        ]}
                        value={enquiryTypeFilter}
                        onValueChange={(v) => { setEnquiryTypeFilter(v || ""); setEnquiryPage(1); }}
                        placeholder="All Types"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Purpose</p>
                      <FormSelect
                        name="enquiryIntent"
                        options={[
                          { label: "Enquiry", value: "enquiry" },
                          { label: "Site Visit", value: "site_visit" },
                        ]}
                        value={enquiryIntentFilter}
                        onValueChange={(v) => { setEnquiryIntentFilter(v || ""); setEnquiryPage(1); }}
                        placeholder="All Purposes"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Enquiry Date</p>
                      <div className="space-y-2">
                        <DatePicker
                          value={enquiryDateFrom}
                          onChange={(d) => { setEnquiryDateFrom(d); setEnquiryPage(1); }}
                          placeholder="From date"
                          className="w-full"
                        />
                        <DatePicker
                          value={enquiryDateTo}
                          onChange={(d) => { setEnquiryDateTo(d); setEnquiryPage(1); }}
                          placeholder="To date"
                          className="w-full"
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-muted-foreground hover:text-red-500"
                        disabled={!enquiryHasFilters}
                        onClick={() => {
                          setEnquiryTypeFilter("");
                          setEnquiryIntentFilter("");
                          setEnquiryDateFrom(undefined);
                          setEnquiryDateTo(undefined);
                          setEnquiryPage(1);
                        }}
                      >
                        Clear all
                      </Button>
                      <Button
                        size="sm"
                        className="h-8"
                        onClick={() => setEnquiryFilterOpen(false)}
                      >
                        Done
                      </Button>
                    </div>
                  </div>
                </>
              )}
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
                <div className="flex-1 min-h-0 overflow-y-auto w-full h-full flex flex-col pt-2">
                {/* Bulk toolbar */}
                {selectedEnquiryIds.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap px-4 md:px-6 pb-3">
                    <span className="text-sm text-muted-foreground">{selectedEnquiryIds.length} selected</span>
                    {canTakeLeadFromQueue(role) && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-[#0052FF]/30 text-[#0052FF] hover:bg-[#0052FF]/10"
                        disabled={enquiryBulkBusy}
                        onClick={handleBulkConvert}
                      >
                        Convert Selected
                      </Button>
                    )}
                    {role !== "Staff" && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-green-500/30 text-green-600 hover:bg-green-500/10"
                          disabled={enquiryBulkBusy}
                          onClick={() => handleBulkMatched("accept")}
                        >
                          Accept Selected
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-border/60"
                          disabled={enquiryBulkBusy}
                          onClick={() => handleBulkMatched("ack")}
                        >
                          Acknowledge Selected
                        </Button>
                      </>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => setSelectedEnquiryIds([])}>
                      Clear
                    </Button>
                  </div>
                )}
                {/* Grouped open events */}
                {enquiryGroups.length === 0 ? (
                  <p className="px-4 md:px-6 py-8 text-sm text-muted-foreground text-center">No open enquiries.</p>
                ) : (
                  <div className="divide-y divide-border/40">
                    {enquiryGroups.map((group) => {
                      const first = group.rows[0];
                      const expanded = !!expandedGroups[group.key];
                      const ids = group.rows.map((r) => r.enquiry_id);
                      const selectedCount = ids.filter((id) => selectedEnquiryIds.includes(id)).length;
                      const isRepeat = first.type === "Repeat";
                      return (
                        <div key={group.key}>
                          <div
                            className="flex items-center gap-2 sm:gap-3 px-4 md:px-6 py-3 cursor-pointer hover:bg-muted/40"
                            onClick={() => toggleGroup(group.key)}
                          >
                            <div onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                checked={selectedCount === ids.length}
                                indeterminate={selectedCount > 0 && selectedCount < ids.length}
                                onCheckedChange={() => toggleGroupSelection(group)}
                                aria-label={`Select ${first.name}`}
                                className="data-[state=checked]:bg-[#0052FF] data-[state=checked]:border-[#0052FF]"
                              />
                            </div>
                            <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`} />
                            <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center font-bold text-xs text-blue-900 dark:text-blue-300 shrink-0">
                              {first.name?.charAt(0)?.toUpperCase() ?? "?"}
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="font-medium truncate">{first.name}</span>
                              <span className="text-xs text-muted-foreground">{first.mobile_number}</span>
                            </div>
                            {group.matched ? (
                              <span
                                onClick={(e) => { e.stopPropagation(); router.push(`/leads/${group.leadId}`); }}
                                className="font-mono text-[13px] text-[#0052FF] font-medium cursor-pointer hover:underline shrink-0"
                              >
                                {first.display_id}
                              </span>
                            ) : (
                              <span className="font-mono text-[13px] text-muted-foreground shrink-0">{first.display_id}</span>
                            )}
                            <Badge className={`border text-xs shrink-0 ${isRepeat ? "bg-amber-100 text-amber-700 border-amber-200" : "bg-blue-100 text-blue-700 border-blue-200"}`}>
                              {first.type}
                            </Badge>
                            <span className="text-xs text-muted-foreground whitespace-nowrap" title="Open events for this lead">
                              ×{first.repeat_count}
                            </span>
                            {first.assigned_staff_name ? (
                              <span className="text-xs truncate hidden sm:inline">{first.assigned_staff_name}</span>
                            ) : (
                              <Badge variant="outline" className="text-xs whitespace-nowrap hidden sm:inline-flex">
                                Unassigned
                              </Badge>
                            )}
                            <span className="ml-auto text-xs text-muted-foreground whitespace-nowrap shrink-0">
                              {group.rows.length} event{group.rows.length === 1 ? "" : "s"}
                            </span>
                          </div>
                          {expanded && (
                            <div className="bg-muted/20">
                              {group.rows.map((ev) => (
                                <div
                                  key={ev.enquiry_id}
                                  className="flex items-center gap-2 sm:gap-3 pl-11 md:pl-14 pr-4 md:pr-6 py-2.5 border-t border-border/30"
                                  title={ev.id != null && role === "Staff" ? "Only team leads and above can action matched enquiries" : undefined}
                                >
                                  <Checkbox
                                    checked={selectedEnquiryIds.includes(ev.enquiry_id)}
                                    onCheckedChange={() => toggleEventSelection(ev.enquiry_id)}
                                    aria-label="Select enquiry"
                                    className="data-[state=checked]:bg-[#0052FF] data-[state=checked]:border-[#0052FF] shrink-0"
                                  />
                                  <span className="text-sm whitespace-nowrap shrink-0" title={formatDateTime(ev.enquiry_at)}>
                                    {timeAgo(ev.enquiry_at) || "—"}
                                  </span>
                                  <div className="flex flex-col min-w-0 flex-1">
                                    <span className="text-sm font-medium truncate">
                                      {ev.property_title || "—"}
                                      {ev.intent === "site_visit" && ev.visit_slot ? ` ${ev.visit_slot.slice(0, 5)}` : ""}
                                    </span>
                                    {ev.property_code && (
                                      <span className="text-xs text-muted-foreground font-mono">{ev.property_code}</span>
                                    )}
                                  </div>
                                  <PurposeBadge intent={ev.intent} />
                                  <div className="flex items-center gap-1 shrink-0">
                                    {ev.id == null ? (
                                      canTakeLeadFromQueue(role) ? (
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="border-[#0052FF]/30 text-[#0052FF] hover:bg-[#0052FF]/10"
                                          disabled={convertingEnquiryId === ev.enquiry_id}
                                          onClick={() => handleConvertEvent(ev)}
                                        >
                                          {convertingEnquiryId === ev.enquiry_id ? <Loader2 size={14} className="animate-spin" /> : "Convert"}
                                        </Button>
                                      ) : null
                                    ) : role !== "Staff" ? (
                                      <>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-8 w-8 text-green-600 hover:bg-green-500/10"
                                          aria-label="Add to Interested In"
                                          title="Add to Interested In"
                                          onClick={() => openMatchedDialog(ev)}
                                        >
                                          <Check size={16} />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-8 w-8 text-muted-foreground hover:text-red-500"
                                          aria-label="Acknowledge"
                                          title="Acknowledge"
                                          disabled={ackEnquiryId === ev.enquiry_id}
                                          onClick={() => handleAckEvent(ev)}
                                        >
                                          {ackEnquiryId === ev.enquiry_id ? <Loader2 size={14} className="animate-spin" /> : <X size={16} />}
                                        </Button>
                                      </>
                                    ) : null}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
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

      {/* Matched-lead decision dialog */}
      <MatchedLeadDialog
        event={dialogEvent}
        lead={dialogLead}
        loading={dialogLoading}
        conflict={dialogConflict}
        busy={dialogBusy}
        onAccept={() => handleDialogAction("accept")}
        onAcknowledge={() => handleDialogAction("ack")}
        onClose={closeMatchedDialog}
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
