"use client";

import { useState, useEffect } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { FormSelect } from "@/components/shared/form-select";
import { DateTimePicker } from "@/components/shared/datetime-picker";
import {
  Edit,
  Loader2,
  User,
  ArrowUpRight,
  MessageSquare,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

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

function formatFollowUpDate(dateStr: string) {
  if (!dateStr) return "\u2014";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// ── Types ────────────────────────────────────────────────────────────────────
interface FollowUpPanelProps {
  leadId: number | string;
  followUps: any[];
  onRefresh: () => void;
}

// ── Component ────────────────────────────────────────────────────────────────
export function FollowUpPanel({ leadId, followUps, onRefresh }: FollowUpPanelProps) {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    try {
      const userStr = localStorage.getItem("crm_user");
      if (userStr) {
        const user = JSON.parse(userStr);
        setIsAdmin(user.role === "Admin" || user.role === "Super Admin");
      }
    } catch (err) {
      console.error("Failed to parse user from local storage");
    }
  }, []);

  // Edit follow-up state
  const [editFu, setEditFu] = useState<any>(null);
  const [editFuForm, setEditFuForm] = useState<any>({});
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // ── Date helpers ───────────────────────────────────────────────────────────
  const getFuDateObj = (d: string, t: string) => {
    if (!d) return undefined;
    const date = new Date(d);
    if (t) {
      const [hh, mm] = t.split(":");
      date.setHours(parseInt(hh, 10), parseInt(mm, 10), 0, 0);
    }
    return date;
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

  // ── Edit follow-up ────────────────────────────────────────────────────────
  const openEdit = (fu: any) => {
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
    setIsSavingEdit(true);
    try {
      const res = await fetch(`${API_URL}/leads/${leadId}/follow-ups/${editFu.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editFuForm),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Follow-up updated.");
        setEditFu(null);
        onRefresh();
      } else toast.error("Failed to update follow-up");
    } catch { toast.error("Failed to update follow-up"); }
    finally { setIsSavingEdit(false); }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="flex flex-col h-full bg-transparent">

        {/* ── Timeline ── */}
        <div className="flex-1 overflow-y-auto min-h-0 pt-4 px-2 pb-10">
          {followUps.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <div className="h-12 w-12 rounded-full bg-muted/40 flex items-center justify-center mb-3">
                <MessageSquare className="h-5 w-5 text-muted-foreground/50" />
              </div>
              <p className="text-sm font-medium text-muted-foreground text-center">No follow-ups recorded yet</p>
            </div>
          ) : (
            <div className="space-y-6">
              {followUps.map((fu: any) => {
                const timestamp = getFuDateObj(fu.follow_up_date, fu.follow_up_time || "00:00");
                const relativeTime = timestamp ? formatDistanceToNow(timestamp, { addSuffix: true }) : "";
                const absoluteTime = timestamp ? format(timestamp, "MMM d, yyyy \u00B7 h:mma") : formatFollowUpDate(fu.follow_up_date);

                return (
                  <div key={fu.id} className="relative group">
                    {/* Header (Timestamp & Edit Button) */}
                    <div className="mb-2 flex items-center justify-between pr-1">
                      <div className="flex items-center gap-1.5 text-[13px] text-muted-foreground pl-1">
                        <span className="font-medium text-foreground/70">{absoluteTime}</span>
                        <span className="text-muted-foreground/40">|</span>
                        <span>{relativeTime}</span>
                      </div>
                      {isAdmin && (
                        <button
                          onClick={() => openEdit(fu)}
                          className="hidden opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7 rounded-lg items-center justify-center text-muted-foreground hover:text-[#0052FF] hover:bg-blue-50 dark:hover:bg-blue-900/20"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                      )}
                    </div>

                    {/* Card */}
                    <div className="rounded-xl border bg-card p-4 shadow-sm group-hover:border-blue-200 dark:group-hover:border-blue-900/50 transition-colors">
                      <div className="space-y-3">
                        {/* Header row: User and Badges */}
                        <div className="flex items-center justify-between gap-4 flex-wrap">
                          <div className="flex items-center gap-2">
                            <div className="h-6 w-6 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-700 dark:text-blue-400">
                              <User className="h-3.5 w-3.5" />
                            </div>
                            <span className="text-[14px] font-bold">{fu.created_by?.name || "Staff"}</span>
                          </div>

                          {/* Attributes */}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {fu.contacted_via && (
                              <Badge variant="secondary" className="bg-muted/60 hover:bg-muted/80 text-foreground/80 font-semibold px-2.5 py-0.5 capitalize rounded-md">
                                {fu.contacted_via}
                              </Badge>
                            )}
                            {fu.priority && (
                              <Badge variant="secondary" className="bg-muted/60 hover:bg-muted/80 text-foreground/80 font-semibold px-2.5 py-0.5 capitalize rounded-md">
                                {fu.priority}
                              </Badge>
                            )}
                            {fu.rnr && (
                              <Badge variant="secondary" className="bg-muted/60 hover:bg-muted/80 text-foreground/80 font-semibold px-2.5 py-0.5 uppercase rounded-md">
                                {fu.rnr}
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Summary */}
                        <div>
                          <p className="text-[14px] text-foreground/90 font-medium leading-relaxed whitespace-pre-wrap">
                            {fu.notes || <span className="text-muted-foreground/60 italic">No notes provided</span>}
                          </p>
                        </div>
                      </div>

                      {/* Next Follow Up Button / Indicator */}
                      {fu.next_follow_up_date && (
                        <div className="mt-5 border-t pt-4">
                          <Button 
                            variant="outline" 
                            className={`w-full justify-center h-10 font-semibold bg-muted/20 border-border/60 text-foreground/80 ${isAdmin ? 'hover:bg-muted/50 cursor-pointer' : 'cursor-default hover:bg-muted/20'}`}
                            onClick={() => isAdmin && openEdit(fu)}
                          >
                            Next follow-up on {formatFollowUpDate(fu.next_follow_up_date)}
                            {isAdmin && <ArrowUpRight className="ml-2 h-4 w-4 text-muted-foreground" />}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Edit Follow-Up Dialog ── */}
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
            <Button onClick={handleEditSave} disabled={isSavingEdit} className="bg-[#0052FF] text-white hover:bg-[#0040CC] gap-2">
              {isSavingEdit && <Loader2 className="h-4 w-4 animate-spin" />} Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
