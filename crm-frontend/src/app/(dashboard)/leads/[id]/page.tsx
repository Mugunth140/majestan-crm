"use client";

import { CompletenessRing } from "@/components/record/score-ring";
import { leadScoreFields } from "@/lib/record-score";
import { apiFetch } from "@/lib/api-fetch";
import { normalizeDepartment, pipelineOf } from "@/lib/department";
import { recordNotInterested } from "@/lib/not-interested";
import { NotInterestedDialog } from "./not-interested-dialog";
import { ScheduleVisitDialog, type VisitDetails } from "@/components/leads/schedule-visit-dialog";

const VISIT_STATUSES = ["Site Visit Scheduled", "Re Visit Scheduled"];

type VisitInquiry = { id: number; visit_date?: string | null; visit_slot?: string | null; project_list?: string | null; visit_location?: string | null };

import { useEffect, useMemo, useState, useCallback, Suspense, type ReactNode } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { PageActions } from "@/components/layout/page-actions";
import { useIsMobile } from "@/hooks/use-device";
import { useIsAdmin } from "@/hooks/use-is-admin";
import dynamic from "next/dynamic";

const LeadAttachments = dynamic(() => import("@/components/shared/lead-attachments").then(mod => mod.LeadAttachments), { ssr: false });
import { AssigneeButton, HEADER_BUTTON, HEADER_PRIMARY, StatusMenu } from "@/components/record/header-actions";
import type { Person } from "@/components/record/assignee-picker";
import { MobileHeader } from "@/components/layout/mobile-header";
import { sortContactLogs } from "@/lib/contact-log-utils";
import {
  leadStatusDot,
  leadStatusPill,
  LEAD_STATUS_ORDER,
} from "@/lib/lead-constants";
import { cn } from "@/lib/utils";
import { shouldAutoOpenFollowUps, wantsFollowUps } from "@/lib/follow-up-deep-link";
import { InlineSelect, InlineText, Section, FieldRow, withCurrent, type Option } from "@/components/record/inline-field";
import { Feed, timelineItems, type TimelineEntry } from "./lead-timeline";
import { TabHeader } from "@/components/record/feed";
import { LeadConversation } from "@/components/record/conversation";
import { FollowUpComposer } from "@/components/record/follow-up-composer";
import { AttachmentsArt, EmptyState, RequirementsArt } from "@/components/record/empty-state";
import { RequirementFields, loadCities } from "./lead-requirement";
import {
  Loader2, ArrowUpRight, History, TrendingUp, Sparkles,
  Plus, Activity, MessagesSquare, Paperclip, Building2, Info, Trash2,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

const STATUS_OPTIONS: Option[] = LEAD_STATUS_ORDER.map((s) => ({ label: s, value: s, dot: leadStatusDot(s) }));

const PREDEFINED_DROP_REASONS = [
  "Location mismatch",
  "Funding issue",
  "Vaastu complaint",
  "Facing issue",
  "Floor mismatched"
];

type Tab = "timeline" | "conversation" | "details" | "requirements" | "attachments";


const leadCode = (id: number | string) => `L${String(id).padStart(5, "0")}`;



// ── Loading Skeleton ─────────────────────────────────────────────────────────
function PageSkeleton() {
  return (
    <div className="flex flex-col md:h-full md:flex-row lg:-mx-6 lg:-mb-8 lg:-mt-6 lg:h-[calc(100%+3.5rem)]">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="hidden h-11 items-center gap-5 border-b px-5 md:flex">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-4 w-20" />)}
        </div>
        <div className="space-y-6 p-4 md:p-6">
          <Skeleton className="h-36 w-full rounded-xl" />
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="h-7 w-7 shrink-0 rounded-full" />
              <div className="flex-1 space-y-2 pt-1">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-10 w-full max-w-lg rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="hidden w-[340px] shrink-0 border-l md:block xl:w-[360px]">
        <div className="flex items-center gap-3 border-b p-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
        <div className="space-y-3 p-4">
          {[...Array(9)].map((_, i) => <Skeleton key={i} className="h-6 w-full" />)}
        </div>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, icon: Icon, label, count, className }: {
  active: boolean;
  onClick: () => void;
  icon: typeof Activity;
  label: string;
  count?: number;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        // Phone: pill segments. Desktop: Frappe's underlined tab strip.
        "relative flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[14px] font-medium transition-colors md:h-11 md:rounded-none md:px-0.5",
        active
          ? "bg-[#017D58] text-white dark:bg-[#2FB585] dark:text-black md:bg-transparent md:text-foreground md:dark:bg-transparent md:dark:text-foreground"
          : "bg-foreground/[0.06] text-foreground/80 md:bg-transparent md:text-muted-foreground md:hover:text-foreground",
        className,
      )}
    >
      <Icon className="hidden h-4 w-4 md:block" />
      {label}
      {count ? (
        <span className={cn(
          "rounded-full px-1.5 text-[11px] leading-[18px] tabular-nums",
          active ? "bg-white/20 md:bg-foreground/[0.08]" : "bg-foreground/[0.08]",
        )}>
          {count}
        </span>
      ) : null}
      {active && <span aria-hidden className="absolute inset-x-0 -bottom-px hidden h-0.5 rounded-full bg-foreground md:block" />}
    </button>
  );
}

function Panel({ title, action, children, flush }: { title: string; action?: ReactNode; children: ReactNode; flush?: boolean }) {
  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <div className="flex min-h-11 items-center gap-2 border-b px-4">
        <h3 className="min-w-0 flex-1 truncate text-[14px] font-semibold text-foreground">{title}</h3>
        {action}
      </div>
      <div className={flush ? undefined : "p-4"}>{children}</div>
    </section>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

function LeadDetail() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab");
  const id = params.id as string;
  const isMobile = useIsMobile();

  const [lead, setLead] = useState<any>(null);
  // Bumped after saves that may create an email draft (status changes, visits).
  const [mailRefresh, setMailRefresh] = useState(0);
  const [visitDialog, setVisitDialog] = useState<{ status: string | null; initial: Partial<VisitDetails> } | null>(null);
  const [savingVisit, setSavingVisit] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("timeline");
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [sources, setSources] = useState<Option[]>([]);
  const [cities, setCities] = useState<Option[]>([]);

  // Modals / Sliders
  const [addingInquiry, setAddingInquiry] = useState(false);
  const [removingInquiry, setRemovingInquiry] = useState<number | null>(null);
  const isAdmin = useIsAdmin();
  const [autoOpenedFollowUps, setAutoOpenedFollowUps] = useState(false);
  const [isAutoMatchOpen, setIsAutoMatchOpen] = useState(false);
  const [autoMatchResults, setAutoMatchResults] = useState<any[]>([]);
  const [isMatching, setIsMatching] = useState(false);

  // Convert Lead state
  const [role, setRole] = useState<string>("");
  const [userDept, setUserDept] = useState<string>("");
  const [userDeptName, setUserDeptName] = useState<string>("");
  const [currentUserId, setCurrentUserId] = useState<number>(0);
  const [isConvertOpen, setIsConvertOpen] = useState(false);
  const [convertTo, setConvertTo] = useState<"inbound" | "agent" | "">("");
  const [convertFeedback, setConvertFeedback] = useState("");
  const [isConverting, setIsConverting] = useState(false);

  // Assign Lead state
  // Who the lead can go to: loaded when the assignee list first opens.
  const [staff, setStaff] = useState<Person[] | null>(null);

  // Dropped Reason Modal
  const [isDroppedOpen, setIsDroppedOpen] = useState(false);
  const [dropReason, setDropReason] = useState("");
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  // Not Interested Reason Modal
  const [isNotInterestedOpen, setIsNotInterestedOpen] = useState(false);

  // Edit Requirement

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const user = JSON.parse(localStorage.getItem("crm_user") || "{}");
        const deptName = user?.department?.name || user?.department || "";
        setRole(user?.role?.name || user?.role || "");
        setUserDept(normalizeDepartment(deptName));
        setUserDeptName(typeof deptName === "string" ? deptName : "");
        setCurrentUserId(user?.id || 0);
      } catch {
        // ignore
      }
    }
  }, []);

  // Lead sources for the inline Source field.
  useEffect(() => {
    apiFetch(`${API_URL}/master/lead-sources`)
      .then((res) => res.json())
      .then((data) => { if (data?.success && Array.isArray(data.data)) setSources(data.data); })
      .catch(() => {});
  }, []);

  // Cities for the contact City field, stored by name.
  useEffect(() => {
    let live = true;
    loadCities().then((c) => { if (live) setCities(c.map((x) => ({ label: x.city_name, value: x.city_name }))); });
    return () => { live = false; };
  }, []);

  const fetchAutoMatch = async () => {
    setIsMatching(true);
    try {
      const res = await apiFetch(`${API_URL}/leads/${id}/auto-match`);
      const data = await res.json();
      if (data.success) {
        setAutoMatchResults(data.data);
        setIsAutoMatchOpen(true);
      } else {
        toast.error(data.message || "Failed to auto-match properties");
      }
    } catch {
      toast.error("Failed to auto-match properties");
    } finally {
      setIsMatching(false);
    }
  };

  const handleConvertLead = async () => {
    if (!convertTo) return toast.error("Please select a conversion type.");
    if (!convertFeedback.trim()) return toast.error("Please enter feedback.");
    setIsConverting(true);
    try {
      const res = await apiFetch(`${API_URL}/lead-routing/convert/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ convert_to: convertTo, feedback: convertFeedback }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Lead converted successfully.");
        setIsConvertOpen(false);
        router.push("/leads");
      } else {
        toast.error(data.message || "Failed to convert lead");
      }
    } catch {
      toast.error("Failed to convert lead");
    } finally {
      setIsConverting(false);
    }
  };

  const loadStaff = () => {
    if (staff) return;
    const params = role === "Team Lead" && userDept ? `?department=${encodeURIComponent(userDept.toLowerCase())}` : "?department=all";
    apiFetch(`${API_URL}/lead-routing/staff-list${params}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.success) throw new Error();
        setStaff((d.data as { id: number; name: string; department?: { name: string }; current_lead_count?: number }[]).map((p) => ({
          id: p.id, name: p.name, hint: [p.department?.name, `${p.current_lead_count ?? 0} leads`].filter(Boolean).join(" · "),
        })));
      })
      .catch(() => { setStaff([]); toast.error("Failed to load staff list"); });
  };

  const handleAssignLead = async (toUserId: number | null) => {
    if (toUserId === null) return;
    try {
      const res = await apiFetch(`${API_URL}/lead-routing/assign/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to_user_id: toUserId }),
      });
      if (!res.ok) throw new Error("Failed to assign lead");
      toast.success("Lead reassigned successfully");
      fetchLead(true);
    } catch (reason) {
      toast.error("Failed to assign lead");
      throw reason;
    }
  };

  // "A" jumps between the timeline and the conversation (follow-ups).
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      if (
        e.key.toLowerCase() === 'a' &&
        !e.metaKey && !e.ctrlKey && !e.altKey &&
        el?.tagName !== 'INPUT' &&
        el?.tagName !== 'TEXTAREA' &&
        !el?.isContentEditable
      ) {
        e.preventDefault();
        setActiveTab(prev => prev === "conversation" ? "timeline" : "conversation");
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);


  const fetchLead = useCallback(async (silent = false) => {
    if (!id) return;
    if (!silent) setIsLoading(true);
    try {
      const [res, history] = await Promise.all([
        apiFetch(`${API_URL}/leads/${id}`),
        // The timeline is extra: an older backend without it just shows none.
        apiFetch(`${API_URL}/leads/${id}/timeline`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      ]);
      const result = await res.json();
      if (history?.success) setTimeline(history.data);
      if (result.success) setLead(result.data);
      else { toast.error("Lead not found"); router.push("/leads"); }
    } catch {
      toast.error("Failed to load lead details");
    } finally {
      setIsLoading(false);
    }
  }, [id, router]);

  useEffect(() => { fetchLead(); }, [fetchLead]);

  const refreshTimeline = () =>
    apiFetch(`${API_URL}/leads/${id}/timeline`)
      .then((r) => (r.ok ? r.json() : null))
      .then((history) => { if (history?.success) setTimeline(history.data); })
      .catch(() => {});

  /** Saves one or more lead fields in place; throws so the field can revert. */
  const saveLead = async (patch: Record<string, unknown>) => {
    try {
      const res = await apiFetch(`${API_URL}/leads/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        const message = Array.isArray(data?.message) ? data.message[0] : data?.message;
        throw new Error(message || "Couldn't save the change");
      }
      toast.success("Saved");
      await fetchLead(true);
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Couldn't save the change");
      throw reason;
    }
  };

  const saveInquiry = async (inquiryId: number, patch: Record<string, unknown>) => {
    try {
      const res = await apiFetch(`${API_URL}/leads/${id}/inquiries/${inquiryId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) throw new Error(data?.message || "Couldn't save the requirement");
      toast.success("Saved");
      // Patch the one requirement in place; only the timeline needs a fresh copy.
      if (data.data) {
        setLead((prev: any) => prev && { ...prev, inquiries: prev.inquiries?.map((i: any) => (i.id === inquiryId ? { ...i, ...data.data } : i)) });
        refreshTimeline();
      } else {
        await fetchLead(true);
      }
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Couldn't save the requirement");
      throw reason;
    }
  };

  const putStatus = async (status: string) => {
    const res = await apiFetch(`${API_URL}/leads/${id}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status_name: status }),
    });
    const data = await res.json();
    if (!data.success) throw new Error("Failed to update status");
    return data as { transferredToSales?: boolean };
  };

  /** Status changes that need more input open their dialog first. */
  const changeStatus = async (v: string) => {
    if (!v || v === lead?.status) return;
    if (v === "Dropped") return setIsDroppedOpen(true);
    if (v === "Not Interested") return setIsNotInterestedOpen(true);
    if (VISIT_STATUSES.includes(v)) return openVisitDialog(v);
    try {
      const data = await putStatus(v);
      toast.success(data.transferredToSales ? "Lead moved to the Sales pipeline." : "Lead status updated.");
      fetchLead(true);
      setMailRefresh((n) => n + 1);
    } catch {
      toast.error("Failed to update status");
    }
  };

  const toggleUnqualified = async () => {
    const newVal = !lead.is_unqualified;
    try {
      const res = await apiFetch(`${API_URL}/leads/${id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          is_unqualified: newVal,
          status_name: newVal ? 'Lost' : 'New Lead'
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(newVal ? "Lead marked as Unqualified (Lost)." : "Lead unmarked as Unqualified.");
        fetchLead(true);
      } else toast.error("Failed to update qualification status");
    } catch {
      toast.error("Failed to update qualification status");
    }
  };

  /** Pre-fills the visit dialog from the latest enquiry that has a visit, else the latest one. */
  const openVisitDialog = (status: string | null) => {
    const inquiries: VisitInquiry[] = [...(lead?.inquiries ?? [])].sort((a: VisitInquiry, b: VisitInquiry) => b.id - a.id);
    const source = inquiries.find((i) => i.visit_date) ?? inquiries[0];
    setVisitDialog({
      status,
      initial: {
        date: source?.visit_date ? String(source.visit_date).slice(0, 10) : "",
        time: source?.visit_slot ? String(source.visit_slot).slice(0, 5) : "",
        project: source?.project_list ?? "",
        location: source?.visit_location ?? "",
      },
    });
  };

  const saveVisit = async (visit: VisitDetails) => {
    if (!visitDialog) return;
    setSavingVisit(true);
    try {
      if (visitDialog.status && visitDialog.status !== lead.status) await putStatus(visitDialog.status);
      const res = await apiFetch(`${API_URL}/leads/${id}/visit`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: visit.date, time: visit.time, project: visit.project || undefined, location: visit.location || undefined }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || "Failed to save the visit");
      toast.success("Site visit saved.");
      setVisitDialog(null);
      fetchLead(true);
      setMailRefresh((n) => n + 1);
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Failed to save the visit");
    } finally {
      setSavingVisit(false);
    }
  };

  const skipVisit = async () => {
    if (!visitDialog?.status) return setVisitDialog(null);
    setSavingVisit(true);
    try {
      const data = await putStatus(visitDialog.status);
      toast.success(data.transferredToSales ? "Lead moved to the Sales pipeline." : "Lead status updated.");
      setVisitDialog(null);
      fetchLead(true);
      setMailRefresh((n) => n + 1);
    } catch {
      toast.error("Failed to update status");
    } finally {
      setSavingVisit(false);
    }
  };

  // Acknowledge open website enquiries: opening the lead IS seeing them
  // (the Interested In card is on this page). The server only honours this
  // for the assigned staff member; everyone else gets a silent no-op.
  // NOTE: the detail response nests the owner as `assigned_staff.id`
  // (there is no flat `assigned_staff_id` on this payload).
  useEffect(() => {
    if (!id || !lead) return;
    let cancelled = false;
    (async () => {
      try {
        const stored = localStorage.getItem("crm_user");
        const currentUserId = stored ? JSON.parse(stored).id : null;
        // Numeric comparison: localStorage id may be a string while the API
        // returns a number — strict !== would silently never fire the beacon.
        if (!currentUserId || Number(currentUserId) !== Number(lead.assigned_staff?.id)) return;
        const res = await apiFetch(`${API_URL}/leads/${id}/acknowledge-enquiry`, { method: "POST" });
        if (!cancelled && res.ok) {
          const data = await res.json().catch(() => null);
          if (data?.success && Number(data?.data?.acknowledged) > 0) fetchLead(true);
        }
      } catch {
        // Beacon must never break the page. Swallow everything.
      }
    })();
    return () => { cancelled = true; };
  }, [id, lead, fetchLead]);

  // Deep link from the Leads table's "Last Followup" cell (?tab=followups):
  // open the conversation (follow-ups) once the lead and its follow-ups are in hand. The
  // latch means switching tabs afterwards is not undone by the next render.
  useEffect(() => {
    if (!shouldAutoOpenFollowUps({
      wantsFollowUps: wantsFollowUps(tab),
      isLoading,
      hasLead: !!lead,
      alreadyOpened: autoOpenedFollowUps,
    })) return;
    setActiveTab("conversation");
    setAutoOpenedFollowUps(true);
    // `tab` rather than `searchParams`: the param value is the actual
    // dependency, so a fresh object identity can't re-run this effect.
  }, [tab, isLoading, lead, autoOpenedFollowUps]);

  const followUps: any[] = useMemo(() => lead?.follow_ups || [], [lead]);
  // Defensive newest-first sort (created_at, id tiebreak) — backend orders
  // the same way, but bulk device syncs share second precision.
  const contactLogs: any[] = useMemo(() => sortContactLogs(lead?.contact_logs || []), [lead]);
  const timelineFeed = useMemo(() => timelineItems(timeline), [timeline]);
  const sourceOptions = useMemo(() => {
    const current = lead?.lead_source;
    if (!current || sources.some((s) => s.value === current)) return sources;
    return [{ label: current, value: current }, ...sources];
  }, [sources, lead]);

  if (isLoading) return <PageSkeleton />;
  if (!lead) return null;

  const statusName = lead.status || "New Lead";


  // Department purview for Manager / Team Lead: unassigned leads, or leads in
  // the user's own pipeline. The owner's department is not used: a lead moved
  // to Sales keeps its old owner until a Sales Team Lead reassigns it.
  const userLeadDept = pipelineOf(userDeptName);
  const leadPipeline = String(lead?.department || "").toLowerCase();
  const inDeptPurview =
    lead?.assigned_staff == null ||
    (userLeadDept != null && leadPipeline === userLeadDept);

  // Access model: Admin and Manager share everything except delete
  // (delete stays Admin-only). Team Leads are scoped to their department.
  const isManagerOrAdmin = role === "Admin" || role === "Manager";

  const canEdit =
    isManagerOrAdmin ||
    lead?.assigned_staff?.id === currentUserId ||
    (role === "Team Lead" && inDeptPurview);
  const canReassign =
    isManagerOrAdmin || (role === "Team Lead" && inDeptPurview);
  const showReassign = canReassign && (role === "Admin" || role === "Manager" || role === "Team Lead") && !lead.is_converted;

  // The status and assignee buttons, shared with every record page.
  const statusMenu = (size: "h-7" | "h-8", align: "start" | "end" = "end") => (
    <StatusMenu status={statusName} options={STATUS_OPTIONS} pillClass={leadStatusPill(statusName)} onChange={canEdit ? changeStatus : undefined} size={size} align={align} />
  );
  const assigneeButton = (variant: "header" | "field" | "phone") => (
    <AssigneeButton name={lead.assigned_staff?.name} variant={variant} people={staff ?? []} value={lead.assigned_staff_id ?? lead.assigned_staff?.id}
      onPick={showReassign ? handleAssignLead : undefined} allowClear={false} loading={staff === null} onOpen={loadStaff} />
  );
  const showConvert = canEdit && !lead.is_converted &&
    (role === "Admin" || role === "Manager" || ((role === "Staff" || role === "Team Lead") && userDept === "telecalling"));
  const openConvert = () => { setConvertTo(""); setConvertFeedback(""); setIsConvertOpen(true); };

  const inquiries: any[] = lead.inquiries || [];
  const shownTab: Tab = activeTab === "details" && !isMobile ? "timeline" : activeTab;

  const tabs: { key: Tab; label: string; icon: typeof Activity; count?: number; mobileOnly?: boolean }[] = [
    { key: "timeline", label: "Activity", icon: History },
    { key: "conversation", label: "Conversation", icon: MessagesSquare, count: followUps.length + contactLogs.length },
    { key: "details", label: "Details", icon: Info, mobileOnly: true },
    { key: "requirements", label: "Requirements", icon: Building2, count: inquiries.length },
    { key: "attachments", label: "Attachments", icon: Paperclip, count: lead.documents?.length },
  ];

  // ── Record fields (desktop sidebar, phone "Details" tab) ──
  const fields = (
    <>
      <Section title="Details">
        <InlineSelect label="Status" value={statusName} options={STATUS_OPTIONS} onSave={changeStatus} disabled={!canEdit} />
        {VISIT_STATUSES.includes(lead.status) && canEdit && (
          <FieldRow label="">
            <button type="button" onClick={() => openVisitDialog(null)} className="px-2 text-[13px] font-medium text-[#017D58] hover:underline dark:text-[#2FB585]">
              Reschedule site visit
            </button>
          </FieldRow>
        )}
        <InlineSelect
          label="Source"
          value={lead.lead_source}
          options={sourceOptions}
          onSave={(v) => saveLead({ source: v })}
          disabled={!canEdit}
        />
        <FieldRow label="Assigned to">{assigneeButton("field")}</FieldRow>
        <FieldRow label="Unqualified">
          <div className="flex h-8 items-center px-2">
            <Switch
              checked={!!lead.is_unqualified}
              onCheckedChange={toggleUnqualified}
              disabled={!canEdit}
              aria-label="Mark as unqualified"
            />
          </div>
        </FieldRow>
        <FieldRow label="Created">
          <span className="px-2 text-[14px] text-foreground">
            {format(new Date(lead.created_at), "d MMM yyyy, h:mm a")}
          </span>
        </FieldRow>
      </Section>

      <Section title="Contact">
        <InlineText label="Name" value={lead.name} onSave={(v) => {
          if (!v) { toast.error("Name can't be empty"); throw new Error("empty"); }
          return saveLead({ name: v });
        }} disabled={!canEdit} />
        <InlineText label="Mobile" type="tel" value={lead.mobile_number} onSave={(v) => {
          if (!v) { toast.error("Mobile number can't be empty"); throw new Error("empty"); }
          return saveLead({ mobile: v });
        }} disabled={!canEdit} />
        <InlineText label="WhatsApp" type="tel" value={lead.whatsapp_number} onSave={(v) => saveLead({ whatsapp: v })} disabled={!canEdit} />
        <InlineText label="Email" type="email" value={lead.email} onSave={(v) => saveLead({ email: v })} disabled={!canEdit} />
        <InlineSelect searchable label="City" value={lead.city} options={withCurrent(cities, lead.city)} onSave={(v) => saveLead({ city: v })} disabled={!canEdit} />
        <InlineText label="Address" value={lead.address} onSave={(v) => saveLead({ address: v })} disabled={!canEdit} multiline />
      </Section>

      <Section title="Commission" defaultOpen={!!(lead.commission || lead.commission_remarks)}>
        <InlineText
          label="Commission %"
          type="number"
          value={lead.commission}
          onSave={(v) => {
            const n = v === "" ? null : Number(v);
            if (n !== null && (Number.isNaN(n) || n < 0 || n > 100)) {
              toast.error("Enter a percentage between 0 and 100");
              throw new Error("invalid");
            }
            return saveLead({ commission: n });
          }}
          disabled={!canEdit}
        />
        <InlineText label="Remarks" multiline value={lead.commission_remarks} placeholder="Split, terms…" onSave={(v) => saveLead({ commissionRemarks: v })} disabled={!canEdit} />
      </Section>

      <Section title="Referral" defaultOpen={!!lead.is_referral}>
        <FieldRow label="Referred">
          <div className="flex h-8 items-center px-2">
            <Switch
              checked={!!lead.is_referral}
              onCheckedChange={(on) => saveLead({ isReferral: on }).catch(() => {})}
              disabled={!canEdit}
              aria-label="Referred lead"
            />
          </div>
        </FieldRow>
        {lead.is_referral ? (
          <>
            <InlineText label="Referred by" value={lead.referred_by_name} onSave={(v) => saveLead({ referredByName: v })} disabled={!canEdit} />
            <InlineText label="Their contact" type="tel" value={lead.referred_by_contact} onSave={(v) => saveLead({ referredByContact: v })} disabled={!canEdit} />
          </>
        ) : null}
      </Section>
    </>
  );

  // The status pill and the assignee, as the leads table shows them.
  // Requirements added by hand on this page are not repeat enquiries.
  const enquiries = inquiries.filter((i) => i.source !== "manual").length;
  const repeatBadge = enquiries > 1 && (
    <Badge variant="outline" className="border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-900/60 dark:bg-purple-950/40 dark:text-purple-300">
      Repeat ({enquiries - 1})
    </Badge>
  );

  const addRequirement = async () => {
    setAddingInquiry(true);
    try {
      const res = await apiFetch(`${API_URL}/leads/${id}/inquiries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      toast.success("Requirement added. Fill in the details below.");
      fetchLead(true);
    } catch (reason) {
      toast.error(reason instanceof Error && reason.message ? reason.message : "Failed to add the requirement");
    } finally {
      setAddingInquiry(false);
    }
  };

  // Deleting is for admins, like every delete in the CRM.
  const removeRequirement = async (inquiryId: number, label: string) => {
    if (!confirm(`Delete ${label}? Its details can't be brought back.`)) return;
    setRemovingInquiry(inquiryId);
    try {
      const res = await apiFetch(`${API_URL}/leads/${id}/inquiries/${inquiryId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) throw new Error(data?.message || "Couldn't delete the requirement");
      toast.success("Requirement deleted");
      setLead((prev: any) => prev && { ...prev, inquiries: prev.inquiries?.filter((i: any) => i.id !== inquiryId) });
      refreshTimeline();
    } catch (reason) {
      toast.error(reason instanceof Error && reason.message ? reason.message : "Couldn't delete the requirement");
    } finally {
      setRemovingInquiry(null);
    }
  };

  const addRequirementButton = (primary: boolean) => canEdit && (
    <button type="button" onClick={addRequirement} disabled={addingInquiry} className={cn(primary ? HEADER_PRIMARY : HEADER_BUTTON, "h-8 text-[13px] disabled:opacity-60")}>
      {addingInquiry ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className={cn("h-4 w-4", !primary && "text-muted-foreground")} />}
      Add requirement
    </button>
  );

  // ── Follow-up composer (lives in the Conversation tab's bottom bar) ──
  const composer = canEdit && (
    <FollowUpComposer api="leads" entityId={id as string} noun="lead" followUps={followUps} onSaved={() => fetchLead(true)} />
  );

  const empty = (icon: ReactNode, title: string, hint: string) => (
    <div className="flex flex-col items-center py-14 text-center">
      <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-foreground/[0.05] text-muted-foreground">{icon}</span>
      <p className="text-[14px] font-medium text-foreground">{title}</p>
      <p className="mt-1 text-[13px] text-muted-foreground">{hint}</p>
    </div>
  );

  return (
    <div className="flex flex-col md:h-full lg:-mx-6 lg:-mb-8 lg:-mt-6 lg:h-[calc(100%+3.5rem)]">

      <MobileHeader title={lead.name || "Lead"} showBack />

      {/* ── Header actions (desktop page header) ── */}
      <PageActions>
        <div className="flex items-center gap-2">
          {statusMenu("h-8")}
          {assigneeButton("header")}
          {showConvert && (
            <button type="button" onClick={openConvert} className={HEADER_PRIMARY}>
              <TrendingUp className="h-3.5 w-3.5" />
              Convert
            </button>
          )}
        </div>
      </PageActions>

      {/* ── Phone summary ── */}
      <div className="space-y-4 px-4 pb-4 pt-1 md:hidden">
        <div className="flex flex-wrap items-center gap-2 text-[14px] text-muted-foreground">
          {statusMenu("h-7", "start")}
          {repeatBadge}
          <span>{leadCode(lead.id)}</span>
        </div>
        <div className="flex gap-2">
            <div className="min-w-0 flex-1">{assigneeButton("phone")}</div>
            {showConvert && (
              <button type="button" onClick={openConvert} className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-[#017D58] text-[15px] font-semibold text-white dark:bg-[#2FB585] dark:text-black">
                <TrendingUp className="h-4 w-4" /> Convert
              </button>
            )}
          </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">

        {/* ── Main: tabs ── */}
        <div className="flex min-w-0 flex-1 flex-col md:min-h-0">
          <div
            role="tablist"
            aria-label="Lead sections"
            className="sticky top-[calc(env(safe-area-inset-top)+2.75rem)] z-20 flex shrink-0 gap-1.5 overflow-x-auto bg-background px-4 py-2 scrollbar-hide md:static md:gap-5 md:border-b md:px-5 md:py-0"
          >
            {tabs.map((t) => (
              <TabButton
                key={t.key}
                active={shownTab === t.key}
                onClick={() => setActiveTab(t.key)}
                icon={t.icon}
                label={t.label}
                count={t.count}
                className={t.mobileOnly ? "md:hidden" : undefined}
              />
            ))}
          </div>

          <div className={cn("md:min-h-0 md:flex-1", shownTab === "conversation" ? "md:flex md:flex-col" : "md:overflow-y-auto")}>
            {shownTab === "details" && (
              <div className="mx-4 mt-2 overflow-hidden rounded-xl border bg-card">{fields}</div>
            )}

            {shownTab === "timeline" && (
              <div className="pb-4">
                <TabHeader title="Activity" />
                {timelineFeed.length ? <Feed items={timelineFeed} /> : empty(<History className="h-5 w-5" />, "Nothing recorded yet", "Status changes, edits and assignments will show up here.")}
              </div>
            )}

            {shownTab === "conversation" && (
                <LeadConversation
                  leadId={lead.id}
                  leadName={lead.name}
                  email={lead.email}
                  mobile={lead.mobile_number}
                  whatsapp={lead.whatsapp_number}
                  followUps={followUps}
                  contactLogs={contactLogs}
                  composer={composer}
                  canEdit={canEdit}
                  isAdmin={role === "Admin" || role === "Super Admin"}
                  refreshKey={mailRefresh}
                  onRefresh={() => fetchLead(true)}
                />
            )}

            {shownTab === "requirements" && (
              <div className="pb-6">
                <TabHeader title="Requirements" action={inquiries.length > 0 && addRequirementButton(true)} />
                <div className="space-y-5 px-3 sm:px-10">
                {(lead.interestedProperty || lead.visit) && (
                  <Panel
                    title="Interested in"
                    action={lead.visit && (
                      <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[12px] font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                        Site visit{lead.visit.date ? ` · ${String(lead.visit.date).slice(0, 10)}` : ""}{lead.visit.slot ? ` ${String(lead.visit.slot).slice(0, 5)}` : ""}
                      </span>
                    )}
                  >
                    {lead.interestedProperty ? (
                      <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 text-[14px]">
                        {/* TODO: move site URL to NEXT_PUBLIC_SITE_URL once added to .env */}
                        <a
                          href={`${process.env.NEXT_PUBLIC_SITE_URL || "https://majestan.in"}/properties/${lead.interestedProperty.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 font-semibold text-[#017D58] hover:underline dark:text-[#2FB585]"
                        >
                          {lead.interestedProperty.title}
                          <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
                        </a>
                        {lead.interestedProperty.code && <span className="text-muted-foreground">ID: {lead.interestedProperty.code}</span>}
                        {lead.interestedProperty.propertyType && <span className="text-muted-foreground">{lead.interestedProperty.propertyType}</span>}
                        {lead.interestedProperty.city && <span className="text-muted-foreground">{lead.interestedProperty.city}</span>}
                        {lead.interestedProperty.price != null && (
                          <span className="font-medium">
                            {new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(lead.interestedProperty.price))}
                          </span>
                        )}
                      </div>
                    ) : (
                      <p className="text-[14px] text-muted-foreground">Property details not available.</p>
                    )}
                  </Panel>
                )}

                {inquiries.length === 0 && (
                  <EmptyState
                    art={<RequirementsArt />}
                    title="No requirements yet"
                    hint="Note what the lead is looking for, like the property type, budget, location and timeline, so matching and follow-ups stay on track."
                    action={addRequirementButton(true)}
                  />
                )}

                {inquiries.map((inq: any, idx: number) => {
                  const title = inquiries.length > 1 ? `Requirement #${idx + 1}` : "Requirement";
                  return (
                  <Panel
                    key={inq.id || idx}
                    flush
                    title={title}
                    action={
                      <>
                        {canEdit && idx === 0 && (
                          <button type="button" onClick={fetchAutoMatch} disabled={isMatching} className={cn(HEADER_BUTTON, "h-7 text-[13px] disabled:opacity-60")}>
                            {isMatching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />}
                            Find matches
                          </button>
                        )}
                        {isAdmin && (
                          <button type="button" onClick={() => void removeRequirement(inq.id, title.toLowerCase())} disabled={removingInquiry === inq.id}
                            aria-label={`Delete ${title.toLowerCase()}`} title="Delete requirement"
                            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-60 dark:hover:bg-red-950/40 dark:hover:text-red-400">
                            {removingInquiry === inq.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                          </button>
                        )}
                      </>
                    }
                  >
                    <RequirementFields inquiry={inq} canEdit={canEdit} save={(patch) => saveInquiry(inq.id, patch)} />
                  </Panel>
                  );
                })}
                </div>
              </div>
            )}

            {shownTab === "attachments" && (
              <div className="pb-6">
                <LeadAttachments
                  leadId={id as string}
                  documents={lead?.documents || []}
                  onRefresh={() => fetchLead(true)}
                  header={(upload) => <TabHeader title="Attachments" action={canEdit && upload} />}
                  empty={() => (
                    <EmptyState
                      art={<AttachmentsArt />}
                      title="No attachments yet"
                      hint="Keep the lead's documents here, like ID proof, booking forms or floor plans. PDFs and images up to 10 MB."
                    />
                  )}
                />
              </div>
            )}
          </div>
        </div>

        {/* ── Sidebar: the record ── */}
        <aside className="hidden w-[340px] shrink-0 flex-col overflow-y-auto border-l md:flex xl:w-[360px]">
          <div className="space-y-3 border-b p-4">
            <div className="flex items-center gap-3">
              <CompletenessRing fields={leadScoreFields(lead)} />
              <div className="min-w-0">
                <p className="truncate text-[17px] font-semibold leading-6 text-foreground">{lead.name}</p>
                <p className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
                  {leadCode(lead.id)}
                  {repeatBadge}
                </p>
              </div>
            </div>
          </div>
          {fields}
          {canEdit && (
            <p className="mt-auto hidden items-center gap-1.5 px-4 py-3 text-[12px] text-muted-foreground md:flex">
              Press <kbd className="rounded border px-1 font-mono text-[11px]">A</kbd> to open the conversation.
            </p>
          )}
        </aside>
      </div>

      {/* ── Auto Match Slider (Sheet) ── */}
      <Sheet open={isAutoMatchOpen} onOpenChange={setIsAutoMatchOpen}>
        <SheetContent side="right" className="w-[450px] !max-w-[450px] p-0 flex flex-col border-l">
          <SheetHeader className="shrink-0 border-b px-5 py-4">
            <SheetTitle className="text-[16px]">Matching properties</SheetTitle>
            <SheetDescription>
              Properties matching the customer preferences.
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {autoMatchResults.length === 0 ? (
              <p className="py-10 text-center text-[14px] text-muted-foreground">No properties match this requirement yet.</p>
            ) : (
              autoMatchResults.map((prop) => (
                <div key={prop.id} className="rounded-xl border bg-card p-4 transition-colors hover:bg-muted/40">
                  <h4 className="mb-1.5 text-[15px] font-semibold">{prop.title}</h4>
                  <div className="flex gap-2 mb-3">
                    <Badge variant="secondary" className="text-[11px]">{prop.property_type}</Badge>
                    <Badge variant="outline" className="text-[11px]">{prop.listing_type}</Badge>
                    <Badge variant="outline" className="text-[11px]">{prop.status}</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                    <div><span className="font-semibold text-foreground">Price:</span> ₹{Number(prop.price).toLocaleString()}</div>
                    {prop.bedrooms && <div><span className="font-semibold text-foreground">BHK:</span> {prop.bedrooms}</div>}
                    {prop.area_sqft && <div><span className="font-semibold text-foreground">Area:</span> {prop.area_sqft} sqft</div>}
                    {prop.city && <div><span className="font-semibold text-foreground">City:</span> {prop.city}</div>}
                  </div>
                </div>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Dropped Reason Dialog ── */}
      <Dialog open={isDroppedOpen} onOpenChange={(o) => !o && setIsDroppedOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Why is this lead dropped?</DialogTitle>
            <DialogDescription>
              Please provide the reason for dropping this lead.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-3">
              <label className="text-[13px] font-medium text-foreground/80">Reason</label>
              <div className="flex flex-wrap gap-2">
                {PREDEFINED_DROP_REASONS.map(reason => (
                  <button
                    type="button"
                    key={reason}
                    onClick={() => setDropReason(reason)}
                    className={`px-3 py-1.5 text-[13px] rounded-full border transition-colors ${
                      dropReason === reason
                        ? "bg-red-50 text-red-600 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900"
                        : "bg-muted/30 text-muted-foreground border-border/60 hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    {reason}
                  </button>
                ))}
              </div>
              <Textarea
                value={dropReason}
                onChange={(e) => setDropReason(e.target.value)}
                placeholder="Or type a custom reason..."
                className="h-24 rounded-xl bg-muted/30 resize-none mt-2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDroppedOpen(false)} disabled={isUpdatingStatus}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!dropReason.trim()) return toast.error("Please enter a drop reason.");
                setIsUpdatingStatus(true);
                try {
                  const res = await apiFetch(`${API_URL}/leads/${id}/status`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ status_name: "Dropped", drop_reason: dropReason }),
                  });
                  const data = await res.json();
                  if (data.success) {
                    toast.success("Lead marked as Dropped.");
                    setIsDroppedOpen(false);
                    setDropReason("");
                    fetchLead(true);
                  } else toast.error("Failed to update status");
                } catch {
                  toast.error("Failed to update status");
                } finally {
                  setIsUpdatingStatus(false);
                }
              }}
              disabled={isUpdatingStatus || !dropReason.trim()}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {isUpdatingStatus ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirm Dropped
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Not Interested Reason Dialog ── */}
      <ScheduleVisitDialog
        open={visitDialog}
        busy={savingVisit}
        onClose={() => setVisitDialog(null)}
        onSave={saveVisit}
        onSkip={visitDialog?.status ? skipVisit : undefined}
      />
      <NotInterestedDialog
        open={isNotInterestedOpen}
        onClose={() => setIsNotInterestedOpen(false)}
        busy={isUpdatingStatus}
        onConfirm={async (reason) => {
          setIsUpdatingStatus(true);
          try {
            // IST day, matching the backend's queue day boundaries.
            const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
            await recordNotInterested((url, init) => apiFetch(url, init), API_URL, id, reason, today);
            toast.success("Lead marked as Not Interested.");
            setIsNotInterestedOpen(false);
            fetchLead(true);
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to update status");
          } finally {
            setIsUpdatingStatus(false);
          }
        }}
      />

      {/* ── Convert Lead Dialog ── */}
      <Dialog open={isConvertOpen} onOpenChange={(o) => !o && setIsConvertOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Convert lead</DialogTitle>
            <DialogDescription>
              Choose where this lead goes next and add a note for the team.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-foreground/80">Convert to</label>
              <div className="flex gap-3">
                {([
                  { label: "Inbound", value: "inbound" as const },
                  { label: "Agent Network", value: "agent" as const },
                ]).map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setConvertTo(opt.value)}
                    className={[
                      "h-10 flex-1 rounded-lg border text-[14px] font-medium transition-colors",
                      convertTo === opt.value
                        ? "border-foreground bg-foreground text-background"
                        : "border-border text-foreground hover:bg-muted",
                    ].join(" ")}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-foreground/80">Note</label>
              <Textarea
                value={convertFeedback}
                onChange={(e) => setConvertFeedback(e.target.value)}
                placeholder="Enter conversion feedback..."
                className="h-28 rounded-xl bg-muted/30 resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConvertOpen(false)} disabled={isConverting}>
              Cancel
            </Button>
            <Button
              onClick={handleConvertLead}
              disabled={isConverting || !convertTo || !convertFeedback.trim()}
              className="bg-foreground text-background hover:bg-foreground/85"
            >
              {isConverting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Convert
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}

// useSearchParams opts the subtree out of prerendering up to the nearest
// Suspense boundary, which a production build requires. The fallback is the
// same skeleton the loading state renders, so the handover is invisible.
export default function LeadViewPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <LeadDetail />
    </Suspense>
  );
}
