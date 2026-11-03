"use client";

import { apiFetch } from "@/lib/api-fetch";
import { normalizeDepartment, pipelineOf } from "@/lib/department";
import { recordNotInterested } from "@/lib/not-interested";
import { NotInterestedDialog } from "./not-interested-dialog";
import { MailPanel } from "@/components/mail/mail-panel";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FormSelect } from "@/components/shared/form-select";
import { DateTimePicker } from "@/components/shared/datetime-picker";
import { PageActions } from "@/components/layout/page-actions";
import { useIsMobile } from "@/hooks/use-device";
import dynamic from "next/dynamic";

const FollowUpPanel = dynamic(() => import("@/components/shared/follow-up-panel").then(mod => mod.FollowUpPanel), { ssr: false });
const ContactModal = dynamic(() => import("@/components/shared/contact-modal").then(mod => mod.ContactModal), { ssr: false });
const LeadAttachments = dynamic(() => import("@/components/shared/lead-attachments").then(mod => mod.LeadAttachments), { ssr: false });
const EditRequirementModal = dynamic(() => import("@/components/shared/edit-requirement-modal").then(mod => mod.EditRequirementModal), { ssr: false });
import { AssignLeadModal } from "@/components/shared/assign-lead-modal";
import { MobileHeader } from "@/components/layout/mobile-header";
import {
  CONTACT_TYPE_STYLES,
  CONTACT_TYPE_ICONS,
  formatTimestamp,
  formatDuration,
  sortContactLogs,
  countByType,
  countCallDirections,
  contactLogIcon,
  contactLogAuthor,
} from "@/lib/contact-log-utils";
import {
  LEAD_STATUS_DOTS,
  LEAD_STATUS_ORDER,
  PURCHASE_TYPES,
  PURCHASE_TIMELINES,
  QUALIFICATION_PURPOSES,
  PROPERTY_CATEGORIES,
  PROPERTY_TYPES_MAP,
  FUNDERS,
} from "@/lib/lead-constants";
import { cn } from "@/lib/utils";
import { shouldAutoOpenFollowUps, wantsFollowUps } from "@/lib/follow-up-deep-link";
import { InlineAction, InlineSelect, InlineText, Section, FieldRow, type Option } from "./inline-field";
import { ActivityFeed, buildActivity } from "./lead-activity";
import {
  Loader2, Phone, Mail, MessageCircle, MessageSquare, ArrowUpRight,
  Clock, RefreshCw, History, TrendingUp, Sparkles, ChevronDown, PhoneIncoming,
  UserPlus, Activity, ListChecks, Paperclip, Building2, Smartphone, Pencil, Info,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

const STATUS_OPTIONS: Option[] = LEAD_STATUS_ORDER.map((s) => ({ label: s, value: s, dot: LEAD_STATUS_DOTS[s] }));

const PRIORITIES = [
  { label: "Low", value: "low" },
  { label: "Medium", value: "medium" },
  { label: "High", value: "high" },
  { label: "Urgent", value: "urgent" },
];

const CONTACTED_VIA = [
  { label: "Call", value: "call", icon: Phone },
  { label: "WhatsApp", value: "whatsapp", icon: MessageCircle },
  { label: "SMS", value: "sms", icon: Smartphone },
  { label: "Email", value: "email", icon: Mail },
];

const PREDEFINED_DROP_REASONS = [
  "Location mismatch",
  "Funding issue",
  "Vaastu complaint",
  "Facing issue",
  "Floor mismatched"
];

type Tab = "details" | "activity" | "followups" | "contact" | "emails" | "requirements" | "attachments";

const AVATAR_TONES = [
  "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300",
];

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("") || "?";
}

function avatarTone(name: string) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_TONES[h % AVATAR_TONES.length];
}

const leadCode = (id: number | string) => `L${String(id).padStart(5, "0")}`;

const humanize = (v?: string | null) => (v ? v.replace(/_/g, " ") : "");

// The header actions share the leads list's toolbar buttons.
const HEADER_BUTTON =
  "inline-flex h-8 items-center gap-1.5 rounded-md border bg-background px-3 text-[14px] font-medium text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-colors hover:bg-muted disabled:opacity-50";
const HEADER_PRIMARY =
  "inline-flex h-8 items-center gap-1.5 rounded-md bg-foreground px-3 text-[14px] font-medium text-background transition-colors hover:bg-foreground/85";

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

function QuickAction({ icon: Icon, label, onClick, disabled }: {
  icon: typeof Phone;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      className="flex flex-1 flex-col items-center gap-1 rounded-xl bg-foreground/[0.06] py-2.5 text-[12px] font-medium text-[#017D58] transition-colors hover:bg-foreground/[0.09] active:bg-foreground/[0.12] disabled:opacity-40 dark:text-[#2FB585] md:h-8 md:flex-none md:flex-row md:rounded-md md:border md:bg-background md:px-2.5 md:py-0 md:text-[13px] md:text-foreground md:hover:bg-muted md:dark:text-foreground"
    >
      <Icon className="h-5 w-5 md:h-3.5 md:w-3.5 md:text-muted-foreground" />
      {label}
    </button>
  );
}

function Panel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <div className="flex min-h-11 items-center gap-2 border-b px-4">
        <h3 className="min-w-0 flex-1 truncate text-[14px] font-semibold text-foreground">{title}</h3>
        {action}
      </div>
      <div className="p-4">{children}</div>
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
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("activity");
  const [sources, setSources] = useState<Option[]>([]);

  // Modals / Sliders
  const [contactModal, setContactModal] = useState<{ open: boolean; type: string; to: string }>({ open: false, type: "", to: "" });
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
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);

  // Dropped Reason Modal
  const [isDroppedOpen, setIsDroppedOpen] = useState(false);
  const [dropReason, setDropReason] = useState("");
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  // Not Interested Reason Modal
  const [isNotInterestedOpen, setIsNotInterestedOpen] = useState(false);

  // Edit Requirement
  const [editInquiry, setEditInquiry] = useState<any>(null);

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

  const handleAssignLead = async (toUserId: number) => {
    setIsAssigning(true);
    try {
      const res = await apiFetch(`${API_URL}/lead-routing/assign/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to_user_id: toUserId }),
      });
      if (!res.ok) throw new Error("Failed to assign lead");
      toast.success("Lead reassigned successfully");
      setIsAssignOpen(false);
      fetchLead(true);
    } catch {
      toast.error("Failed to assign lead");
    } finally {
      setIsAssigning(false);
    }
  };

  // "A" jumps to the follow-up timeline, as the old history slider did.
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
        setActiveTab(prev => prev === "followups" ? "activity" : "followups");
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Log New Follow-up Form
  const [fuForm, setFuForm] = useState({
    contactedVia: "",
    nextFollowUpDate: "",
    nextFollowUpTime: "",
    priority: "",
    rnr: "",
    notes: "",
  });
  const [isSavingFu, setIsSavingFu] = useState(false);

  const fetchLead = useCallback(async (silent = false) => {
    if (!id) return;
    if (!silent) setIsLoading(true);
    else setIsRefreshing(true);
    try {
      const res = await apiFetch(`${API_URL}/leads/${id}`);
      const result = await res.json();
      if (result.success) setLead(result.data);
      else { toast.error("Lead not found"); router.push("/leads"); }
    } catch {
      toast.error("Failed to load lead details");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [id, router]);

  useEffect(() => { fetchLead(); }, [fetchLead]);

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
      await fetchLead(true);
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
  // open the follow-up tab once the lead and its follow-ups are in hand. The
  // latch means switching tabs afterwards is not undone by the next render.
  useEffect(() => {
    if (!shouldAutoOpenFollowUps({
      wantsFollowUps: wantsFollowUps(tab),
      isLoading,
      hasLead: !!lead,
      alreadyOpened: autoOpenedFollowUps,
    })) return;
    setActiveTab("followups");
    setAutoOpenedFollowUps(true);
    // `tab` rather than `searchParams`: the param value is the actual
    // dependency, so a fresh object identity can't re-run this effect.
  }, [tab, isLoading, lead, autoOpenedFollowUps]);

  const openContact = (type: string, to: string) => setContactModal({ open: true, type, to });

  const getFuDateObj = (d: string, t: string) => {
    if (!d) return undefined;
    const date = new Date(d);
    if (t) {
      const [hh, mm] = t.split(":");
      date.setHours(parseInt(hh, 10), parseInt(mm, 10), 0, 0);
    }
    return date;
  };

  const handleFuDateTimeChange = (dateObj: Date | undefined) => {
    if (!dateObj) {
      setFuForm(f => ({ ...f, nextFollowUpDate: "", nextFollowUpTime: "" }));
      return;
    }
    setFuForm(f => ({
      ...f,
      nextFollowUpDate: format(dateObj, "yyyy-MM-dd"),
      nextFollowUpTime: format(dateObj, "HH:mm"),
    }));
  };

  const handleSaveFollowUp = async () => {
    if (!fuForm.contactedVia) return toast.error("Please select how you contacted the lead.");

    if (fuForm.nextFollowUpDate) {
      const followUpDateObj = getFuDateObj(fuForm.nextFollowUpDate, fuForm.nextFollowUpTime);
      if (followUpDateObj) {
        const diffTime = Math.abs(followUpDateObj.getTime() - new Date().getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays > 45) {
          toast.error("Follow-up date cannot be more than 45 days in the future.");
          return;
        }
      }
    }

    setIsSavingFu(true);
    const now = new Date();
    const payload = {
      ...fuForm,
      followUpDate: format(now, "yyyy-MM-dd"),
      followUpTime: format(now, "HH:mm"),
    };
    try {
      const res = await apiFetch(`${API_URL}/leads/${id}/follow-ups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Follow-up logged successfully.");
        setFuForm({ contactedVia: "", nextFollowUpDate: "", nextFollowUpTime: "", priority: "", rnr: "", notes: "" });
        fetchLead(true);
      } else toast.error(data.message || "Failed to save follow-up");
    } catch { toast.error("Failed to save follow-up"); }
    finally { setIsSavingFu(false); }
  };

  const followUps: any[] = useMemo(() => lead?.follow_ups || [], [lead]);
  // Defensive newest-first sort (created_at, id tiebreak) — backend orders
  // the same way, but bulk device syncs share second precision.
  const contactLogs: any[] = useMemo(() => sortContactLogs(lead?.contact_logs || []), [lead]);
  const activity = useMemo(() => buildActivity(lead, followUps, contactLogs), [lead, followUps, contactLogs]);
  const sourceOptions = useMemo(() => {
    const current = lead?.lead_source;
    if (!current || sources.some((s) => s.value === current)) return sources;
    return [{ label: current, value: current }, ...sources];
  }, [sources, lead]);

  if (isLoading) return <PageSkeleton />;
  if (!lead) return null;

  const contactCounts = countByType(contactLogs);
  const callDirectionCounts = countCallDirections(contactLogs);
  const statusName = lead.status || "New Lead";

  // RNR Calculation
  let highestRnr = 0;
  if (followUps.length > 0) {
    // Sort follow-ups by date descending locally to ensure we check the most recent one
    const sortedFollowUps = [...followUps].sort((a, b) => {
      const dateA = new Date(`${a.follow_up_date}T${a.follow_up_time || '00:00:00'}`).getTime();
      const dateB = new Date(`${b.follow_up_date}T${b.follow_up_time || '00:00:00'}`).getTime();
      return dateB - dateA;
    });

    const latestFu = sortedFollowUps[0];
    if (latestFu.rnr && typeof latestFu.rnr === 'string' && latestFu.rnr.startsWith("rnr")) {
      const num = parseInt(latestFu.rnr.replace("rnr", ""), 10);
      if (!isNaN(num)) {
        highestRnr = num;
      }
    }
  }
  const nextRnrNumber = highestRnr + 1;
  const nextRnrValue = `rnr${nextRnrNumber}`;
  const isRnrMaxed = highestRnr >= 5;

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
  const showConvert = canEdit && !lead.is_converted &&
    (role === "Admin" || role === "Manager" || ((role === "Staff" || role === "Team Lead") && userDept === "telecalling"));
  const openConvert = () => { setConvertTo(""); setConvertFeedback(""); setIsConvertOpen(true); };

  const inquiries: any[] = lead.inquiries || [];
  const shownTab: Tab = activeTab === "details" && !isMobile ? "activity" : activeTab;

  const tabs: { key: Tab; label: string; icon: typeof Activity; count?: number; mobileOnly?: boolean }[] = [
    { key: "activity", label: "Activity", icon: Activity },
    { key: "details", label: "Details", icon: Info, mobileOnly: true },
    { key: "followups", label: "Follow-ups", icon: ListChecks, count: followUps.length },
    { key: "contact", label: "Calls", icon: PhoneIncoming, count: contactLogs.length },
    { key: "emails", label: "Emails", icon: Mail },
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
        <InlineAction label="Assigned to" onClick={showReassign ? () => setIsAssignOpen(true) : undefined}>
          {lead.assigned_staff?.name ? (
            <>
              <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold", avatarTone(lead.assigned_staff.name))}>
                {initials(lead.assigned_staff.name)}
              </span>
              <span className="truncate">{lead.assigned_staff.name}</span>
            </>
          ) : (
            <span className="text-muted-foreground">Unassigned</span>
          )}
        </InlineAction>
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
        <InlineText label="City" value={lead.city} onSave={(v) => saveLead({ city: v })} disabled={!canEdit} />
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
        {lead.commission_remarks && (
          <FieldRow label="Remarks">
            <span className="whitespace-pre-wrap px-2 py-1.5 text-[14px] text-foreground">{lead.commission_remarks}</span>
          </FieldRow>
        )}
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

  const quickActions = (
    <>
      <QuickAction icon={Phone} label="Call" onClick={() => openContact("call", lead.mobile_number)} disabled={!canEdit || !lead.mobile_number} />
      <QuickAction icon={MessageCircle} label="WhatsApp" onClick={() => openContact("whatsapp", lead.whatsapp_number)} disabled={!canEdit || !lead.whatsapp_number} />
      <QuickAction icon={MessageSquare} label="SMS" onClick={() => openContact("sms", lead.mobile_number)} disabled={!canEdit || !lead.mobile_number} />
      <QuickAction icon={Mail} label="Email" onClick={() => openContact("email", lead.email)} disabled={!canEdit || !lead.email} />
    </>
  );

  const statusDot = <span className={cn("h-2 w-2 shrink-0 rounded-full", LEAD_STATUS_DOTS[statusName] ?? "bg-gray-400")} />;

  const repeatBadge = inquiries.length > 1 && (
    <Badge variant="outline" className="border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-900/60 dark:bg-purple-950/40 dark:text-purple-300">
      Repeat ({inquiries.length - 1})
    </Badge>
  );

  // ── Follow-up composer ──
  const composer = canEdit && (
    <div className="rounded-xl border bg-card">
      <Textarea
        value={fuForm.notes}
        onChange={e => setFuForm(f => ({ ...f, notes: e.target.value }))}
        placeholder="What was discussed? Log a follow-up…"
        disabled={!!fuForm.rnr}
        aria-label="Follow-up notes"
        className="min-h-[88px] resize-none rounded-b-none rounded-t-xl border-0 bg-transparent px-4 py-3 text-[14px] shadow-none focus-visible:ring-0 disabled:opacity-70 dark:bg-transparent"
      />
      <div className="space-y-2 border-t px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-1">
          {CONTACTED_VIA.map(({ label, value, icon: Icon }) => {
            const on = fuForm.contactedVia === value;
            return (
              <button
                key={value}
                type="button"
                aria-pressed={on}
                onClick={() => setFuForm(f => ({ ...f, contactedVia: on ? "" : value }))}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[13px] font-medium transition-colors",
                  on
                    ? "border-[#017D58] bg-[#017D58] text-white dark:border-[#2FB585] dark:bg-[#2FB585] dark:text-black"
                    : "bg-background text-foreground/80 hover:bg-muted",
                )}
              >
                <Icon className="hidden h-3.5 w-3.5 sm:block" />
                {label}
              </button>
            );
          })}
          <button
            type="button"
            disabled={isRnrMaxed}
            aria-pressed={fuForm.rnr === nextRnrValue}
            title="Mark this attempt as Ringing, No Response"
            onClick={() => {
              const isApplying = fuForm.rnr !== nextRnrValue;
              setFuForm(f => ({
                ...f,
                rnr: isApplying ? nextRnrValue : "",
                notes: isApplying ? `RNR ${nextRnrNumber} for this lead` : (f.notes === `RNR ${nextRnrNumber} for this lead` ? "" : f.notes)
              }));
            }}
            className={cn(
              "ml-auto inline-flex h-8 items-center rounded-md border px-2.5 text-[13px] font-medium transition-colors disabled:opacity-50",
              fuForm.rnr === nextRnrValue
                ? "border-orange-500 bg-orange-500 text-white"
                : "bg-background text-foreground/80 hover:bg-muted",
            )}
          >
            {isRnrMaxed ? "Max RNR" : fuForm.rnr === nextRnrValue ? `RNR ${nextRnrNumber} ✓` : `RNR ${nextRnrNumber}`}
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-[160px] flex-1 sm:w-[200px] sm:flex-none">
            <DateTimePicker
              value={getFuDateObj(fuForm.nextFollowUpDate, fuForm.nextFollowUpTime)}
              onChange={handleFuDateTimeChange}
              placeholder="Next follow-up"
              className="h-8! rounded-md! text-[13px]!"
            />
          </div>
          <div className="w-[130px]">
            <FormSelect
              name="priority"
              placeholder="Priority"
              options={PRIORITIES}
              value={fuForm.priority}
              onValueChange={v => setFuForm(f => ({ ...f, priority: v || "" }))}
              className="h-8! rounded-md! bg-background! text-[13px]!"
            />
          </div>
          <button
            type="button"
            onClick={handleSaveFollowUp}
            disabled={isSavingFu}
            className={cn(HEADER_PRIMARY, "ml-auto disabled:opacity-60")}
          >
            {isSavingFu ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUpRight className="h-4 w-4" />}
            Log follow-up
          </button>
        </div>
      </div>
    </div>
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
          <button type="button" onClick={() => fetchLead(true)} title="Refresh" aria-label="Refresh" className={cn(HEADER_BUTTON, "w-8 justify-center px-0")}>
            <RefreshCw className={cn("h-3.5 w-3.5 text-muted-foreground", isRefreshing && "animate-spin")} />
          </button>
          {canEdit ? (
            <DropdownMenu>
              <DropdownMenuTrigger render={<button type="button" className={HEADER_BUTTON} aria-label="Change status" />}>
                {statusDot}
                {statusName}
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="max-h-[360px] w-56">
                {STATUS_OPTIONS.map((opt) => (
                  <DropdownMenuItem key={opt.value} onClick={() => changeStatus(opt.value)} className="gap-2 text-[14px]">
                    <span className={cn("h-2 w-2 rounded-full", opt.dot)} />
                    <span className="flex-1">{opt.label}</span>
                    {opt.value === statusName && <span className="text-[12px] text-muted-foreground">Current</span>}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <span className={cn(HEADER_BUTTON, "hover:bg-background")}>{statusDot}{statusName}</span>
          )}
          {showReassign && (
            <button type="button" onClick={() => setIsAssignOpen(true)} className={HEADER_BUTTON}>
              <UserPlus className="h-3.5 w-3.5 text-muted-foreground" />
              Reassign
            </button>
          )}
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
          {canEdit ? (
            <DropdownMenu>
              <DropdownMenuTrigger render={<button type="button" className="inline-flex h-7 items-center gap-1.5 rounded-full bg-foreground/[0.06] px-3 text-[13px] font-medium text-foreground" aria-label="Change status" />}>
                {statusDot}
                {statusName}
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="max-h-[360px] w-56">
                {STATUS_OPTIONS.map((opt) => (
                  <DropdownMenuItem key={opt.value} onClick={() => changeStatus(opt.value)} className="gap-2 text-[15px]">
                    <span className={cn("h-2 w-2 rounded-full", opt.dot)} />
                    {opt.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-foreground/[0.06] px-3 text-[13px] font-medium text-foreground">{statusDot}{statusName}</span>
          )}
          {repeatBadge}
          <span>{leadCode(lead.id)}</span>
        </div>
        <div className="flex gap-2">{quickActions}</div>
        {(showReassign || showConvert) && (
          <div className="flex gap-2">
            {showReassign && (
              <button type="button" onClick={() => setIsAssignOpen(true)} className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-foreground/[0.06] text-[15px] font-medium text-foreground">
                <UserPlus className="h-4 w-4" /> Reassign
              </button>
            )}
            {showConvert && (
              <button type="button" onClick={openConvert} className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-[#017D58] text-[15px] font-semibold text-white dark:bg-[#2FB585] dark:text-black">
                <TrendingUp className="h-4 w-4" /> Convert
              </button>
            )}
          </div>
        )}
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

          <div className={cn("md:min-h-0 md:flex-1", shownTab === "followups" ? "md:overflow-hidden" : "md:overflow-y-auto")}>
            {shownTab === "details" && (
              <div className="mx-4 mt-2 overflow-hidden rounded-xl border bg-card">{fields}</div>
            )}

            {shownTab === "activity" && (
              <div className="mx-auto max-w-3xl space-y-6 px-4 py-4 md:px-6 md:py-6">
                {composer}
                {activity.length ? <ActivityFeed items={activity} /> : empty(<Clock className="h-5 w-5" />, "No activity yet", "Follow-ups, calls and messages will show up here.")}
              </div>
            )}

            {shownTab === "followups" && (
              <div className="h-[70dvh] md:h-full">
                <FollowUpPanel
                  entityId={Number(id)}
                  entityType="leads"
                  followUps={followUps}
                  onRefresh={() => fetchLead(true)}
                />
              </div>
            )}

            {shownTab === "contact" && (
              <div className="mx-auto max-w-3xl space-y-6 px-4 py-4 md:px-6 md:py-6">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-xl border bg-card p-3.5">
                    <p className="flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground"><PhoneIncoming className="h-3.5 w-3.5" /> Calls</p>
                    <p className="mt-1 text-[24px] font-semibold tabular-nums leading-8 text-foreground">{contactCounts.call || 0}</p>
                    <p className="text-[11.5px] text-muted-foreground">
                      {callDirectionCounts.incoming || 0} in · {callDirectionCounts.outgoing || 0} out · {callDirectionCounts.missed || 0} missed
                    </p>
                  </div>
                  {(["whatsapp", "sms", "email"] as const).map((type) => (
                    <div key={type} className="rounded-xl border bg-card p-3.5">
                      <p className="flex items-center gap-1.5 text-[12px] font-medium capitalize text-muted-foreground">{CONTACT_TYPE_ICONS[type]} {type === "sms" ? "SMS" : type}</p>
                      <p className="mt-1 text-[24px] font-semibold tabular-nums leading-8 text-foreground">{contactCounts[type] || 0}</p>
                    </div>
                  ))}
                </div>
                {contactLogs.length === 0 ? (
                  empty(<Clock className="h-5 w-5" />, "No contact logs yet", "Calls and messages will appear here.")
                ) : (
                  <ul className="divide-y rounded-xl border bg-card">
                    {contactLogs.map((log: any) => (
                      <li key={log.id} className="flex gap-3 px-4 py-3">
                        <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full [&_svg]:h-4 [&_svg]:w-4", CONTACT_TYPE_STYLES[log.contact_type] || "bg-muted text-muted-foreground")}>
                          {contactLogIcon(log)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline gap-3">
                            <p className="min-w-0 flex-1 truncate text-[14px] font-medium text-foreground">
                              {log.contact_type === "call"
                                ? <>{log.call_direction || "Voice"} call <span className="font-normal text-muted-foreground">· {formatDuration(log.call_duration)}</span></>
                                : <span className="capitalize">{log.contact_type === "sms" ? "SMS" : log.contact_type}</span>}
                            </p>
                            <span className="shrink-0 text-[12px] text-muted-foreground">{formatTimestamp(log.created_at)}</span>
                          </div>
                          <p className="text-[13px] text-muted-foreground">{contactLogAuthor(log)}</p>
                          {log.subject && <p className="mt-1.5 text-[13px] font-medium text-foreground/80">Subject: {log.subject}</p>}
                          {log.message && <p className="mt-1.5 whitespace-pre-wrap rounded-lg bg-muted/40 px-3 py-2 text-[13px] leading-relaxed text-foreground/80">{log.message}</p>}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {shownTab === "emails" && (
              <div className="mx-auto max-w-3xl px-4 py-4 md:px-6 md:py-6">
                <MailPanel entityType="lead" entityId={lead.id} refreshKey={mailRefresh} recipients={lead.email ? [lead.email] : []} />
              </div>
            )}

            {shownTab === "requirements" && (
              <div className="mx-auto max-w-4xl space-y-5 px-4 py-4 md:px-6 md:py-6">
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

                {inquiries.length === 0 && empty(<Building2 className="h-5 w-5" />, "No requirements yet", "Requirements captured for this lead will show up here.")}

                {inquiries.map((inq: any, idx: number) => {
                  const typeOptions = PROPERTY_TYPES_MAP[inq.property_category] ?? Object.values(PROPERTY_TYPES_MAP).flat();
                  const prefs = Object.entries(inq.preferences ?? {}).filter(([, v]) => v !== "" && v != null);
                  return (
                    <Panel
                      key={inq.id || idx}
                      title={inquiries.length > 1 ? `Requirement #${idx + 1}` : "Requirement"}
                      action={canEdit && (
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={() => setEditInquiry(inq)} className={HEADER_BUTTON}>
                            <Pencil className="h-3.5 w-3.5 text-muted-foreground" /> <span className="sm:hidden">Edit</span><span className="hidden sm:inline">Location & preferences</span>
                          </button>
                          {idx === 0 && (
                            <button type="button" onClick={fetchAutoMatch} disabled={isMatching} className={cn(HEADER_PRIMARY, "disabled:opacity-60")}>
                              {isMatching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                              <span className="sm:hidden">Match</span><span className="hidden sm:inline">Auto match</span>
                            </button>
                          )}
                        </div>
                      )}
                    >
                      <div className="grid gap-x-8 gap-y-0 md:grid-cols-2">
                        <div>
                          <InlineSelect label="Purchase type" value={inq.purchase_type} options={PURCHASE_TYPES} onSave={(v) => saveInquiry(inq.id, { purchaseType: v })} disabled={!canEdit} />
                          <InlineSelect label="Category" value={inq.property_category} options={PROPERTY_CATEGORIES} onSave={(v) => saveInquiry(inq.id, { propertyCategory: v, propertyType: null })} disabled={!canEdit} />
                          <InlineSelect label="Property type" value={inq.property_type} options={typeOptions} onSave={(v) => saveInquiry(inq.id, { propertyType: v })} disabled={!canEdit} />
                          <InlineSelect label="Funding" value={inq.funder} options={FUNDERS} onSave={(v) => saveInquiry(inq.id, { funder: v })} disabled={!canEdit} />
                        </div>
                        <div>
                          <InlineText label="Project" value={inq.project_list} onSave={(v) => saveInquiry(inq.id, { project: v || null })} disabled={!canEdit} />
                          <InlineSelect label="Timeline" value={inq.purchase_timeline} options={PURCHASE_TIMELINES} onSave={(v) => saveInquiry(inq.id, { purchaseTimeline: v })} disabled={!canEdit} />
                          <InlineSelect label="Purpose" value={inq.qualification_purpose} options={QUALIFICATION_PURPOSES} onSave={(v) => saveInquiry(inq.id, { qualificationPurpose: v })} disabled={!canEdit} />
                          <InlineText label="Decision maker" value={inq.decision_maker} placeholder="e.g. Self, Spouse" onSave={(v) => saveInquiry(inq.id, { decisionMaker: v || null })} disabled={!canEdit} />
                        </div>
                      </div>
                      {(inq.sub_locations?.length > 0 || prefs.length > 0) && (
                        <div className="mt-3 space-y-3 border-t pt-3">
                          {inq.sub_locations?.length > 0 && (
                            <FieldRow label="Locations">
                              <div className="flex flex-wrap gap-1.5 px-2 py-1">
                                {inq.sub_locations.map((loc: string) => (
                                  <span key={loc} className="rounded-md bg-foreground/[0.06] px-2 py-0.5 text-[13px] text-foreground/85">{loc}</span>
                                ))}
                              </div>
                            </FieldRow>
                          )}
                          {prefs.length > 0 && (
                            <div className="grid gap-x-8 md:grid-cols-2">
                              {prefs.map(([key, val]) => (
                                <FieldRow key={key} label={key === "bhk" ? "BHK" : humanize(key.replace(/([A-Z])/g, " $1")).trim().replace(/^./, (c) => c.toUpperCase())}>
                                  <span className="truncate px-2 text-[14px] text-foreground">{String(val)}</span>
                                </FieldRow>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </Panel>
                  );
                })}
              </div>
            )}

            {shownTab === "attachments" && (
              <div className="mx-auto max-w-3xl px-4 py-4 md:px-6 md:py-6">
                <LeadAttachments
                  leadId={id as string}
                  documents={lead?.documents || []}
                  onRefresh={() => fetchLead(true)}
                />
              </div>
            )}
          </div>
        </div>

        {/* ── Sidebar: the record ── */}
        <aside className="hidden w-[340px] shrink-0 flex-col overflow-y-auto border-l md:flex xl:w-[360px]">
          <div className="space-y-3 border-b p-4">
            <div className="flex items-center gap-3">
              <span className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-[17px] font-semibold", avatarTone(lead.name || ""))}>
                {initials(lead.name || "")}
              </span>
              <div className="min-w-0">
                <p className="truncate text-[17px] font-semibold leading-6 text-foreground">{lead.name}</p>
                <p className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
                  {leadCode(lead.id)}
                  {repeatBadge}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">{quickActions}</div>
          </div>
          {fields}
          {canEdit && (
            <p className="mt-auto flex items-center gap-1.5 px-4 py-3 text-[12px] text-muted-foreground">
              <History className="h-3.5 w-3.5" /> Changes save as you go. Press <kbd className="rounded border px-1 font-mono text-[11px]">A</kbd> for follow-ups.
            </p>
          )}
        </aside>
      </div>

      {/* ── Auto Match Slider (Sheet) ── */}
      <Sheet open={isAutoMatchOpen} onOpenChange={setIsAutoMatchOpen}>
        <SheetContent side="right" className="w-[450px] !max-w-[450px] p-0 flex flex-col border-l">
          <SheetHeader className="p-6 border-b shrink-0 bg-blue-50 dark:bg-blue-900/20">
            <SheetTitle className="text-lg text-[#0052FF] dark:text-blue-400">Auto Match Results</SheetTitle>
            <SheetDescription>
              Properties matching the customer preferences.
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {autoMatchResults.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">No matching properties found.</p>
            ) : (
              autoMatchResults.map((prop) => (
                <div key={prop.id} className="border rounded-xl p-4 shadow-sm bg-card hover:border-blue-200 dark:hover:border-blue-800 transition-colors">
                  <h4 className="font-bold text-[15px] mb-1">{prop.title}</h4>
                  <div className="flex gap-2 mb-3">
                    <Badge variant="secondary" className="text-[10px] uppercase bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">{prop.property_type}</Badge>
                    <Badge variant="outline" className="text-[10px]">{prop.listing_type}</Badge>
                    <Badge variant="outline" className="text-[10px]">{prop.status}</Badge>
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
            <DialogTitle>Lead Dropped Reason</DialogTitle>
            <DialogDescription>
              Please provide the reason for dropping this lead.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-3">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Reason *</label>
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

      {/* ── Contact Modal ── */}
      <ContactModal
        open={contactModal.open}
        type={contactModal.type}
        to={contactModal.to}
        entityId={Number(id)}
        entityType="leads"
        onClose={() => setContactModal({ open: false, type: "", to: "" })}
        onSent={() => fetchLead(true)}
      />

      {/* ── Convert Lead Dialog ── */}
      <Dialog open={isConvertOpen} onOpenChange={(o) => !o && setIsConvertOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Convert Lead</DialogTitle>
            <DialogDescription>
              Select the conversion type and provide feedback to convert this lead.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Conversion Type</label>
              <div className="flex gap-3">
                {([
                  { label: "Inbound", value: "inbound" as const },
                  { label: "Agent Network", value: "agent" as const },
                ]).map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setConvertTo(opt.value)}
                    className={[
                      "flex-1 h-11 rounded-xl border text-sm font-semibold transition-all",
                      convertTo === opt.value
                        ? "bg-emerald-600 text-white border-emerald-600"
                        : "border-border hover:border-emerald-300 text-foreground",
                    ].join(" ")}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Feedback *</label>
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
              className="bg-emerald-600 text-white hover:bg-emerald-700"
            >
              {isConverting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirm Conversion
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Requirement Modal ── */}
      <EditRequirementModal
        open={!!editInquiry}
        onClose={() => setEditInquiry(null)}
        inquiry={editInquiry}
        leadId={Number(id)}
        onSuccess={() => fetchLead(true)}
      />

      {/* ── Assign Lead Modal ── */}
      <AssignLeadModal
        open={isAssignOpen}
        onClose={() => setIsAssignOpen(false)}
        onConfirm={handleAssignLead}
        department={role === "Team Lead" ? userDept : "all"}
        isLoading={isAssigning}
      />
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
