"use client";

import { isAdmin } from "@/lib/permissions";
import { apiFetch } from "@/lib/api-fetch";
import { normalizeDepartment } from "@/lib/department";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { DataTable } from "@/components/tables/data-table";
import { DateCell, IdCell, NameCell, StatusCell, formatTableDate, statusDot, type StatusTone } from "@/components/tables/cells";
import { BOARD_PAGE, ModuleViews, useModuleView, type ViewField } from "@/components/views/module-views";
import { LEAD_STATUS_DOTS, LEAD_STATUS_ORDER, leadStatusPill } from "@/lib/lead-constants";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { Checkbox } from "@/components/ui/checkbox";
import type { ColumnDef, PaginationState } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Filter, ChevronDown, Check, X } from "lucide-react";
import { toast } from "sonner";
import { TableSkeleton } from "@/components/tables/table-skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { AssignLeadModal } from "@/components/shared/assign-lead-modal";
import { FormSelect } from "@/components/shared/form-select";
import { DatePicker } from "@/components/shared/date-picker";
import { MobileHeader } from "@/components/layout/mobile-header";
import { SegmentTabs, toolbarButtonClass } from "@/components/layout/list-page";
import { canTakeLeadFromQueue, canConvertEnquiry, assignRoutingLeads } from "@/lib/lead-routing";
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
  /** Website form it came from, e.g. "Website – Liaisoning page". */
  source: string;
  /** What the visitor typed (service-page and contact forms only). */
  message: string | null;
}

/** Website forms that feed the enquiry queue; values match the CRM's lead sources. */
const ENQUIRY_SOURCE_OPTIONS = [
  "Website – Project page",
  "Website – Property page",
  "Website – Liaisoning page",
  "Website – Property Management page",
  "Website – Brokerage page",
  "Website – NRI Services page",
  "Website – Financial Assistance page",
  "Website – Contact page",
  "Website – Enquiry form",
].map((value) => ({ label: value.replace(/^Website – /, ""), value }));

/** "Website – Liaisoning page" → "Liaisoning page". */
const sourceLabel = (source: string) => source.replace(/^Website – /, "");

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
  from_user?: { name: string } | null;
  to_user?: { name: string } | null;
  department?: string | null;
  feedback?: string | null;
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

const EVENT_TONES: Record<string, StatusTone> = { assigned: "blue", claimed: "green", released: "amber", converted: "violet" };

const QUEUE_FIELDS: ViewField<QueueLead>[] = [
  { id: "status", label: "Last status", get: (l) => l.status, order: LEAD_STATUS_ORDER, dot: (v) => LEAD_STATUS_DOTS[v] ?? "bg-gray-400" },
  { id: "held_by", label: "Previously held by", get: (l) => l.previously_held_by },
  { id: "reason", label: "Release reason", get: (l) => l.release_reason },
];

const ENQUIRY_FIELDS: ViewField<EnquiryLead>[] = [
  { id: "type", label: "Type", get: (e) => e.type, order: ["New", "Repeat"], dot: (v) => statusDot(v, v === "Repeat" ? "amber" : "blue") },
  { id: "intent", label: "Purpose", get: (e) => (e.intent === "site_visit" ? "Site Visit" : "Enquiry"), dot: (v) => statusDot(v, v === "Site Visit" ? "violet" : "gray") },
  { id: "assigned", label: "Assigned", get: (e) => e.assigned_staff_name || "Unassigned" },
  { id: "source", label: "Source", get: (e) => sourceLabel(e.source) },
];

const HISTORY_FIELDS: ViewField<HistoryEntry>[] = [
  { id: "event", label: "Event type", get: (h) => h.event_type, dot: (v) => statusDot(v, EVENT_TONES[v.toLowerCase()] ?? "gray"), capitalize: true },
  { id: "to_staff", label: "To staff", get: (h) => h.to_user?.name },
  { id: "department", label: "Department", get: (h) => h.department, capitalize: true },
];

type PaginationUpdate = PaginationState | ((old: PaginationState) => PaginationState);

function formatDateTime(d?: string) {
  if (!d) return "—";
  const dt = new Date(d);
  return dt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) +
    " " + dt.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true });
}

function PurposeBadge({ intent }: { intent: string }) {
  const isVisit = intent === "site_visit";
  return <StatusCell status={isVisit ? "Site Visit" : "Enquiry"} tone={isVisit ? "violet" : "gray"} />;
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
                {event?.property_title || (event?.property_code ? null : event ? sourceLabel(event.source) : "—")}
                {event?.property_code ? <span className="ml-1 font-mono text-xs text-muted-foreground">{event.property_code}</span> : null}
              </p>
              {event?.message ? (
                <p className="whitespace-pre-line text-sm text-muted-foreground">&ldquo;{event.message}&rdquo;</p>
              ) : null}
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

const reviveDate = (v: unknown) => {
  if (typeof v !== "string") return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
};

export default function LeadRoutingPage() {
  const router = useRouter();
  const [role, setRole] = useState<string>("");
  const [userDept, setUserDept] = useState<string>("");
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);

  const [mainTab, setMainTab] = usePersistedState<MainTab>("routing:tab", "queue", { allowed: ["queue", "enquiry", "history"] });
  const queueView = useModuleView("routing-queue", QUEUE_FIELDS);
  const enquiryView = useModuleView("routing-enquiry", ENQUIRY_FIELDS);
  const historyView = useModuleView("routing-history", HISTORY_FIELDS);
  const activeView = mainTab === "queue" ? queueView : mainTab === "enquiry" ? enquiryView : historyView;
  const [deptTab, setDeptTab] = usePersistedState<DeptTab>("routing:dept", "telecalling", { allowed: ["telecalling", "sales"] });

  // Queue state
  const [queue, setQueue] = useState<QueueLead[]>([]);
  const [queueLoading, setQueueLoading] = useState(false);
  const [queuePage, setQueuePage] = usePersistedState("routing:queuePage", 1);
  const [queueTotal, setQueueTotal] = useState(0);
  const LIMIT = 10;

  // Enquiry queue state
  const [enquiry, setEnquiry] = useState<EnquiryLead[]>([]);
  const [enquiryLoading, setEnquiryLoading] = useState(false);
  const [enquiryPage, setEnquiryPage] = usePersistedState("routing:enquiryPage", 1);
  const [enquiryTotal, setEnquiryTotal] = useState(0);
  const [enquiryTypeFilter, setEnquiryTypeFilter] = usePersistedState("routing:enquiryType", "");
  const [enquiryIntentFilter, setEnquiryIntentFilter] = usePersistedState("routing:enquiryIntent", "");
  const [enquirySourceFilter, setEnquirySourceFilter] = usePersistedState("routing:enquirySource", "");
  const [enquiryDateFrom, setEnquiryDateFrom] = usePersistedState<Date | undefined>("routing:enquiryFrom", undefined, { deserialize: reviveDate });
  const [enquiryDateTo, setEnquiryDateTo] = usePersistedState<Date | undefined>("routing:enquiryTo", undefined, { deserialize: reviveDate });
  const enquiryHasFilters =
    enquiryTypeFilter !== "" || enquiryIntentFilter !== "" || enquirySourceFilter !== "" ||
    enquiryDateFrom !== undefined || enquiryDateTo !== undefined;
  const enquiryActiveFilterCount =
    (enquiryTypeFilter !== "" ? 1 : 0) + (enquiryIntentFilter !== "" ? 1 : 0) +
    (enquirySourceFilter !== "" ? 1 : 0) +
    (enquiryDateFrom !== undefined ? 1 : 0) + (enquiryDateTo !== undefined ? 1 : 0);
  const [enquiryFilterOpen, setEnquiryFilterOpen] = useState(false);

  // History state
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyPage, setHistoryPage] = usePersistedState("routing:historyPage", 1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyEventFilter, setHistoryEventFilter] = usePersistedState("routing:historyEvent", "");
  const [historyDateFrom, setHistoryDateFrom] = usePersistedState<Date | undefined>("routing:historyFrom", undefined, { deserialize: reviveDate });
  const [historyDateTo, setHistoryDateTo] = usePersistedState<Date | undefined>("routing:historyTo", undefined, { deserialize: reviveDate });

  // Assign lead modal
  const [assignLeadIds, setAssignLeadIds] = useState<number[]>([]);
  const [isAssigning, setIsAssigning] = useState(false);

  // Enquiry per-row spinners + bulk busy flag (selection lives in DataTable)
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
        const deptName = normalizeDepartment(user?.department?.name || user?.department);
        if (user?.id != null) setCurrentUserId(Number(user.id));
        setRole(roleName);
        setUserDept(deptName);
        if (roleName === "Staff") {
          setDeptTab(deptName);
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
        page: String(queueView.isBoard ? 1 : queuePage),
        limit: String(queueView.isBoard ? BOARD_PAGE.pageSize : LIMIT),
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
  }, [deptTab, queuePage, queueView.isBoard]);

  const fetchEnquiry = useCallback(async () => {
    setEnquiryLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(enquiryView.isBoard ? 1 : enquiryPage),
        limit: String(enquiryView.isBoard ? BOARD_PAGE.pageSize : LIMIT),
      });
      if (enquiryTypeFilter) params.set("propertyType", enquiryTypeFilter);
      if (enquiryIntentFilter) params.set("intent", enquiryIntentFilter);
      if (enquirySourceFilter) params.set("source", enquirySourceFilter);
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
  }, [enquiryPage, enquiryTypeFilter, enquiryIntentFilter, enquirySourceFilter, enquiryDateFrom, enquiryDateTo, enquiryView.isBoard]);

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(historyView.isBoard ? 1 : historyPage),
        limit: String(historyView.isBoard ? BOARD_PAGE.pageSize : LIMIT),
      });
      if (historyEventFilter) params.set("event_type", historyEventFilter);
      if (historyDateFrom) params.set("from_date", format(historyDateFrom, "yyyy-MM-dd"));
      if (historyDateTo) params.set("to_date", format(historyDateTo, "yyyy-MM-dd"));
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
  }, [historyPage, historyEventFilter, historyDateFrom, historyDateTo, historyView.isBoard]);

  useEffect(() => {
    if (mainTab === "queue") fetchQueue();
  }, [mainTab, fetchQueue]);

  useEffect(() => {
    if (mainTab === "enquiry") fetchEnquiry();
  }, [mainTab, fetchEnquiry]);

  useEffect(() => {
    if (mainTab === "history") fetchHistory();
  }, [mainTab, fetchHistory]);

  // When dept tab changes, reset page and refetch — but not on mount, or the
  // restored page would be wiped every time staff come back to this screen.
  const prevDeptTabRef = useRef(deptTab);
  useEffect(() => {
    if (prevDeptTabRef.current === deptTab) return;
    prevDeptTabRef.current = deptTab;
    setQueuePage(1);
  }, [deptTab, setQueuePage]);

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
      // Backend route is `acknowledge`, not `ack` (the `kind` shorthand is UI-only).
      const segment = kind === "accept" ? "accept" : "acknowledge";
      const res = await apiFetch(`${API_URL}/lead-routing/enquiry-queue/${segment}/${dialogEvent.enquiry_id}`, { method: "POST" });
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

  const handleBulkConvert = async (rows: EnquiryLead[], clearSelection: () => void) => {
    const unmatched = rows.filter((e) => e.id == null);
    const skipped = rows.length - unmatched.length;
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
    clearSelection();
  };

  const handleBulkMatched = async (kind: "accept" | "ack", rows: EnquiryLead[], clearSelection: () => void) => {
    const matched = rows.filter((e) => e.id != null);
    const skipped = rows.length - matched.length;
    if (matched.length === 0) {
      toast.error("No matched enquiries selected");
      return;
    }
    setEnquiryBulkBusy(true);
    let done = 0;
    let failed = 0;
    for (const ev of matched) {
      try {
        // Backend route is `acknowledge`, not `ack` (the `kind` shorthand is UI-only).
        const segment = kind === "accept" ? "accept" : "acknowledge";
        const res = await apiFetch(`${API_URL}/lead-routing/enquiry-queue/${segment}/${ev.enquiry_id}`, { method: "POST" });
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
    clearSelection();
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
      header: "ID",
      cell: ({ row }) => (
        <IdCell href={`/leads/${row.original.id}`}>{row.original.display_id || `L${String(row.original.id).padStart(5, "0")}`}</IdCell>
      ),
    },
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => (
        <NameCell name={row.original.name} avatar />
      ),
    },
    {
      accessorKey: "mobile_number",
      header: "Mobile",
      cell: ({ row }) => <span className="tabular-nums">{row.original.mobile_number || "—"}</span>,
    },
    {
      accessorKey: "status",
      header: "Last Status",
      cell: ({ row }) => (
        <StatusCell status={row.original.status} pillClass={leadStatusPill(row.original.status)} />
      ),
    },
    {
      accessorKey: "last_follow_up_date",
      header: "Last Follow-up",
      cell: ({ row }) => <DateCell value={row.original.last_follow_up_date} />,
    },
    {
      accessorKey: "previously_held_by",
      header: "Previously Held By",
      cell: ({ row }) => <span>{row.original.previously_held_by || "—"}</span>,
    },
    {
      accessorKey: "release_reason",
      header: "Release Reason",
      cell: ({ row }) => (
        <span className="block max-w-[160px] truncate text-muted-foreground">
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
          <span className={`tabular-nums ${days > 7 ? "text-rose-600 dark:text-rose-400" : days > 3 ? "text-amber-600 dark:text-amber-400" : "text-foreground"}`}>
            {days}d
          </span>
        );
      },
    },
  ], [role, router]);

  // ── Enquiry queue: group-adjacent ordering ─────────────────────────────────
  // One row per open event. Same-person events stay adjacent (stable group by
  // first-seen — the server already sends newest-first, so group recency is
  // preserved) with the shared repeat count on each row.
  const groupedEnquiry = useMemo<EnquiryLead[]>(() => {
    const seen = new Set<string>();
    const order: string[] = [];
    const keyOf = (e: EnquiryLead) => (e.id != null ? `L${e.id}` : `MOBILE:${e.mobile_number}`);
    for (const e of enquiry) {
      const k = keyOf(e);
      if (!seen.has(k)) {
        seen.add(k);
        order.push(k);
      }
    }
    const rank = new Map(order.map((k, i) => [k, i]));
    return [...enquiry].sort((a, b) => (rank.get(keyOf(a)) ?? 0) - (rank.get(keyOf(b)) ?? 0));
  }, [enquiry]);

  // ── Enquiry queue columns ────────────────────────────────────────────────
  // Same DataTable vocabulary as the Routing Queue tab: select, linked Lead
  // ID, avatar Name, Mobile, Type + Purpose badges, Property, Enquired On,
  // Assigned, row Actions. One row per open event; same-lead events are kept
  // adjacent (groupedEnquiry) with the shared repeat count on each row.
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
            aria-label="Select enquiry"
            className="data-[state=checked]:bg-[#0052FF] data-[state=checked]:border-[#0052FF]"
          />
        </div>
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "display_id",
      header: "ID",
      cell: ({ row }) => {
        const ev = row.original;
        return <IdCell href={ev.id != null ? `/leads/${ev.id}` : undefined}>{ev.display_id}</IdCell>;
      },
    },
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => (
        <NameCell name={row.original.name} avatar />
      ),
    },
    {
      accessorKey: "mobile_number",
      header: "Mobile",
      cell: ({ row }) => <span className="tabular-nums">{row.original.mobile_number || "—"}</span>,
    },
    {
      accessorKey: "type",
      header: "Type",
      cell: ({ row }) => {
        const isRepeat = row.original.type === "Repeat";
        return <StatusCell status={row.original.type} tone={isRepeat ? "amber" : "blue"} />;
      },
    },
    {
      accessorKey: "intent",
      header: "Purpose",
      cell: ({ row }) => <PurposeBadge intent={row.original.intent} />,
    },
    {
      id: "property",
      header: "Property / Source",
      cell: ({ row }) => {
        const ev = row.original;
        // General website enquiries have no property: show the form they came
        // from and what the visitor wrote.
        if (!ev.property_title && !ev.property_code) {
          return (
            <div className="flex max-w-[260px] flex-col">
              <span className="text-sm font-medium">{sourceLabel(ev.source)}</span>
              {ev.message && (
                <span className="line-clamp-2 text-xs text-muted-foreground" title={ev.message}>
                  {ev.message}
                </span>
              )}
            </div>
          );
        }
        if (!ev.property_title) {
          return <span className="text-xs text-muted-foreground font-mono">{ev.property_code}</span>;
        }
        const slot = ev.intent === "site_visit" && ev.visit_slot ? ` ${ev.visit_slot.slice(0, 5)}` : "";
        return (
          <div className="flex flex-col">
            <span className="text-sm font-medium">{ev.property_title}{slot}</span>
            {ev.property_code && (
              <span className="text-xs text-muted-foreground font-mono">{ev.property_code}</span>
            )}
          </div>
        );
      },
    },
    {
      id: "assigned",
      header: "Assigned",
      cell: ({ row }) => {
        const ev = row.original;
        return ev.assigned_staff_name ? (
          <span className="truncate">{ev.assigned_staff_name}</span>
        ) : (
          <span className="text-muted-foreground">Unassigned</span>
        );
      },
    },
    {
      accessorKey: "enquiry_at",
      header: "Enquired On",
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-muted-foreground" title={formatDateTime(row.original.enquiry_at)}>
          {timeAgo(row.original.enquiry_at) || "—"}
        </span>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const ev = row.original;
        const isOwner = currentUserId != null && Number(ev.assigned_staff_id) === currentUserId;
        return (
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            {ev.id == null ? (
              canConvertEnquiry(role) ? (
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
                  title="Review matched enquiry"
                  onClick={() => openMatchedDialog(ev)}
                >
                  <Check size={16} />
                </Button>
                {isOwner && (
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
                )}
              </>
            ) : null}
          </div>
        );
      },
    },
  ], [role, router, convertingEnquiryId, ackEnquiryId, currentUserId]);

  const historyColumns = useMemo<ColumnDef<HistoryEntry>[]>(() => [
    {
      id: "lead_name",
      header: "Lead",
      cell: ({ row }) => {
        if (row.original.lead?.id) {
          return (
            <Link href={`/leads/${row.original.lead.id}`} className="hover:underline">
              <NameCell name={row.original.lead?.name} avatar />
            </Link>
          );
        }
        return <NameCell name={row.original.lead?.name} avatar />;
      },
    },
    {
      accessorKey: "event_type",
      header: "Event Type",
      cell: ({ row }) => {
        const evt = row.original.event_type || "";
        return <span className="capitalize"><StatusCell status={evt} tone={EVENT_TONES[evt.toLowerCase()] ?? "gray"} /></span>;
      },
    },
    {
      id: "from_staff",
      header: "From Staff",
      cell: ({ row }) => <span>{row.original.from_user?.name || "—"}</span>,
    },
    {
      id: "to_staff",
      header: "To Staff",
      cell: ({ row }) => <span>{row.original.to_user?.name || "—"}</span>,
    },
    {
      id: "department",
      header: "Department",
      cell: ({ row }) => (
        <span className="capitalize">{row.original.department || "—"}</span>
      ),
    },
    {
      accessorKey: "feedback",
      header: "Feedback",
      cell: ({ row }) => (
        <span className="block max-w-[220px] truncate text-muted-foreground">
          {row.original.feedback || "—"}
        </span>
      ),
    },
    {
      accessorKey: "created_at",
      header: "Date",
      cell: ({ row }) => <DateCell value={row.original.created_at} withTime />,
    },
  ], [router]);

  const deptTabs: { label: string; value: DeptTab }[] = [
    { label: "Telecalling Queue", value: "telecalling" },
    { label: "Sales Queue", value: "sales" },
  ];

  const visibleDeptTabs = role === "Staff"
    ? deptTabs.filter((d) => d.value === (userDept || "telecalling"))
    : deptTabs;

  const totalQueuePages = Math.max(1, Math.ceil(queueTotal / LIMIT));
  const totalEnquiryPages = Math.max(1, Math.ceil(enquiryTotal / LIMIT));
  const totalHistoryPages = Math.max(1, Math.ceil(historyTotal / LIMIT));

  return (
    <>
      <MobileHeader title="Lead Routing" />
      {activeView.switcher}
      <div className="w-full flex flex-col space-y-4 pt-4 md:space-y-0 md:pt-0 md:h-full">
        <div className="flex flex-col md:min-h-0 md:flex-1 lg:-mx-6 lg:-mb-8 lg:-mt-6">
        <div className="flex flex-wrap items-center gap-2 px-4 pb-2 pt-3 md:px-5">
          <SegmentTabs
            label="Routing views"
            value={mainTab}
            onChange={setMainTab}
            tabs={[
              { value: "queue", label: "Routing Queue" },
              { value: "enquiry", label: "Enquiry Queue" },
              { value: "history", label: "Routing History" },
            ]}
          />

          {mainTab === "queue" && visibleDeptTabs.length > 1 && (
            <SegmentTabs label="Pipeline" value={deptTab} onChange={setDeptTab} tabs={visibleDeptTabs.map((d) => ({ value: d.value, label: d.label }))} />
          )}

          {activeView.picker && <div className="ml-auto">{activeView.picker}</div>}

          {mainTab === "enquiry" && (
            <div className={activeView.picker ? "relative" : "relative ml-auto"}>
              <button
                type="button"
                className={toolbarButtonClass}
                data-state={enquiryFilterOpen ? "open" : undefined}
                onClick={() => setEnquiryFilterOpen((o) => !o)}
              >
                <Filter className="size-4 text-muted-foreground" strokeWidth={1.75} />
                Filter
                {enquiryActiveFilterCount > 0 && (
                  <span className="rounded bg-[#017D58] px-1.5 text-[11px] font-medium leading-[18px] text-white">
                    {enquiryActiveFilterCount}
                  </span>
                )}
                <ChevronDown className={`size-3.5 text-muted-foreground transition-transform ${enquiryFilterOpen ? "rotate-180" : ""}`} />
              </button>

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
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Source</p>
                      <FormSelect
                        name="enquirySource"
                        options={ENQUIRY_SOURCE_OPTIONS}
                        value={enquirySourceFilter}
                        onValueChange={(v) => { setEnquirySourceFilter(v || ""); setEnquiryPage(1); }}
                        placeholder="All Sources"
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
                          setEnquirySourceFilter("");
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
                <ModuleViews
                  state={queueView}
                  data={queue}
                  columns={queueColumns}
                  list={
                    <DataTable
                    variant="list"
                    flush={true}
  manualPagination
                    pageCount={totalQueuePages}
                    totalCount={queueTotal}
                    pagination={{ pageIndex: queuePage - 1, pageSize: LIMIT }}
                    onPaginationChange={(u: PaginationUpdate) => setQueuePage((p) => (typeof u === "function" ? u({ pageIndex: p - 1, pageSize: LIMIT }) : u).pageIndex + 1)}
                    pageSizeOptions={[LIMIT]}
                    persistKey="queue"
                    columns={queueColumns} 
                    data={queue} 
                    showToolbar={true}
                    showDeleteAction={isAdmin({ role })}
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
                  }
                  getKey={(l) => l.id}
                  onOpen={(l) => router.push(`/leads/${l.id}`)}
                  card={(l) => ({ title: l.name, id: l.display_id || `L${String(l.id).padStart(5, "0")}`, href: `/leads/${l.id}`, subtitle: l.mobile_number, footer: l.previously_held_by ? `Held by ${l.previously_held_by}` : undefined, tag: `${l.days_in_queue ?? 0}d in queue` })}
                  totalCount={queueTotal}
                  noun="leads"
                />
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
                {groupedEnquiry.length === 0 ? (
                  <EmptyState kind="inbox" title="No open enquiries" description="New website and app enquiries will show up here." />
                ) : (
                <ModuleViews
                  state={enquiryView}
                  data={groupedEnquiry}
                  columns={enquiryColumns}
                  list={
                    <DataTable
                    variant="list"
                    flush={true}
  manualPagination
                    pageCount={totalEnquiryPages}
                    totalCount={enquiryTotal}
                    pagination={{ pageIndex: enquiryPage - 1, pageSize: LIMIT }}
                    onPaginationChange={(u: PaginationUpdate) => setEnquiryPage((p) => (typeof u === "function" ? u({ pageIndex: p - 1, pageSize: LIMIT }) : u).pageIndex + 1)}
                    pageSizeOptions={[LIMIT]}
                    persistKey="enquiry"
                    columns={enquiryColumns}
                    data={groupedEnquiry}
                    showToolbar={true}
                    renderToolbarActions={(selectedRows, clearSelection) => {
                      if (selectedRows.length === 0) return null;
                      return (
                        <>
                          <span className="text-sm text-muted-foreground">{selectedRows.length} selected</span>
                          {canConvertEnquiry(role) && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-[#0052FF]/30 text-[#0052FF] hover:bg-[#0052FF]/10"
                              disabled={enquiryBulkBusy}
                              onClick={() => handleBulkConvert(selectedRows, clearSelection)}
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
                                onClick={() => handleBulkMatched("accept", selectedRows, clearSelection)}
                              >
                                Accept Selected
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="border-border/60"
                                disabled={enquiryBulkBusy}
                                onClick={() => handleBulkMatched("ack", selectedRows, clearSelection)}
                              >
                                Acknowledge Selected
                              </Button>
                            </>
                          )}
                          <Button variant="ghost" size="sm" onClick={clearSelection}>
                            Clear
                          </Button>
                        </>
                      );
                    }}
                  />
                  }
                  getKey={(e) => e.enquiry_id}
                  onOpen={(e) => { if (e.id != null) router.push(`/leads/${e.id}`); }}
                  card={(e) => ({ title: e.name, id: e.display_id, href: e.id != null ? `/leads/${e.id}` : undefined, subtitle: e.property_title || sourceLabel(e.source), footer: e.assigned_staff_name ?? <span className="text-muted-foreground">Unassigned</span>, tag: timeAgo(e.enquiry_at) || undefined })}
                  totalCount={enquiryTotal}
                  noun="enquiries"
                />
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
                  <ModuleViews
                    state={historyView}
                    data={history}
                    columns={historyColumns}
                    list={
                      <DataTable
                      variant="list"
                      flush={true}
                      manualPagination
                      pageCount={totalHistoryPages}
                      totalCount={historyTotal}
                      pagination={{ pageIndex: historyPage - 1, pageSize: LIMIT }}
                      onPaginationChange={(u: PaginationUpdate) => setHistoryPage((p) => (typeof u === "function" ? u({ pageIndex: p - 1, pageSize: LIMIT }) : u).pageIndex + 1)}
                      pageSizeOptions={[LIMIT]}
                      persistKey="history"
                      columns={historyColumns}
                      data={history}
                    />
                    }
                    getKey={(h) => h.id}
                    onOpen={(h) => { if (h.lead?.id) router.push(`/leads/${h.lead.id}`); }}
                    card={(h) => ({ title: h.lead?.name || "—", id: formatTableDate(h.created_at), href: h.lead?.id ? `/leads/${h.lead.id}` : undefined, subtitle: [h.from_user?.name, h.to_user?.name].filter(Boolean).join(" → ") || undefined, tag: h.event_type })}
                    totalCount={historyTotal}
                    noun="events"
                  />
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
