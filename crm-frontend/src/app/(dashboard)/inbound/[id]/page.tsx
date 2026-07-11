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
import dynamic from "next/dynamic";

const FollowUpPanel = dynamic(() => import("@/components/shared/follow-up-panel").then(mod => mod.FollowUpPanel), { ssr: false });
const ContactModal = dynamic(() => import("@/components/shared/contact-modal").then(mod => mod.ContactModal), { ssr: false });

import { cn } from "@/lib/utils";
import {
  ArrowLeft, Loader2, User, Phone, MapPin, Building2,
  Briefcase, Mail, MessageSquare, Plus, ArrowUpRight,
  Clock, Send, RefreshCw, History, Edit, Shield, CheckCircle
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

const STATUS_OPTIONS = [
  "New Inbound",
  "Contacting Owner",
  "Terms not Accepted",
  "On Hold",
  "Pending Verification",
  "Approved",
  "Rejected",
  "Closed"
];

const STATUS_STYLES: Record<string, string> = {
  "New Inbound": "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900 dark:text-gray-300",
  "Contacting Owner": "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400",
  "Terms not Accepted": "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400",
  "On Hold": "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400",
  "Pending Verification": "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400",
  "Approved": "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400",
  "Rejected": "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400",
  "Closed": "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400",
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
              <div className="space-y-4">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-4 w-full" />
                ))}
              </div>
            </div>
            <div className="bg-card border rounded-2xl p-6 shadow-sm">
              <Skeleton className="h-5 w-32 mb-4" />
              <div className="space-y-4">
                {[...Array(4)].map((_, i) => (
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

export default function InboundViewPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [inbound, setInbound] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Status Update Modal
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState("");
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Modals / Sliders
  const [contactModal, setContactModal] = useState<{ open: boolean; type: string; to: string }>({ open: false, type: "", to: "" });
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // Keyboard shortcut for history slider
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key.toLowerCase() === 'a' && 
        document.activeElement?.tagName !== 'INPUT' && 
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
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

  const fetchInbound = useCallback(async (silent = false) => {
    if (!id) return;
    if (!silent) setIsLoading(true);
    else setIsRefreshing(true);
    try {
      const res = await fetch(`${API_URL}/inbounds/${id}`);
      const result = await res.json();
      if (result && (result.id || result.property_id)) {
        setInbound(result.data || result);
        setSelectedStatus(result.status || result.data?.status || "Hold");
      } else { 
        toast.error("Inbound property not found"); 
        router.push("/inbound"); 
      }
    } catch {
      toast.error("Failed to load inbound details");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [id, router]);

  useEffect(() => { fetchInbound(); }, [fetchInbound]);

  const handleDirectStatusUpdate = async (newStatus: string) => {
    if (!newStatus || newStatus === inbound.status) return;
    setIsUpdatingStatus(true);
    try {
      const res = await fetch(`${API_URL}/inbounds/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Status updated to " + newStatus);
        fetchInbound(true);
      } else {
        toast.error(data.message || "Failed to update status");
      }
    } catch {
      toast.error("Failed to update status");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

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
    if (!fuForm.contactedVia) return toast.error("Please select how you contacted the owner.");
    setIsSavingFu(true);
    const now = new Date();
    const payload = {
      ...fuForm,
      followUpDate: format(now, "yyyy-MM-dd"),
      followUpTime: format(now, "HH:mm"),
    };
    try {
      const res = await fetch(`${API_URL}/inbounds/${id}/follow-ups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Follow-up logged successfully.");
        setFuForm({ contactedVia: "", nextFollowUpDate: "", nextFollowUpTime: "", priority: "", rnr: "", notes: "" });
        fetchInbound(true);
      } else toast.error(data.message || "Failed to save follow-up");
    } catch { toast.error("Failed to save follow-up"); }
    finally { setIsSavingFu(false); }
  };

  const renderQualityScore = (score: number) => {
    let label = "Needs Improvement";
    let bgCls = "bg-red-500";
    let textCls = "text-red-700 dark:text-red-400";
    
    if (score >= 90) {
      label = "Premium";
      bgCls = "bg-green-500";
      textCls = "text-green-700 dark:text-green-400";
    } else if (score >= 75) {
      label = "Featured";
      bgCls = "bg-blue-500";
      textCls = "text-blue-700 dark:text-blue-400";
    } else if (score >= 60) {
      label = "Standard";
      bgCls = "bg-yellow-500";
      textCls = "text-yellow-700 dark:text-yellow-400";
    }

    return (
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <span className={`text-[15px] font-bold ${textCls}`}>{label}</span>
          <span className="text-sm font-bold text-foreground">{score}/100</span>
        </div>
        <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden border border-border/50 shadow-inner">
          <div 
            className={`h-full ${bgCls} transition-all duration-1000 ease-out`} 
            style={{ width: `${score}%` }} 
          />
        </div>
      </div>
    );
  };

  if (isLoading) return <PageSkeleton />;
  if (!inbound) return null;

  const statusName = inbound.status || "Hold";
  const badgeCls = STATUS_STYLES[statusName] ?? STATUS_STYLES["Hold"];
  const followUps: any[] = inbound.follow_ups || [];
  const contactLogs: any[] = inbound.contact_logs || [];

  const contactCounts = inbound?.contact_logs?.reduce((acc: any, log: any) => {
    acc[log.contact_type] = (acc[log.contact_type] || 0) + 1;
    return acc;
  }, {}) ?? {};
  
  // RNR Calculation
  let highestRnr = 0;
  if (followUps.length > 0) {
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
          <Button variant="outline" size="icon" className="h-9 w-9 rounded-full shrink-0" onClick={() => router.push("/inbound")}>
            <ArrowLeft className="h-4 w-4 text-muted-foreground" />
          </Button>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {inbound.property_id || inbound.propertyId || `Inbound #${inbound.id}`}
            </h1>
            <Badge className={`font-medium px-2.5 py-0.5 shadow-sm border ${badgeCls}`}>{statusName}</Badge>
            <span className="text-muted-foreground/40 text-xs">&bull;</span>
            <span className="text-sm text-muted-foreground flex items-center gap-1.5">
              Created on {new Date(inbound.created_at || inbound.createdAt || inbound.date || Date.now()).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-9 w-9 rounded-full" onClick={() => fetchInbound(true)} title="Refresh">
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
          </Button>
          <Button onClick={() => router.push(`/inbound/new?edit=${inbound.id}`)} className="rounded-full px-8 py-5 bg-[#0052FF] text-white hover:bg-[#0040CC] shadow-md flex items-center gap-2">
            <Edit className="h-4 w-4" /> Edit Details
          </Button>
        </div>
      </div>

      {/* ── Main Layout ── */}
      <div className="flex-1 overflow-y-auto min-h-0 pb-6 pr-2 space-y-6">

        {/* ── Row 1: Basic Info (2/3) + Quick Actions (1/3) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="col-span-2 bg-card border rounded-2xl p-6 shadow-sm h-full">
            <h3 className="text-base font-bold text-foreground border-b pb-3 mb-5 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" /> Basic Information
            </h3>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-y-6 gap-x-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Property Category</p>
                <p className="text-[14px] font-medium text-foreground">{inbound.property_category || inbound.propertyCategory || "\u2014"}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Property Type</p>
                <p className="text-[14px] font-medium text-foreground capitalize">{(inbound.property_type || inbound.propertyType || "").replace(/_/g, " ") || "\u2014"}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">City</p>
                <p className="flex items-center gap-1.5 text-[14px] font-medium text-foreground">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground" /> {inbound.city || "\u2014"}
                </p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Locality</p>
                <p className="text-[14px] font-medium text-foreground">
                  {inbound.locality || "\u2014"}
                </p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Area</p>
                <p className="text-[14px] font-medium text-foreground">{inbound.area || "\u2014"}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Purpose</p>
                <p className="text-[14px] font-medium text-foreground">{inbound.purpose || "\u2014"}</p>
              </div>
              <div className="col-span-2 lg:col-span-3">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Full Address / Location</p>
                <p className="text-[14px] font-medium text-foreground/80">{inbound.address || inbound.location || "\u2014"}</p>
              </div>
            </div>
          </div>

          <div className="col-span-1 bg-card border rounded-2xl p-6 shadow-sm h-full flex flex-col">
            <h3 className="text-base font-bold text-foreground border-b pb-3 mb-5 flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" /> Actions & Score
            </h3>
            
            <div className="mb-6">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Quality Score</p>
              {renderQualityScore(Number(inbound.quality_score || inbound.qualityScore || 0))}
            </div>
            
            <div className="flex-1 flex flex-col gap-4">
               <div>
                  <div className="flex items-center justify-between mb-2">
                     <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Current Status</p>
                     {isUpdatingStatus && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                  </div>
                  <div className="flex gap-2">
      
                     <div className="flex-1">
                       <FormSelect 
                         name="inboundStatus" 
                         options={STATUS_OPTIONS.map(s => ({label: s, value: s}))}
                         value={selectedStatus}
                         onValueChange={(v) => {
                           setSelectedStatus(v || "");
                           handleDirectStatusUpdate(v || "");
                         }}
                         placeholder="Select Status"
                       />
                     </div>
                       <Button 
                        variant="outline" 
                        onClick={() => {
                          setSelectedStatus("Closed");
                          handleDirectStatusUpdate("Closed");
                        }}
                        disabled={isUpdatingStatus || selectedStatus === "Closed"}
                        className="border-green-500 text-green-600 hover:bg-green-50 hover:text-green-700 h-11 px-6 rounded-xl font-bold transition-all"
                     >
                        Close
                     </Button>
                  </div>
               </div>

               {inbound.assigned_to && (
                 <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 mt-2">Assigned To</p>
                    <p className="text-[14px] font-medium">{inbound.assigned_to.name || "Staff Member"}</p>
                 </div>
               )}
               
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
                     A
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
                        notes: isApplying ? `RNR ${nextRnrNumber} for this inbound property` : (f.notes === `RNR ${nextRnrNumber} for this inbound property` ? "" : f.notes)
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

        {/* ── Row 3: Contact Log (2/3) + Owner/Brokerage (1/3) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="col-span-1 lg:col-span-2 bg-card border rounded-2xl p-6 shadow-sm">
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
            <div className="bg-card border rounded-2xl p-6 shadow-sm">
             <h3 className="text-base font-bold text-foreground border-b pb-3 mb-5 flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" /> Owner & Contact Info
             </h3>
             <div className="space-y-4">
                <div className="flex justify-between items-center py-2 border-b border-border/30 last:border-0">
                  <span className="text-muted-foreground text-xs font-bold uppercase tracking-wide">Owner Name</span>
                  <span className="font-medium text-[14px]">{inbound.owner_name || inbound.ownerName || "\u2014"}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border/30 last:border-0">
                  <span className="text-muted-foreground text-xs font-bold uppercase tracking-wide">Mobile Number</span>
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-[14px]">
                       {inbound.owner_mobile || inbound.mobile_number || "\u2014"}
                    </span>
                    {(inbound.owner_mobile || inbound.mobile_number) && (
                      <div className="flex gap-1">
                        <Button variant="outline" size="icon" className="h-7 w-7 rounded-full bg-purple-50 hover:bg-purple-100 border-purple-200 text-purple-700" onClick={() => openContact("call", inbound.owner_mobile || inbound.mobile_number)}>
                          <Phone className="h-3 w-3" />
                        </Button>
                        <Button variant="outline" size="icon" className="h-7 w-7 rounded-full bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-700" onClick={() => openContact("whatsapp", inbound.owner_mobile || inbound.mobile_number)}>
                          <Phone className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border/30 last:border-0">
                  <span className="text-muted-foreground text-xs font-bold uppercase tracking-wide">Email Address</span>
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-[14px] truncate max-w-[200px]">
                       {inbound.owner_email || inbound.email || "\u2014"}
                    </span>
                    {(inbound.owner_email || inbound.email) && (
                      <Button variant="outline" size="icon" className="h-7 w-7 rounded-full bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-700 shrink-0" onClick={() => openContact("email", inbound.owner_email || inbound.email)}>
                        <Mail className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
             </div>
            </div>

            <div className="bg-card border rounded-2xl p-6 shadow-sm">
             <h3 className="text-base font-bold text-foreground border-b pb-3 mb-5 flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-muted-foreground" /> Brokerage Details
             </h3>
             <div className="space-y-4">
                <div className="flex justify-between items-center py-2 border-b border-border/30 last:border-0">
                  <span className="text-muted-foreground text-xs font-bold uppercase tracking-wide">Accepted</span>
                  <span className="font-medium text-[14px]">{inbound.brokerage_accepted || "\u2014"}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border/30 last:border-0">
                  <span className="text-muted-foreground text-xs font-bold uppercase tracking-wide">Type</span>
                  <span className="font-medium text-[14px]">{inbound.brokerage_type || "\u2014"}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border/30 last:border-0">
                  <span className="text-muted-foreground text-xs font-bold uppercase tracking-wide">Brokerage</span>
                  <span className="font-medium text-[14px]">{inbound.percentage ? `${inbound.percentage}%` : (inbound.fixed_amount ? `₹${inbound.fixed_amount}` : "\u2014")}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border/30 last:border-0">
                  <span className="text-muted-foreground text-xs font-bold uppercase tracking-wide">Remarks</span>
                  <span className="font-medium text-[14px] truncate max-w-[200px]" title={inbound.brokerage_remarks || ""}>{inbound.brokerage_remarks || "\u2014"}</span>
                </div>
             </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Follow-Up History Slider (Sheet) ── */}
      <Sheet open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
        <SheetContent side="right" className="w-[450px] !max-w-[450px] p-0 flex flex-col border-l">
          <SheetHeader className="p-6 border-b shrink-0">
            <SheetTitle className="text-lg">Follow Up Timeline {followUps.length > 0 && `(${followUps.length})`}</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-hidden relative">
            <FollowUpPanel
              entityId={Number(id)}
              entityType="inbounds"
              followUps={followUps}
              onRefresh={() => fetchInbound(true)}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Contact Modal ── */}
      <ContactModal
        open={contactModal.open}
        type={contactModal.type}
        to={contactModal.to}
        entityId={Number(id)}
        entityType="inbounds"
        onClose={() => setContactModal({ open: false, type: "", to: "" })}
        onSent={() => fetchInbound(true)}
      />



    </div>
  );
}
