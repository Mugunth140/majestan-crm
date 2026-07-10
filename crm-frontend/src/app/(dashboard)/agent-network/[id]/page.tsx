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
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { FormSelect } from "@/components/shared/form-select";
import { DateTimePicker } from "@/components/shared/datetime-picker";
import { FollowUpPanel } from "@/components/shared/follow-up-panel";
import { ContactModal } from "@/components/shared/contact-modal";
import { cn } from "@/lib/utils";
import {
  ArrowLeft, Loader2, User, Phone, MapPin, Building2,
  Briefcase, Mail, MessageSquare, Plus, ArrowUpRight,
  Clock, RefreshCw, History, Percent
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

const STATUS_STYLES: Record<string, string> = {
  "New": "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900 dark:text-gray-300",
  "Contacted": "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400",
  "Meeting Done": "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400",
  "Documents Pending": "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400",
  "Approved": "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400",
  "Active": "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400",
  "Hold": "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400",
  "Rejected": "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400",
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

function PageSkeleton() {
  return (
    <div className="animate-in fade-in duration-500 h-full flex flex-col">
      <div className="flex items-center justify-between pr-[150px] min-h-[48px] mb-6 shrink-0">
        <div className="flex items-center gap-4">
          <Skeleton className="h-9 w-9 rounded-full shrink-0" />
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-6 w-24 rounded-md" />
            </div>
            <Skeleton className="h-4 w-40" />
          </div>
        </div>
      </div>
      <div className="flex-1 space-y-6 overflow-y-auto min-h-0 pb-6 pr-2">
        <Skeleton className="h-64 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    </div>
  );
}

export default function AgentViewPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [agent, setAgent] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [contactModal, setContactModal] = useState<{ open: boolean; type: string; to: string }>({ open: false, type: "", to: "" });
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

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

  const [fuForm, setFuForm] = useState({
    contactedVia: "",
    nextFollowUpDate: "",
    nextFollowUpTime: "",
    priority: "",
    notes: "",
  });
  const [isSavingFu, setIsSavingFu] = useState(false);

  const fetchAgent = useCallback(async (silent = false) => {
    if (!id) return;
    if (!silent) setIsLoading(true);
    else setIsRefreshing(true);
    try {
      const res = await fetch(`${API_URL}/agents/${id}`);
      const result = await res.json();
      if (result.success) setAgent(result.data);
      else { toast.error("Agent not found"); router.push("/agent-network"); }
    } catch {
      toast.error("Failed to load agent details");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [id, router]);

  useEffect(() => { fetchAgent(); }, [fetchAgent]);

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
    if (!fuForm.contactedVia) return toast.error("Please select how you contacted the agent.");
    setIsSavingFu(true);
    const now = new Date();
    const payload = {
      ...fuForm,
      followUpDate: format(now, "yyyy-MM-dd"),
      followUpTime: format(now, "HH:mm"),
    };
    try {
      const res = await fetch(`${API_URL}/agents/${id}/follow-ups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Follow-up logged successfully.");
        setFuForm({ contactedVia: "", nextFollowUpDate: "", nextFollowUpTime: "", priority: "", notes: "" });
        fetchAgent(true);
      } else toast.error(data.message || "Failed to save follow-up");
    } catch { toast.error("Failed to save follow-up"); }
    finally { setIsSavingFu(false); }
  };

  const contactCounts = agent?.contact_logs?.reduce((acc: any, log: any) => {
    acc[log.contact_type] = (acc[log.contact_type] || 0) + 1;
    return acc;
  }, {}) ?? {};

  if (isLoading) return <PageSkeleton />;
  if (!agent) return null;

  const statusName = agent.status || "New";
  const badgeCls = STATUS_STYLES[statusName] ?? "bg-gray-100 text-gray-800 border-gray-200";
  const followUps: any[] = agent.follow_ups || [];
  const contactLogs: any[] = agent.contact_logs || [];

  return (
    <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* ── Header ── */}
      <div className="flex items-center justify-between pr-[150px] min-h-[48px] mb-6 shrink-0">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" className="h-9 w-9 rounded-full shrink-0" onClick={() => router.push("/agent-network")}>
            <ArrowLeft className="h-4 w-4 text-muted-foreground" />
          </Button>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{agent.name}</h1>
            <Badge className={`font-medium px-2.5 py-0.5 shadow-sm border ${badgeCls}`}>{statusName}</Badge>
            <span className="text-sm font-semibold text-muted-foreground ml-2">A{String(agent.id).padStart(5, "0")}</span>
            <span className="text-muted-foreground/40 text-xs">&bull;</span>
            <span className="text-sm text-muted-foreground flex items-center gap-1.5">
              Added on {new Date(agent.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-9 w-9 rounded-full" onClick={() => fetchAgent(true)} title="Refresh">
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
          </Button>
          <Button onClick={() => router.push(`/agent-network/new?edit=${agent.id}`)} className="rounded-full px-8 py-5 bg-[#0052FF] text-white hover:bg-[#0040CC] shadow-md">
            Edit Agent
          </Button>
        </div>
      </div>

      {/* ── Main Layout ── */}
      <div className="flex-1 overflow-y-auto min-h-0 pb-6 pr-2 space-y-6">
        {/* ── Row 1 ── */}
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 bg-card border rounded-2xl p-6 shadow-sm h-full">
            <h3 className="text-base font-bold text-foreground border-b pb-3 mb-5 flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" /> Agent Information
            </h3>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-y-6 gap-x-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Company Name</p>
                <p className="text-[14px] font-medium text-foreground/80">{agent.company_name || "\u2014"}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Mobile</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <button onClick={() => openContact("call", agent.mobile_number)} className="flex items-center gap-1.5 text-[14px] font-medium text-foreground hover:text-[#0052FF] transition-colors group">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground group-hover:text-[#0052FF]" /> {agent.mobile_number || "\u2014"}
                  </button>
                  {agent.mobile_number && (
                    <button onClick={() => openContact("sms", agent.mobile_number)} className="text-[11px] px-2 py-0.5 rounded-full border bg-green-50 text-green-700 border-green-200 hover:bg-green-100 transition-colors">SMS</button>
                  )}
                </div>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">WhatsApp</p>
                <button disabled={!agent.whatsapp_number} onClick={() => openContact("whatsapp", agent.whatsapp_number)} className="flex items-center gap-1.5 text-[14px] font-medium text-foreground hover:text-emerald-600 transition-colors group disabled:opacity-40 disabled:cursor-default">
                  <Phone className="h-3.5 w-3.5 text-emerald-600" /> {agent.whatsapp_number || "\u2014"}
                </button>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Email</p>
                <button disabled={!agent.email} onClick={() => openContact("email", agent.email)} className="flex items-center gap-1.5 text-[14px] font-medium text-foreground hover:text-[#0052FF] transition-colors group disabled:opacity-40 disabled:cursor-default">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground group-hover:text-[#0052FF]" />
                  <span className="truncate max-w-[160px]">{agent.email || "\u2014"}</span>
                </button>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">City</p>
                <p className="flex items-center gap-1.5 text-[14px] font-medium">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground" /> {agent.city || "\u2014"}
                </p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">State</p>
                <p className="text-[14px] font-medium text-foreground/80">{agent.state || "\u2014"}</p>
              </div>
            </div>
          </div>

          <div className="col-span-1 bg-card border rounded-2xl p-6 shadow-sm h-full flex flex-col">
            <h3 className="text-base font-bold text-foreground border-b pb-3 mb-5 flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-muted-foreground" /> Quick Actions
            </h3>
            <div className="flex flex-col gap-6 flex-1">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Agent Status</p>
                <FormSelect
                  name="quickAgentStatus"
                  placeholder="Select Status"
                  options={Object.keys(STATUS_STYLES).map(k => ({ label: k, value: k }))}
                  value={agent.status || ""}
                  onValueChange={async (v) => {
                    if (!v) return;
                    try {
                      const res = await fetch(`${API_URL}/agents/${id}/status`, {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ status_name: v }),
                      });
                      const data = await res.json();
                      if (data.success) {
                        toast.success("Agent status updated.");
                        fetchAgent(true);
                      } else toast.error("Failed to update status");
                    } catch {
                      toast.error("Failed to update status");
                    }
                  }}
                />
              </div>
              <div className="mt-auto pt-2">
                <Button 
                  onClick={() => setIsHistoryOpen(true)} 
                  className="w-full h-12 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:text-blue-800 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/40 dark:hover:text-blue-300 font-semibold shadow-sm border border-blue-200 dark:border-blue-800 rounded-xl flex items-center justify-between px-4"
                >
                  <span className="flex items-center">
                    <History className="mr-2 h-4 w-4" /> Follow-up History
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
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div className="space-y-1.5 flex-1 flex flex-col">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Notes</label>
                <Textarea
                  value={fuForm.notes}
                  onChange={e => setFuForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="What was discussed?..."
                  className="bg-muted/20 rounded-xl resize-none text-sm flex-1 min-h-[100px]"
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

        {/* ── Row 3: Contact Log + Commission Details ── */}
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
            <div className="bg-card border rounded-2xl p-6 shadow-sm">
              <h3 className="text-base font-bold text-foreground border-b pb-3 mb-5 flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-muted-foreground" /> Business Details
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center py-1.5 border-b border-border/30">
                  <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Partner Type</span>
                  <span className="font-medium capitalize text-[14px]">{agent.partner_type ? agent.partner_type.replace(/_/g, " ") : "\u2014"}</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-border/30">
                  <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Property Category</span>
                  <span className="font-medium capitalize text-[14px]">{agent.property_category || "\u2014"}</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-border/30">
                  <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Assigned Staff</span>
                  <span className="font-medium text-[14px]">{agent.assigned_staff?.name || "Unassigned"}</span>
                </div>
              </div>
            </div>

            <div className="bg-card border rounded-2xl p-6 shadow-sm">
              <h3 className="text-base font-bold text-foreground border-b pb-3 mb-5 flex items-center gap-2">
                <Percent className="h-4 w-4 text-muted-foreground" /> Commission Info
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center py-1.5 border-b border-border/30">
                  <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Accepted</span>
                  <span className="font-medium capitalize text-[14px]">{agent.commission_accepted ? "Yes" : "No"}</span>
                </div>
                {agent.commission_accepted && (
                  <>
                    <div className="flex justify-between items-center py-1.5 border-b border-border/30">
                      <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Type</span>
                      <span className="font-medium capitalize text-[14px]">{agent.commission_type ? agent.commission_type.replace(/_/g, " ") : "\u2014"}</span>
                    </div>
                    <div className="flex justify-between items-center py-1.5 border-b border-border/30">
                      <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Value</span>
                      <span className="font-medium text-[14px]">{agent.commission_value || "\u2014"}</span>
                    </div>
                  </>
                )}
                {agent.remarks && (
                  <div className="pt-2">
                    <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide block mb-1">Remarks</span>
                    <p className="text-[13px] text-foreground/80 bg-muted/20 p-3 rounded-lg border">{agent.remarks}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <Sheet open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
        <SheetContent side="right" className="w-[450px] !max-w-[450px] p-0 flex flex-col border-l">
          <SheetHeader className="p-6 border-b shrink-0 bg-blue-50 dark:bg-blue-900/20">
            <SheetTitle className="text-lg text-[#0052FF] dark:text-blue-400">Follow Up History {followUps.length > 0 && `(${followUps.length})`}</SheetTitle>
            <SheetDescription>
              Timeline of all logged follow-ups and interactions for this agent.
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-hidden relative">
            <FollowUpPanel
              entityId={Number(id)}
              entityType="agents"
              followUps={followUps}
              onRefresh={() => fetchAgent(true)}
            />
          </div>
        </SheetContent>
      </Sheet>

      <ContactModal
        open={contactModal.open}
        type={contactModal.type}
        to={contactModal.to}
        entityId={Number(id)}
        entityType="agents"
        onClose={() => setContactModal({ open: false, type: "", to: "" })}
        onSent={() => fetchAgent(true)}
      />
    </div>
  );
}
