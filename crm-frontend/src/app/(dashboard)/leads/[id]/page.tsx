"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { FormSelect } from "@/components/shared/form-select";
import { DateTimePicker } from "@/components/shared/datetime-picker";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  ArrowLeft, Loader2, User, Phone, MapPin, Building2, Calendar,
  Briefcase, Mail, MessageSquare, Edit, Plus,
  Clock, Send, RefreshCw,
  ArrowUpRight
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

const STATUS_STYLES: Record<string, string> = {
  "INCOMING":        "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900 dark:text-gray-300",
  "NEW":             "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900 dark:text-gray-300",
  "OPPORTUNITY":     "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400",
  "SITE VISIT DONE": "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400",
  "RSV DONE":        "bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400",
  "RSV SCHEDULE":    "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400",
  "PROSPECTIVE":     "bg-lime-100 text-lime-800 border-lime-200 dark:bg-lime-900/30 dark:text-lime-400",
  "DROPPED":         "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400",
  "BOOKED":          "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400",
  "SV SCHEDULE":     "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400",
  "REJECT":          "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400",
};

const CONTACT_TYPE_STYLES: Record<string, string> = {
  email:    "bg-blue-100 text-blue-700 border-blue-200",
  sms:      "bg-green-100 text-green-700 border-green-200",
  whatsapp: "bg-emerald-100 text-emerald-700 border-emerald-200",
  call:     "bg-purple-100 text-purple-700 border-purple-200",
};

const CONTACT_TYPE_ICONS: Record<string, React.ReactNode> = {
  email:    <Mail className="h-3.5 w-3.5" />,
  sms:      <MessageSquare className="h-3.5 w-3.5" />,
  whatsapp: <Phone className="h-3.5 w-3.5" />,
  call:     <Phone className="h-3.5 w-3.5" />,
};

const PRIORITY_STYLES: Record<string, string> = {
  low:    "bg-gray-100 text-gray-700 border-gray-200",
  medium: "bg-yellow-100 text-yellow-700 border-yellow-200",
  high:   "bg-orange-100 text-orange-700 border-orange-200",
  urgent: "bg-red-100 text-red-700 border-red-200",
};

const PRIORITIES = [
  { label: "Low", value: "low" },
  { label: "Medium", value: "medium" },
  { label: "High", value: "high" },
  { label: "Urgent", value: "urgent" },
];

const CONTACTED_VIA = [
  { label: "Call", value: "call" },
  { label: "WhatsApp", value: "whatsapp" },
  { label: "SMS", value: "sms" },
  { label: "Email", value: "email" },
];

const RNR_OPTIONS = [
  { label: "RNR 1", value: "rnr1" },
  { label: "RNR 2", value: "rnr2" },
  { label: "RNR 3", value: "rnr3" },
  { label: "RNR 4", value: "rnr4" },
  { label: "RNR 5", value: "rnr5" },
];

function formatTime12hr(timeString: string) {
  if (!timeString) return "";
  const [hours, minutes] = timeString.split(":");
  if (!hours || !minutes) return timeString;
  let h = parseInt(hours, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${minutes} ${ampm}`;
}

function formatFollowUpDate(dateStr: string) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", { day: "numeric", weekday: "short", month: "short", year: "2-digit" });
}

function formatTimestamp(ts: string) {
  const d = new Date(ts);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) +
    " at " + d.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true });
}

// ── Contact Modal ────────────────────────────────────────────────────────────
function ContactModal({
  open, type, to, leadId, onClose, onSent,
}: { open: boolean; type: string; to: string; leadId: number; onClose: () => void; onSent: () => void }) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);

  const handleSend = async () => {
    setIsSending(true);
    try {
      await fetch(`${API_URL}/leads/${leadId}/contact-log`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact_type: type, subject, message }),
      });
      toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} logged successfully. API integration coming soon.`);
      setSubject("");
      setMessage("");
      onSent();
      onClose();
    } catch {
      toast.error("Failed to log contact.");
    } finally {
      setIsSending(false);
    }
  };

  const titles: Record<string, string> = {
    email: `Send Email to ${to}`,
    sms: `Send SMS to ${to}`,
    whatsapp: `Send WhatsApp to ${to}`,
    call: `Log Call with ${to}`,
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className={`h-10 w-10 rounded-xl flex items-center justify-center border ${CONTACT_TYPE_STYLES[type] || ""}`}>
              {CONTACT_TYPE_ICONS[type]}
            </div>
            <div>
              <DialogTitle className="text-lg">{titles[type]}</DialogTitle>
              <DialogDescription className="text-sm">This will be logged as a contact attempt.</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {(type === "email" || type === "sms") && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Subject</label>
              <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject line..." className="h-11 rounded-xl bg-muted/30" />
            </div>
          )}
          {type === "call" ? (
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Call Notes</label>
              <Textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="What was discussed on this call?" className="rounded-xl bg-muted/30 resize-none" rows={5} />
            </div>
          ) : (
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Message</label>
              <Textarea value={message} onChange={e => setMessage(e.target.value)} placeholder={`Write your ${type} message here...`} className="rounded-xl bg-muted/30 resize-none" rows={6} />
            </div>
          )}
          <p className="text-xs text-muted-foreground bg-muted/30 rounded-lg px-3 py-2">
            API integration coming soon. This will be logged as a timestamp in the contact history.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSend} disabled={isSending} className="bg-[#0052FF] text-white hover:bg-[#0040CC] gap-2">
            {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {type === "call" ? "Log Call" : `Send ${type.charAt(0).toUpperCase() + type.slice(1)}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function LeadViewPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [lead, setLead] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Contact modal
  const [contactModal, setContactModal] = useState<{ open: boolean; type: string; to: string }>({ open: false, type: "", to: "" });

  // Follow-up form
  const [fuForm, setFuForm] = useState(() => {
    const now = new Date();
    return {
      followUpDate: now.toISOString().split("T")[0],
      followUpTime: now.toTimeString().slice(0, 5),
      contactedVia: "",
      nextFollowUpDate: "",
      nextFollowUpTime: "",
      priority: "",
      rnr: "",
      notes: "",
    };
  });
  const [isSavingFu, setIsSavingFu] = useState(false);

  // Follow-up edit modal
  const [editFu, setEditFu] = useState<any>(null);
  const [editFuForm, setEditFuForm] = useState<any>({});
  const [isSavingEditFu, setIsSavingEditFu] = useState(false);

  // Follow-up delete modal
  const [deleteFuId, setDeleteFuId] = useState<number | null>(null);
  const [isDeletingFu, setIsDeletingFu] = useState(false);

  const fetchLead = useCallback(async (silent = false) => {
    if (!id) return;
    if (!silent) setIsLoading(true);
    else setIsRefreshing(true);
    try {
      const res = await fetch(`${API_URL}/leads/${id}`);
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

  const openContact = (type: string, to: string) => setContactModal({ open: true, type, to });

  // Contact counts by type
  const contactCounts = lead?.contact_logs?.reduce((acc: any, log: any) => {
    acc[log.contact_type] = (acc[log.contact_type] || 0) + 1;
    return acc;
  }, {}) ?? {};

  // Convert string date/time to Date object
  const getFuDateObj = (d: string, t: string) => {
    if (!d) return undefined;
    const date = new Date(d);
    if (t) {
      const [hh, mm] = t.split(":");
      date.setHours(parseInt(hh, 10), parseInt(mm, 10), 0, 0);
    }
    return date;
  };

  const handleFuDateTimeChange = (fieldPrefix: "followUp" | "nextFollowUp", dateObj: Date | undefined) => {
    if (!dateObj) {
      setFuForm(f => ({ ...f, [`${fieldPrefix}Date`]: "", [`${fieldPrefix}Time`]: "" }));
      return;
    }
    setFuForm(f => ({
      ...f,
      [`${fieldPrefix}Date`]: format(dateObj, "yyyy-MM-dd"),
      [`${fieldPrefix}Time`]: format(dateObj, "HH:mm"),
    }));
  };

  const handleEditDateTimeChange = (fieldPrefix: "followUp" | "nextFollowUp", dateObj: Date | undefined) => {
    if (!dateObj) {
      setEditFuForm((f: any) => ({ ...f, [`${fieldPrefix}Date`]: "", [`${fieldPrefix}Time`]: "" }));
      return;
    }
    setEditFuForm((f: any) => ({
      ...f,
      [`${fieldPrefix}Date`]: format(dateObj, "yyyy-MM-dd"),
      [`${fieldPrefix}Time`]: format(dateObj, "HH:mm"),
    }));
  };

  // Save new follow-up
  const handleSaveFollowUp = async () => {
    if (!fuForm.contactedVia) return toast.error("Please select how you contacted the lead.");
    setIsSavingFu(true);
    try {
      const res = await fetch(`${API_URL}/leads/${id}/follow-ups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fuForm),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Follow-up logged successfully.");
        const now = new Date();
        setFuForm({ 
          followUpDate: now.toISOString().split("T")[0], 
          followUpTime: now.toTimeString().slice(0, 5), 
          contactedVia: "", nextFollowUpDate: "", nextFollowUpTime: "", priority: "", rnr: "", notes: "" 
        });
        fetchLead(true);
      } else toast.error(data.message || "Failed to save follow-up");
    } catch { toast.error("Failed to save follow-up"); }
    finally { setIsSavingFu(false); }
  };

  // Edit follow-up
  const openEditFu = (fu: any) => {
    setEditFu(fu);
    setEditFuForm({
      followUpDate: fu.follow_up_date || "",
      followUpTime: fu.follow_up_time || "",
      contactedVia: fu.contacted_via || "",
      nextFollowUpDate: fu.next_follow_up_date || "",
      nextFollowUpTime: fu.next_follow_up_time || "",
      priority: fu.priority || "",
      rnr: fu.rnr || "",
      notes: fu.notes || "",
    });
  };

  const handleEditSave = async () => {
    if (!editFu) return;
    setIsSavingEditFu(true);
    try {
      const res = await fetch(`${API_URL}/leads/${id}/follow-ups/${editFu.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editFuForm),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Follow-up updated.");
        setEditFu(null);
        fetchLead(true);
      } else toast.error("Failed to update follow-up");
    } catch { toast.error("Failed to update follow-up"); }
    finally { setIsSavingEditFu(false); }
  };

  const handleDeleteFu = async () => {
    if (!deleteFuId) return;
    setIsDeletingFu(true);
    try {
      const res = await fetch(`${API_URL}/leads/${id}/follow-ups/${deleteFuId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        toast.success("Follow-up deleted.");
        setDeleteFuId(null);
        fetchLead(true);
      } else toast.error("Failed to delete follow-up");
    } catch { toast.error("Failed to delete follow-up"); }
    finally { setIsDeletingFu(false); }
  };

  if (isLoading) return (
    <div className="space-y-6 pb-16 animate-in fade-in duration-500">
      {/* Header Skeleton */}
      <div className="flex items-center justify-between pr-[150px] min-h-[48px]">
        <div className="flex items-center gap-4">
          <Skeleton className="h-9 w-9 rounded-full shrink-0" />
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-6 w-24 rounded-md" />
              <Skeleton className="h-5 w-20" />
            </div>
            <Skeleton className="h-4 w-40" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-9 rounded-full" />
          <Skeleton className="h-10 w-28 rounded-lg" />
        </div>
      </div>

      {/* Row 1: Customer Info & Assignment */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          {/* Customer Info */}
          <div className="bg-card border rounded-2xl p-6 shadow-sm">
            <Skeleton className="h-5 w-48 mb-6" />
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-y-6 gap-x-6">
              {[...Array(5)].map((_, i) => (
                <div key={i} className={i === 4 ? "col-span-2 lg:col-span-3" : ""}>
                  <Skeleton className="h-3 w-20 mb-2" />
                  <Skeleton className="h-4 w-32" />
                </div>
              ))}
            </div>
          </div>
          {/* Quick Actions */}
          <div className="bg-card border rounded-2xl p-6 shadow-sm">
            <Skeleton className="h-5 w-32 mb-6" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <Skeleton className="h-3 w-24 mb-2" />
                <Skeleton className="h-11 w-full rounded-xl" />
              </div>
              <div>
                <Skeleton className="h-3 w-32 mb-2" />
                <Skeleton className="h-12 w-full rounded-xl" />
              </div>
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          <div className="bg-card border rounded-2xl p-6 shadow-sm">
            <Skeleton className="h-5 w-40 mb-6" />
            <Skeleton className="h-3 w-28 mb-2" />
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="bg-card border rounded-2xl p-6 shadow-sm">
            <Skeleton className="h-5 w-32 mb-6" />
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex justify-between items-center py-1">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-3 w-28" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Contact Log Timeline */}
      <div className="bg-card border rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between border-b pb-4 mb-6">
          <Skeleton className="h-5 w-32" />
          <div className="flex gap-2">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-7 w-16 rounded-full" />)}
          </div>
        </div>
        <div className="space-y-6">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="flex gap-4">
              <Skeleton className="h-10 w-10 rounded-full shrink-0" />
              <div className="space-y-2 flex-1 pt-1">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-12 w-full max-w-md rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Follow-Up History */}
      <div className="bg-card border rounded-2xl p-6 shadow-sm">
        <Skeleton className="h-5 w-48 mb-6" />
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center gap-6 border-b pb-4">
              <Skeleton className="h-4 w-4 shrink-0" />
              <Skeleton className="h-6 w-24 rounded-full shrink-0" />
              <Skeleton className="h-6 w-20 rounded-full shrink-0" />
              <div className="space-y-1.5 shrink-0">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-10 w-full rounded-lg" />
              <div className="flex gap-2 shrink-0">
                <Skeleton className="h-8 w-8 rounded-md" />
                <Skeleton className="h-8 w-8 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Log New Follow-Up */}
      <div className="bg-card border rounded-2xl p-6 shadow-sm">
        <Skeleton className="h-5 w-40 mb-6" />
        <div className="flex flex-col xl:flex-row gap-6">
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-5 h-fit">
            {[...Array(4)].map((_, i) => (
              <div key={i}>
                <Skeleton className="h-3 w-28 mb-2" />
                <Skeleton className="h-11 w-full rounded-xl" />
              </div>
            ))}
            <div className="md:col-span-2">
              <Skeleton className="h-3 w-24 mb-2" />
              <Skeleton className="h-11 w-full rounded-xl" />
            </div>
          </div>
          <div className="w-full xl:w-[450px] flex flex-col gap-4">
            <div className="flex-1 flex flex-col">
              <Skeleton className="h-3 w-20 mb-2" />
              <Skeleton className="w-full rounded-xl flex-1 min-h-[120px]" />
            </div>
            <Skeleton className="h-11 w-full rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );

  if (!lead) return null;

  const inquiry = lead.inquiries?.[0];
  const statusName = lead.status?.name || "INCOMING";
  const badgeCls = STATUS_STYLES[statusName] ?? "bg-gray-100 text-gray-800 border-gray-200";
  const followUps: any[] = lead.follow_ups || [];
  const contactLogs: any[] = lead.contact_logs || [];

  return (
    <div className="space-y-6 pb-16 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* ── Header ── */}
      <div className="flex items-center justify-between pr-[150px] min-h-[48px]">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" className="h-9 w-9 rounded-full shrink-0" onClick={() => router.push("/leads")}>
            <ArrowLeft className="h-4 w-4 text-muted-foreground" />
          </Button>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{lead.name}</h1>
            {lead.is_unqualified ? 
              <Badge variant="destructive" className="font-medium px-2.5 py-0.5 shadow-sm border border-red-300">Unqualified</Badge>
              : <Badge className={`font-medium px-2.5 py-0.5 shadow-sm border ${badgeCls}`}>{statusName}</Badge>
            }
            <span className="text-sm font-semibold text-muted-foreground ml-2">L{String(lead.id).padStart(5, "0")}</span>
            <span className="text-muted-foreground/40 text-xs">•</span>
            <span className="text-sm text-muted-foreground flex items-center gap-1.5">
              Created on {new Date(lead.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-9 w-9 rounded-full" onClick={() => fetchLead(true)} title="Refresh">
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
          </Button>
          <Button onClick={() => router.push(`/leads/new?edit=${lead.id}`)} className="rounded-full px-8 py-5 bg-[#0052FF] text-white hover:bg-[#0040CC] shadow-md">
            Edit Lead
          </Button>
        </div>
      </div>

      {/* ── Row 1: Customer Info + Assignment + Follow-Up Snapshot ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Left Column: Customer Information & Quick Actions */}
        <div className="xl:col-span-2 space-y-6">
          
          {/* Customer Information */}
          <div className="bg-card border rounded-2xl p-6 shadow-sm h-fit">
            <h3 className="text-base font-bold text-foreground border-b pb-3 mb-5 flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" /> Customer Information
            </h3>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-y-6 gap-x-6">

              {/* Mobile – clickable */}
              <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Mobile</p>
              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={() => openContact("call", lead.mobile_number)} className="flex items-center gap-1.5 text-[14px] font-medium text-foreground hover:text-[#0052FF] transition-colors group">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground group-hover:text-[#0052FF]" /> {lead.mobile_number || "—"}
                </button>
                {lead.mobile_number && (
                  <button onClick={() => openContact("sms", lead.mobile_number)} className="text-[11px] px-2 py-0.5 rounded-full border bg-green-50 text-green-700 border-green-200 hover:bg-green-100 transition-colors">SMS</button>
                )}
              </div>
            </div>

            {/* WhatsApp – clickable */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">WhatsApp</p>
              <button disabled={!lead.whatsapp_number} onClick={() => openContact("whatsapp", lead.whatsapp_number)} className="flex items-center gap-1.5 text-[14px] font-medium text-foreground hover:text-emerald-600 transition-colors group disabled:opacity-40 disabled:cursor-default">
                <Phone className="h-3.5 w-3.5 text-emerald-600" /> {lead.whatsapp_number || "—"}
              </button>
            </div>

            {/* Email – clickable */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Email</p>
              <button disabled={!lead.email} onClick={() => openContact("email", lead.email)} className="flex items-center gap-1.5 text-[14px] font-medium text-foreground hover:text-[#0052FF] transition-colors group disabled:opacity-40 disabled:cursor-default">
                <Mail className="h-3.5 w-3.5 text-muted-foreground group-hover:text-[#0052FF]" />
                <span className="truncate max-w-[160px]">{lead.email || "—"}</span>
              </button>
            </div>

            {/* City */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">City</p>
              <p className="flex items-center gap-1.5 text-[14px] font-medium">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground" /> {lead.city || "—"}
              </p>
            </div>

            {/* Lead Source */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Lead Source</p>
              <Badge variant="outline" className="text-sm p-4 font-medium">{lead.lead_source || "Unknown"}</Badge>
            </div>

            {/* Address */}
              <div className="col-span-2 lg:col-span-3">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Address</p>
                <p className="text-[14px] font-medium text-foreground/80">{lead.address || "—"}</p>
              </div>
            </div>
          </div>

          {/* Quick Actions (Status & Qualify) */}
          <div className="bg-card border rounded-2xl p-6 shadow-sm h-fit">
            <h3 className="text-base font-bold text-foreground border-b pb-3 mb-5 flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-muted-foreground" /> Quick Actions
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              
              {/* Change Lead Status */}
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Lead Status</p>
                <div className="flex items-center gap-2">
                  <FormSelect 
                    name="quickLeadStatus" 
                    placeholder="Select Status" 
                    options={Object.keys(STATUS_STYLES).map(k => ({ label: k, value: k }))} 
                    value={lead.status?.name || ""} 
                    onValueChange={async (v) => {
                      if (!v) return;
                      try {
                        const res = await fetch(`${API_URL}/leads/${id}/status`, {
                          method: "PUT",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ status_name: v }),
                        });
                        const data = await res.json();
                        if (data.success) {
                          toast.success("Lead status updated.");
                          fetchLead(true);
                        } else toast.error("Failed to update status");
                      } catch {
                        toast.error("Failed to update status");
                      }
                    }} 
                  />
                </div>
              </div>

              {/* Qualify/Unqualify Toggle */}
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Lead Qualification</p>
                <div className="flex items-center justify-between h-12 px-4 rounded-xl border border-input bg-muted/20">
                  <span className="text-[14px] font-medium text-foreground/80">Unqualify Lead</span>
                  <button 
                    role="switch" 
                    aria-checked={lead.is_unqualified || false}
                    onClick={async () => {
                      const newVal = !lead.is_unqualified;
                      try {
                        const res = await fetch(`${API_URL}/leads/${id}/status`, {
                          method: "PUT",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ is_unqualified: newVal }),
                        });
                        const data = await res.json();
                        if (data.success) {
                          toast.success(newVal ? "Lead marked as unqualified." : "Lead marked as qualified.");
                          fetchLead(true);
                        } else toast.error("Failed to update qualification status");
                      } catch {
                        toast.error("Failed to update qualification status");
                      }
                    }}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${lead.is_unqualified ? "bg-red-500" : "bg-muted"}`}
                  >
                    <span className={`pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform ${lead.is_unqualified ? "translate-x-5.5" : "translate-x-0.5"}`} />
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* Right column: Assignment + Requirement */}
        <div className="space-y-6">
          {/* Assignment */}
          <div className="bg-card border rounded-2xl p-6 shadow-sm">
            <h3 className="text-base font-bold text-foreground border-b pb-3 mb-5 flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-muted-foreground" /> Lead Assignment
            </h3>
            <div className="space-y-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Assigned Staff</p>
                <p className="text-[15px] font-semibold">{lead.assigned_staff?.name || "Unassigned"}</p>
              </div>
            </div>
          </div>

          {/* Requirement */}
          <div className="bg-card border rounded-2xl p-6 shadow-sm">
            <h3 className="text-base font-bold text-foreground border-b pb-3 mb-5 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" /> Requirement
            </h3>
            <div className="space-y-3 text-sm">
              {[
                { label: "Project", value: inquiry?.project_list?.replace(/_/g, " ") },
                { label: "Purchase Type", value: inquiry?.purchase_type?.replace(/_/g, " ") },
                { label: "Property Type", value: inquiry?.property_type?.replace(/_/g, " ") },
                { label: "Category", value: inquiry?.property_category?.replace(/_/g, " ") },
                { label: "Funder", value: inquiry?.funder?.replace(/_/g, " ") },
              ].map(f => (
                <div key={f.label} className="flex justify-between items-center py-1.5 border-b border-border/30 last:border-0">
                  <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">{f.label}</span>
                  <span className="font-medium capitalize text-[14px]">{f.value || "—"}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Contact Log Timeline ── */}
      <div className="bg-card border rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between border-b pb-3 mb-5">
          <h3 className="text-base font-bold text-foreground flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" /> Contact Log
          </h3>
          {/* Summary counts */}
          <div className="flex items-center gap-2 flex-wrap">
            {(["call", "whatsapp", "sms", "email"] as const).map(type => (
              <div key={type} className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-semibold ${CONTACT_TYPE_STYLES[type]}`}>
                {CONTACT_TYPE_ICONS[type]}
                <span className="capitalize">{type}</span>
                <span className="ml-0.5 font-bold">{contactCounts[type] || 0}</span>
              </div>
            ))}
          </div>
        </div>

        {contactLogs.length === 0 ? (
          <p className="text-sm text-muted-foreground italic text-center py-6">No contact attempts recorded yet. Use the buttons on the contact details above to log one.</p>
        ) : (
          <div className="relative space-y-0">
            <div className="absolute left-[19px] top-0 bottom-0 w-px bg-border/50" />
            {contactLogs.map((log: any, i: number) => (
              <div key={log.id} className="flex gap-4 pb-4 relative">
                <div className={`relative z-10 h-10 w-10 shrink-0 rounded-full border-2 border-background flex items-center justify-center ${CONTACT_TYPE_STYLES[log.contact_type] || "bg-gray-100"}`}>
                  {CONTACT_TYPE_ICONS[log.contact_type] || <MessageSquare className="h-3.5 w-3.5" />}
                </div>
                <div className="flex-1 pt-1.5">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="text-[13.5px] font-semibold text-foreground">
                      <span className="capitalize">{log.contact_type}</span> by{" "}
                      <span className="text-[#0052FF]">{log.sent_by?.name || "Staff"}</span>
                    </p>
                    <span className="text-xs text-muted-foreground">{formatTimestamp(log.created_at)}</span>
                  </div>
                  {log.subject && <p className="text-xs text-muted-foreground mt-0.5">Subject: {log.subject}</p>}
                  {log.message && <p className="text-[13px] text-foreground/70 mt-1 bg-muted/30 rounded-lg px-3 py-2">{log.message}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Follow-Up History ── */}
      <div className="bg-card border rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b pb-4 flex items-center gap-3 bg-muted/10">
          <div className="h-8 w-8 rounded-full flex items-center justify-center">
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">Follow Up History</h3>
            {/* <p className="text-xs text-muted-foreground mt-0.5
          <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center border border-blue-200">Track interactions and scheduled events.</p> */}
          </div>
          <Badge variant="outline" className="ml-auto text-xs bg-background px-4 py-4">{followUps.length} Follow ups</Badge>
        </div>

        {followUps.length === 0 ? (
          <p className="text-sm text-muted-foreground italic text-center py-10">No follow-up history yet. Use the form below to log the first one.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30">
                <tr className="border-b text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  <th className="py-3 px-4 text-left w-10">#</th>
                  <th className="py-3 px-4 text-left w-36">Staff</th>
                  <th className="py-3 px-4 text-left w-28">Via</th>
                  <th className="py-3 px-4 text-left w-40">Date & Time</th>
                  <th className="py-3 px-4 text-left w-40">Next Follow-Up</th>
                  <th className="py-3 px-4 text-left w-24">Priority</th>
                  <th className="py-3 px-4 text-left min-w-[280px]">Notes</th>
                  <th className="py-3 px-4 text-center w-16">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {followUps.map((fu: any, i: number) => (
                  <tr key={fu.id} className="hover:bg-muted/10 transition-colors group">
                    <td className="py-4 px-4 text-muted-foreground font-mono text-xs align-top">{i + 1}</td>
                    <td className="py-4 px-4 align-top">
                      <span className="font-semibold text-[13px] text-foreground/90 whitespace-nowrap">{fu.created_by?.name || "—"}</span>
                    </td>
                    <td className="py-4 px-4 align-top">
                      {fu.contacted_via ? (
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[11px] font-bold capitalize tracking-wide ${CONTACT_TYPE_STYLES[fu.contacted_via] || "bg-gray-100 text-gray-700"}`}>
                          {/* {CONTACT_TYPE_ICONS[fu.contacted_via]} */}
                          {fu.contacted_via}
                        </span>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="py-4 px-4 whitespace-nowrap text-[13px] align-top">
                      <p className="font-semibold text-foreground/90">{formatFollowUpDate(fu.follow_up_date)}</p>
                      {fu.follow_up_time && <p className="text-xs text-muted-foreground font-medium mt-0.5">{formatTime12hr(fu.follow_up_time)}</p>}
                    </td>
                    <td className="py-4 px-4 whitespace-nowrap text-[13px] align-top">
                      {fu.next_follow_up_date ? (
                        <div>
                          <p className="text-[#0052FF] font-bold">{formatFollowUpDate(fu.next_follow_up_date)}</p>
                          {fu.next_follow_up_time && <p className="text-xs text-muted-foreground font-medium mt-0.5">{formatTime12hr(fu.next_follow_up_time)}</p>}
                        </div>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="py-4 px-4 align-top">
                      {fu.priority ? (
                        <Badge className={`capitalize text-[11px] font-bold tracking-wide border px-2 py-0.5 ${PRIORITY_STYLES[fu.priority] || "bg-gray-100 text-gray-700"}`}>{fu.priority}</Badge>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="py-4 px-4 align-top">
                      <div className="text-[13px] leading-relaxed text-foreground/80 whitespace-pre-wrap max-w-lg">
                        {fu.notes || <span className="text-muted-foreground italic">No notes provided</span>}
                      </div>
                    </td>
                    <td className="py-4 px-4 align-top text-center">
                      <Button variant="outline" size="icon" className="h-8 w-8 text-muted-foreground transition-colors hover:text-[#0052FF] hover:bg-blue-50" onClick={() => openEditFu(fu)}>
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── New Follow-Up Form ── */}
      <div className="bg-card border rounded-2xl p-6 shadow-sm">
        <h3 className="text-base font-bold text-foreground border-b pb-3 mb-6 flex items-center gap-2">
          <ArrowUpRight className="h-4 w-4 text-muted-foreground" /> Log New Follow Up
        </h3>
        
        <div className="flex flex-col xl:flex-row gap-6">
          {/* Left Side: Inputs */}
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-5 h-fit">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Follow Up Date & Time</label>
              <DateTimePicker 
                value={getFuDateObj(fuForm.followUpDate, fuForm.followUpTime)}
                onChange={(date) => handleFuDateTimeChange("followUp", date)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Next Follow Up Date & Time</label>
              <DateTimePicker 
                value={getFuDateObj(fuForm.nextFollowUpDate, fuForm.nextFollowUpTime)}
                onChange={(date) => handleFuDateTimeChange("nextFollowUp", date)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Contacted Via</label>
              <FormSelect name="contactedVia" placeholder="How contacted?" options={CONTACTED_VIA} value={fuForm.contactedVia} onValueChange={v => setFuForm(f => ({ ...f, contactedVia: v || "" }))} />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Priority</label>
              <FormSelect name="priority" placeholder="Select Priority" options={PRIORITIES} value={fuForm.priority} onValueChange={v => setFuForm(f => ({ ...f, priority: v || "" }))} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">RNR Status</label>
              <FormSelect name="rnr" placeholder="Select RNR" options={RNR_OPTIONS} value={fuForm.rnr} onValueChange={v => setFuForm(f => ({ ...f, rnr: v || "" }))} />
            </div>
          </div>

          {/* Right Side: Notes and Submit */}
          <div className="w-full xl:w-[450px] flex flex-col gap-4">
            <div className="space-y-2 flex-1 flex flex-col">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Notes</label>
              <Textarea value={fuForm.notes} onChange={e => setFuForm(f => ({ ...f, notes: e.target.value }))} placeholder="What was discussed? Any outcome or next steps..." className="bg-muted/30 rounded-xl resize-none text-[14px] p-3.5 flex-1 min-h-[120px]" />
            </div>
            <Button onClick={handleSaveFollowUp} disabled={isSavingFu} className="w-full h-11 bg-[#0052FF] text-white hover:bg-[#0040CC] rounded-xl shadow font-semibold gap-2">
              {isSavingFu ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUpRight className="h-4 w-4" />}
              Save Follow Up
            </Button>
          </div>
        </div>
      </div>

      {/* ── Contact Modal ── */}
      <ContactModal
        open={contactModal.open}
        type={contactModal.type}
        to={contactModal.to}
        leadId={Number(id)}
        onClose={() => setContactModal({ open: false, type: "", to: "" })}
        onSent={() => fetchLead(true)}
      />

      {/* ── Edit Follow-Up Modal ── */}
      <Dialog open={!!editFu} onOpenChange={open => !open && setEditFu(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Follow-Up</DialogTitle>
            <DialogDescription>Update the details for this follow-up record.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-1.5 col-span-2 sm:col-span-1">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Follow-Up Date & Time</label>
              <DateTimePicker 
                value={getFuDateObj(editFuForm.followUpDate, editFuForm.followUpTime)}
                onChange={(date) => handleEditDateTimeChange("followUp", date)}
              />
            </div>
            <div className="space-y-1.5 col-span-2 sm:col-span-1">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Next Follow-Up Date & Time</label>
              <DateTimePicker 
                value={getFuDateObj(editFuForm.nextFollowUpDate, editFuForm.nextFollowUpTime)}
                onChange={(date) => handleEditDateTimeChange("nextFollowUp", date)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Contacted Via</label>
              <FormSelect name="editContactedVia" placeholder="How contacted?" options={CONTACTED_VIA} value={editFuForm.contactedVia} onValueChange={v => setEditFuForm((f: any) => ({ ...f, contactedVia: v || "" }))} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Priority</label>
              <FormSelect name="editPriority" placeholder="Priority" options={PRIORITIES} value={editFuForm.priority} onValueChange={v => setEditFuForm((f: any) => ({ ...f, priority: v || "" }))} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">RNR Status</label>
              <FormSelect name="editRnr" placeholder="RNR" options={RNR_OPTIONS} value={editFuForm.rnr} onValueChange={v => setEditFuForm((f: any) => ({ ...f, rnr: v || "" }))} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Notes</label>
              <Textarea value={editFuForm.notes} onChange={e => setEditFuForm((f: any) => ({ ...f, notes: e.target.value }))} className="bg-muted/30 rounded-xl resize-none" rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditFu(null)}>Cancel</Button>
            <Button onClick={handleEditSave} disabled={isSavingEditFu} className="bg-[#0052FF] text-white hover:bg-[#0040CC] gap-2">
              {isSavingEditFu && <Loader2 className="h-4 w-4 animate-spin" />} Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Follow-Up Modal ── */}
      <Dialog open={deleteFuId !== null} onOpenChange={open => !open && setDeleteFuId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Follow-Up</DialogTitle>
            <DialogDescription>Are you sure you want to permanently remove this follow-up record? This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setDeleteFuId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteFu} disabled={isDeletingFu}>
              {isDeletingFu && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
