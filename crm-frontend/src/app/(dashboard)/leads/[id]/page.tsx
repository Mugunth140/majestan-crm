"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { format } from "date-fns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { FormSelect } from "@/components/shared/form-select";
import { DateTimePicker } from "@/components/shared/datetime-picker";
import { ContactModal } from "@/components/shared/contact-modal";
import { FollowUpPanel } from "@/components/shared/follow-up-panel";
import { cn } from "@/lib/utils";
import {
  ArrowLeft, Loader2, User, Phone, MapPin, Building2,
  Briefcase, Mail, MessageSquare, Plus, ArrowUpRight,
  Clock, Send, RefreshCw, History,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

const STATUS_STYLES: Record<string, string> = {
  "New Lead":             "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900 dark:text-gray-300",
  "Contacted":            "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400",
  "Qualified":            "bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400",
  "Property Shared":      "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400",
  "Interested":           "bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200 dark:bg-fuchsia-900/30 dark:text-fuchsia-400",
  "Site Visit Scheduled": "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400",
  "Site Visit Completed": "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400",
  "Re Visit Scheduled":   "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400",
  "Re Visit Completed":   "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400",
  "Negotiation":          "bg-pink-100 text-pink-800 border-pink-200 dark:bg-pink-900/30 dark:text-pink-400",
  "Booking Advance":      "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400",
  "Agreement":            "bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-900/30 dark:text-teal-400",
  "Closed Won":           "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400",
  "Not Interested":       "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400",
  "Lost":                 "bg-red-200 text-red-900 border-red-300 dark:bg-red-900/50 dark:text-red-300",
  "Future Follow-up":     "bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-300",
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

function formatTimestamp(ts: string) {
  const d = new Date(ts);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) +
    " at " + d.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true });
}

// ── Loading Skeleton ─────────────────────────────────────────────────────────
function PageSkeleton() {
  return (
    <div className="animate-in fade-in duration-500 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between pr-[150px] min-h-[48px] mb-6 shrink-0">
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

      <div className="flex-1 space-y-6 overflow-y-auto min-h-0 pb-6 pr-2">
        {/* Top Row */}
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 bg-card border rounded-2xl p-6 shadow-sm">
            <Skeleton className="h-5 w-48 mb-6" />
            <div className="grid grid-cols-3 gap-y-6 gap-x-6">
              {[...Array(6)].map((_, i) => (
                <div key={i}>
                  <Skeleton className="h-3 w-20 mb-2" />
                  <Skeleton className="h-4 w-32" />
                </div>
              ))}
            </div>
          </div>
          <div className="col-span-1 bg-card border rounded-2xl p-6 shadow-sm">
            <Skeleton className="h-5 w-32 mb-6" />
            <div className="space-y-6">
              {[...Array(3)].map((_, i) => (
                <div key={i}>
                  <Skeleton className="h-3 w-24 mb-2" />
                  <Skeleton className="h-11 w-full rounded-xl" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Row 2 */}
        <div className="bg-card border rounded-2xl p-6 shadow-sm">
          <Skeleton className="h-5 w-40 mb-6" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>

        {/* Row 3 */}
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 bg-card border rounded-2xl p-6 shadow-sm">
            <Skeleton className="h-5 w-32 mb-6" />
            <div className="space-y-6">
              {[...Array(3)].map((_, i) => (
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
          <div className="col-span-1 space-y-6">
            <div className="bg-card border rounded-2xl p-6 shadow-sm">
              <Skeleton className="h-5 w-32 mb-4" />
              <Skeleton className="h-4 w-24" />
            </div>
            <div className="bg-card border rounded-2xl p-6 shadow-sm">
              <Skeleton className="h-5 w-32 mb-4" />
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-4 w-full" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
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

  // Modals / Sliders
  const [contactModal, setContactModal] = useState<{ open: boolean; type: string; to: string }>({ open: false, type: "", to: "" });
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isAutoMatchOpen, setIsAutoMatchOpen] = useState(false);
  const [autoMatchResults, setAutoMatchResults] = useState<any[]>([]);
  const [isMatching, setIsMatching] = useState(false);

  const fetchAutoMatch = async () => {
    setIsMatching(true);
    try {
      const res = await fetch(`${API_URL}/leads/${id}/auto-match`);
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

  // Keyboard shortcut for history slider
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        setIsHistoryOpen(prev => !prev);
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
    setIsSavingFu(true);
    const now = new Date();
    const payload = {
      ...fuForm,
      followUpDate: format(now, "yyyy-MM-dd"),
      followUpTime: format(now, "HH:mm"),
    };
    try {
      const res = await fetch(`${API_URL}/leads/${id}/follow-ups`, {
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

  // Contact counts by type
  const contactCounts = lead?.contact_logs?.reduce((acc: any, log: any) => {
    acc[log.contact_type] = (acc[log.contact_type] || 0) + 1;
    return acc;
  }, {}) ?? {};

  if (isLoading) return <PageSkeleton />;
  if (!lead) return null;

  const inquiry = lead.inquiries?.[0];
  const statusName = lead.status || "New Lead";
  const badgeCls = STATUS_STYLES[statusName] ?? "bg-gray-100 text-gray-800 border-gray-200";
  const followUps: any[] = lead.follow_ups || [];
  const contactLogs: any[] = lead.contact_logs || [];

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

  return (
    <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* ── Header ── */}
      <div className="flex items-center justify-between pr-[150px] min-h-[48px] mb-6 shrink-0">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" className="h-9 w-9 rounded-full shrink-0" onClick={() => router.push("/leads")}>
            <ArrowLeft className="h-4 w-4 text-muted-foreground" />
          </Button>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{lead.name}</h1>
            <Badge className={`font-medium px-2.5 py-0.5 shadow-sm border ${badgeCls}`}>{statusName}</Badge>
            <span className="text-sm font-semibold text-muted-foreground ml-2">L{String(lead.id).padStart(5, "0")}</span>
            <span className="text-muted-foreground/40 text-xs">&bull;</span>
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

      {/* ── Main Layout ── */}
      <div className="flex-1 overflow-y-auto min-h-0 pb-6 pr-2 space-y-6">

        {/* ── Row 1: Customer Info (2/3) + Quick Actions (1/3) ── */}
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 bg-card border rounded-2xl p-6 shadow-sm h-full">
            <h3 className="text-base font-bold text-foreground border-b pb-3 mb-5 flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" /> Customer Information
            </h3>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-y-6 gap-x-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Mobile</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <button onClick={() => openContact("call", lead.mobile_number)} className="flex items-center gap-1.5 text-[14px] font-medium text-foreground hover:text-[#0052FF] transition-colors group">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground group-hover:text-[#0052FF]" /> {lead.mobile_number || "\u2014"}
                  </button>
                  {lead.mobile_number && (
                    <button onClick={() => openContact("sms", lead.mobile_number)} className="text-[11px] px-2 py-0.5 rounded-full border bg-green-50 text-green-700 border-green-200 hover:bg-green-100 transition-colors">SMS</button>
                  )}
                </div>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">WhatsApp</p>
                <button disabled={!lead.whatsapp_number} onClick={() => openContact("whatsapp", lead.whatsapp_number)} className="flex items-center gap-1.5 text-[14px] font-medium text-foreground hover:text-emerald-600 transition-colors group disabled:opacity-40 disabled:cursor-default">
                  <Phone className="h-3.5 w-3.5 text-emerald-600" /> {lead.whatsapp_number || "\u2014"}
                </button>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Email</p>
                <button disabled={!lead.email} onClick={() => openContact("email", lead.email)} className="flex items-center gap-1.5 text-[14px] font-medium text-foreground hover:text-[#0052FF] transition-colors group disabled:opacity-40 disabled:cursor-default">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground group-hover:text-[#0052FF]" />
                  <span className="truncate max-w-[160px]">{lead.email || "\u2014"}</span>
                </button>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">City</p>
                <p className="flex items-center gap-1.5 text-[14px] font-medium">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground" /> {lead.city || "\u2014"}
                </p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Lead Source</p>
                <Badge variant="outline" className="text-sm px-3 py-1 font-medium">{lead.lead_source || "Unknown"}</Badge>
              </div>
              <div className="col-span-2 lg:col-span-3">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Address</p>
                <p className="text-[14px] font-medium text-foreground/80">{lead.address || "\u2014"}</p>
              </div>
            </div>
          </div>

          <div className="col-span-1 bg-card border rounded-2xl p-6 shadow-sm h-full flex flex-col">
            <h3 className="text-base font-bold text-foreground border-b pb-3 mb-5 flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-muted-foreground" /> Quick Actions
            </h3>
            <div className="flex flex-col gap-6 flex-1">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Lead Status</p>
                <FormSelect
                  name="quickLeadStatus"
                  placeholder="Select Status"
                  options={Object.keys(STATUS_STYLES).map(k => ({ label: k, value: k }))}
                  value={lead.status || ""}
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
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Lead Qualification</p>
                <div className="flex items-center justify-between h-12 px-4 rounded-xl border border-input bg-muted/20">
                  <span className="text-[14px] font-medium text-foreground/80">Mark as Unqualified</span>
                  <button
                    role="switch"
                    aria-checked={lead.is_unqualified || false}
                    onClick={async () => {
                      const newVal = !lead.is_unqualified;
                      try {
                        const res = await fetch(`${API_URL}/leads/${id}/status`, {
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
                    }}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${lead.is_unqualified ? "bg-red-500" : "bg-muted"}`}
                  >
                    <span className={`pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform ${lead.is_unqualified ? "translate-x-5.5" : "translate-x-0.5"}`} />
                  </button>
                </div>
              </div>
              
              {/* Trigger the Right Slider */}
              <div className="mt-auto pt-2">
                <Button 
                  onClick={() => setIsHistoryOpen(true)} 
                  className="w-full h-12 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:text-blue-800 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/40 dark:hover:text-blue-300 font-semibold shadow-sm border border-blue-200 dark:border-blue-800 rounded-xl flex items-center justify-between px-4"
                >
                  <span className="flex items-center">
                    <History className="mr-2 h-4 w-4" /> View Follow-up History
                  </span>
                  <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border border-blue-200 dark:border-blue-800 bg-background/50 px-1.5 font-mono text-[10px] font-medium text-blue-700 dark:text-blue-400 opacity-100">
                    Alt H
                  </kbd>
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Row 2: Log New Follow Up Form ── */}
        <div className="bg-card border rounded-2xl p-6 shadow-sm">
          <h3 className="text-base font-bold text-foreground border-b pb-3 mb-5 flex items-center gap-2">
            <Plus className="h-4 w-4 text-[#0052FF]" /> Log New Follow Up
          </h3>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Contacted Via *</label>
                  <FormSelect name="contactedVia" placeholder="Select..." options={CONTACTED_VIA} value={fuForm.contactedVia} onValueChange={v => setFuForm(f => ({ ...f, contactedVia: v || "" }))} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Next Follow-Up</label>
                  <DateTimePicker
                    value={getFuDateObj(fuForm.nextFollowUpDate, fuForm.nextFollowUpTime)}
                    onChange={handleFuDateTimeChange}
                    placeholder="Pick date..."
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Priority</label>
                  <FormSelect name="priority" placeholder="Select..." options={PRIORITIES} value={fuForm.priority} onValueChange={v => setFuForm(f => ({ ...f, priority: v || "" }))} />
                </div>
                <div className="space-y-1.5 flex flex-col justify-end">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">RNR Status</label>
                  <Button
                    type="button"
                    variant={fuForm.rnr === nextRnrValue ? "default" : "outline"}
                    className={cn(
                      "w-full h-12 rounded-xl transition-all font-semibold",
                      fuForm.rnr === nextRnrValue 
                        ? "bg-orange-500 hover:bg-orange-600 text-white border-orange-500" 
                        : "border-border/60 hover:bg-orange-50 hover:text-orange-600 hover:border-orange-200 text-foreground/80"
                    )}
                    disabled={isRnrMaxed}
                    onClick={() => {
                      const isApplying = fuForm.rnr !== nextRnrValue;
                      setFuForm(f => ({
                        ...f,
                        rnr: isApplying ? nextRnrValue : "",
                        notes: isApplying ? `RNR ${nextRnrNumber} for this lead` : (f.notes === `RNR ${nextRnrNumber} for this lead` ? "" : f.notes)
                      }));
                    }}
                  >
                    {isRnrMaxed ? "Max RNR (5) Reached" : (fuForm.rnr === nextRnrValue ? `RNR ${nextRnrNumber} Applied` : `Apply RNR ${nextRnrNumber}`)}
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div className="space-y-1.5 flex-1 flex flex-col">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Notes</label>
                <Textarea
                  value={fuForm.notes}
                  onChange={e => setFuForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="What was discussed?..."
                  disabled={!!fuForm.rnr}
                  className={cn("bg-muted/20 rounded-xl resize-none text-sm flex-1 min-h-[100px]", fuForm.rnr ? "opacity-70 cursor-not-allowed bg-muted" : "")}
                />
              </div>
              <Button
                onClick={handleSaveFollowUp}
                disabled={isSavingFu}
                className="w-full h-11 bg-[#0052FF] text-white hover:bg-[#0040CC] rounded-xl shadow font-semibold text-sm gap-2"
              >
                {isSavingFu ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUpRight className="h-4 w-4" />}
                Save Follow Up
              </Button>
            </div>
          </div>
        </div>

        {/* ── Row 3: Contact Log (2/3) + Assignment/Requirement (1/3) ── */}
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 bg-card border rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between border-b pb-3 mb-5">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" /> Contact Log
              </h3>
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
                {contactLogs.map((log: any) => (
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

          <div className="col-span-1 space-y-6">
            {/* Assignment */}
            <div className="bg-card border rounded-2xl p-6 shadow-sm">
              <h3 className="text-base font-bold text-foreground border-b pb-3 mb-5 flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-muted-foreground" /> Lead Assignment
              </h3>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Assigned Staff</p>
                <p className="text-[15px] font-semibold">{lead.assigned_staff?.name || "Unassigned"}</p>
              </div>
            </div>

            {/* Requirement */}
            <div className="bg-card border rounded-2xl p-6 shadow-sm">
              <h3 className="text-base font-bold text-foreground border-b pb-3 mb-5 flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" /> Requirement
              </h3>
              <div className="space-y-3 text-sm">
                {[
                  { label: "Purchase Type", value: inquiry?.purchase_type?.replace(/_/g, " ") },
                  { label: "Category", value: inquiry?.property_category?.replace(/_/g, " ") },
                  { label: "Property Type", value: inquiry?.property_type?.replace(/_/g, " ") },
                  { label: "Funding", value: inquiry?.funder?.replace(/_/g, " ") },
                  { label: "Project", value: inquiry?.project_list?.replace(/_/g, " ") },
                ].map(f => (
                  <div key={f.label} className="flex justify-between items-center py-1.5 border-b border-border/30 last:border-0">
                    <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">{f.label}</span>
                    <span className="font-medium capitalize text-[14px]">{f.value || "\u2014"}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* Customer Preferences */}
            <div className="bg-card border rounded-2xl p-6 shadow-sm">
              <h3 className="text-base font-bold text-foreground border-b pb-3 mb-5 flex items-center justify-between">
                <span className="flex items-center gap-2"><User className="h-4 w-4 text-muted-foreground" /> Preferences</span>
                <Button size="sm" onClick={() => fetchAutoMatch()} disabled={isMatching} className="h-8 bg-[#0052FF] hover:bg-[#0040CC] text-white rounded-lg px-4 shadow-sm">
                  {isMatching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Auto Match"}
                </Button>
              </h3>
              
              {(!inquiry?.preferences || Object.keys(inquiry.preferences).length === 0) ? (
                <p className="text-sm text-muted-foreground italic text-center py-4">No preferences defined yet.</p>
              ) : (
                <div className="space-y-3 text-sm">
                  {Object.entries(inquiry.preferences).map(([key, val]) => (
                    <div key={key} className="flex justify-between items-center py-1.5 border-b border-border/30 last:border-0">
                      <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                      <span className="font-medium text-[14px]">{String(val)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* ── Follow-Up History Slider (Sheet) ── */}
      <Sheet open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
        <SheetContent side="right" className="w-[450px] !max-w-[450px] p-0 flex flex-col border-l">
          <SheetHeader className="p-6 border-b shrink-0">
            <SheetTitle className="text-lg">Follow Up Timeline {followUps.length > 0 && `(${followUps.length})`}</SheetTitle>
            {/* <SheetDescription>
              Timeline of all logged follow-ups and interactions for this lead.
            </SheetDescription> */}
          </SheetHeader>
          <div className="flex-1 overflow-hidden relative">
            <FollowUpPanel
              entityId={Number(id)}
              entityType="leads"
              followUps={followUps}
              onRefresh={() => fetchLead(true)}
            />
          </div>
        </SheetContent>
      </Sheet>

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
    </div>
  );
}
