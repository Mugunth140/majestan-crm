"use client";

import React, { useState, useEffect } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
  Loader2,
  CalendarClock,
  MessageSquare,
  Phone,
  MessageCircle,
  Mail,
  Smartphone,
  User,
  Trash2,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

// ── Lookup maps ───────────────────────────────────────────────────────────────

const PRIORITIES = [
  { label: "Low", value: "low" },
  { label: "Medium", value: "medium" },
  { label: "High", value: "high" },
  { label: "Urgent", value: "urgent" },
];

const CONTACTED_VIA_OPTIONS = [
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

const CONTACTED_VIA_STYLES: Record<string, { label: string; className: string; icon: React.ElementType }> = {
  call:     { label: "Call",     className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",       icon: Phone },
  whatsapp: { label: "WhatsApp", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400", icon: MessageCircle },
  sms:      { label: "SMS",      className: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",               icon: Smartphone },
  email:    { label: "Email",    className: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",   icon: Mail },
};

const PRIORITY_STYLES: Record<string, string> = {
  low:    "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  medium: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  high:   "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  urgent: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatFollowUpDate(dateStr: string) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface FollowUpPanelProps {
  entityId: number | string;
  entityType: "leads" | "agents" | "inbounds" | "hr";
  followUps: any[];
  onRefresh: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function FollowUpPanel({ entityId, entityType, followUps, onRefresh }: FollowUpPanelProps) {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    try {
      const userStr = localStorage.getItem("crm_user");
      if (userStr) {
        const user = JSON.parse(userStr);
        setIsAdmin(user.role === "Admin" || user.role === "Super Admin");
      }
    } catch {
      /* ignore */
    }
  }, []);

  // Edit state (admin only, kept for data integrity — triggered via "next follow-up" strip)
  const [editFu, setEditFu] = useState<any>(null);
  const [editFuForm, setEditFuForm] = useState<any>({});
  const [isSavingEdit, setIsSavingEdit] = useState(false);

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
      const res = await fetch(`${API_URL}/${entityType}/${entityId}/follow-ups/${editFu.id}`, {
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
    } catch {
      toast.error("Failed to update follow-up");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDeleteFu = async (fuId: number) => {
    if (!confirm("Are you sure you want to delete this follow-up?")) return;
    try {
      const res = await fetch(`${API_URL}/${entityType}/${entityId}/follow-ups/${fuId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Follow-up deleted.");
        onRefresh();
      } else toast.error(data.message || "Failed to delete follow-up");
    } catch {
      toast.error("Failed to delete follow-up");
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="flex flex-col h-full">

        {/* ── Timeline ── */}
        <div className="flex-1 overflow-y-auto min-h-0 py-6 px-5 pb-12">
          {followUps.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 px-4">
              <div className="h-14 w-14 rounded-full bg-muted/40 flex items-center justify-center mb-4">
                <MessageSquare className="h-6 w-6 text-muted-foreground/40" />
              </div>
              <p className="text-sm font-medium text-muted-foreground text-center">No follow-ups recorded yet</p>
              <p className="text-xs text-muted-foreground/60 text-center mt-1">Log a follow-up to get started</p>
            </div>
          ) : (
            <div className="relative">
              {/* Vertical connector line */}
              <div
                className="absolute left-[15px] top-[18px] bottom-8 w-[2px] bg-gradient-to-b from-[#0052FF]/60 via-[#0052FF]/20 to-transparent"
                aria-hidden
              />

              <div className="space-y-8">
                {followUps.map((fu: any, idx: number) => {
                  const timestamp = getFuDateObj(fu.follow_up_date, fu.follow_up_time || "00:00");
                  const relativeTime = timestamp ? formatDistanceToNow(timestamp, { addSuffix: true }) : "";
                  const absoluteDate = timestamp
                    ? format(timestamp, "d MMM yyyy")
                    : formatFollowUpDate(fu.follow_up_date);
                  const absoluteTime = timestamp ? format(timestamp, "h:mm a") : "";

                  const viaStyle = fu.contacted_via ? CONTACTED_VIA_STYLES[fu.contacted_via] : null;
                  const ViaIcon = viaStyle?.icon;
                  const isLast = idx === followUps.length - 1;

                  return (
                    <div key={fu.id} className="relative flex gap-4">

                      {/* ── Left gutter: dot ── */}
                      <div className="flex flex-col items-center shrink-0" style={{ width: 32 }}>
                        {/* Dot */}
                        <div
                          className={`mt-[14px] h-[10px] w-[10px] rounded-full border-2 border-[#0052FF] shrink-0 z-10 ${
                            idx === 0 ? "bg-[#0052FF]" : "bg-white dark:bg-background"
                          }`}
                        />
                      </div>

                      {/* ── Right: date label + card ── */}
                      <div className="flex-1 min-w-0 pb-2">

                        {/* Date / time label */}
                        <div className="flex items-baseline gap-2 mb-2.5">
                          <span className="text-[13px] font-bold text-foreground/85">{absoluteDate}</span>
                          {absoluteTime && (
                            <span className="text-[12px] text-muted-foreground">{absoluteTime}</span>
                          )}
                          <span className="text-[11px] text-muted-foreground/60 ml-auto">{relativeTime}</span>
                        </div>

                        {/* Card */}
                        <div className="rounded-xl border bg-card shadow-sm overflow-hidden transition-shadow hover:shadow-md">

                          {/* ── Card header: staff + method badge ── */}
                          <div className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-3 border-b border-border/40">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="h-7 w-7 shrink-0 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-[#0052FF] dark:text-blue-400">
                                <User className="h-3.5 w-3.5" />
                              </div>
                              <span className="text-[13px] font-semibold text-foreground truncate">
                                {fu.created_by?.name || "Staff"}
                              </span>
                            </div>

                            {/* Badges */}
                            <div className="flex items-center gap-1.5 flex-wrap justify-end shrink-0">
                              {viaStyle && ViaIcon && (
                                <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${viaStyle.className}`}>
                                  <ViaIcon className="h-3 w-3" />
                                  {viaStyle.label}
                                </span>
                              )}
                              {fu.priority && (
                                <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full capitalize ${PRIORITY_STYLES[fu.priority] ?? "bg-muted/60 text-foreground/80"}`}>
                                  {fu.priority}
                                </span>
                              )}
                              {fu.rnr && (
                                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full uppercase bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                  {fu.rnr}
                                </span>
                              )}
                              {isAdmin && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 ml-1 text-red-500 hover:text-red-700 hover:bg-red-50"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteFu(fu.id);
                                  }}
                                  title="Delete Follow-up"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          </div>

                          {/* ── Notes ── */}
                          <div className="px-4 py-4">
                            {fu.notes ? (
                              <p className="text-[14px] text-foreground/85 leading-[1.65] whitespace-pre-wrap">
                                {fu.notes}
                              </p>
                            ) : (
                              <p className="text-[13px] text-muted-foreground/50 italic">No notes provided</p>
                            )}
                          </div>

                          {/* ── Next follow-up footer ── */}
                          {fu.next_follow_up_date && (
                            <div
                              className={`flex items-center gap-2.5 px-4 py-3 border-t border-blue-100 dark:border-blue-900/30 bg-blue-50/70 dark:bg-blue-900/10 ${
                                isAdmin ? "cursor-pointer hover:bg-blue-100/80 dark:hover:bg-blue-900/20" : ""
                              } transition-colors`}
                              onClick={() => isAdmin && openEdit(fu)}
                            >
                              <CalendarClock className="h-3.5 w-3.5 text-[#0052FF] dark:text-blue-400 shrink-0" />
                              <span className="text-[12px] font-semibold text-[#0052FF] dark:text-blue-400">
                                Next follow-up
                              </span>
                              <span className="text-[12px] text-[#0052FF]/70 dark:text-blue-400/70">
                                {formatFollowUpDate(fu.next_follow_up_date)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Edit Follow-Up Dialog (admin only, triggered from next follow-up strip) ── */}
      <Dialog open={!!editFu} onOpenChange={(open) => !open && setEditFu(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Follow-Up</DialogTitle>
            <DialogDescription>Update the details for this follow-up record.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-1.5 col-span-2 sm:col-span-1">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Follow-Up Date &amp; Time</label>
              <DateTimePicker
                value={getFuDateObj(editFuForm.followUpDate, editFuForm.followUpTime)}
                onChange={(date) => handleEditDateTimeChange("followUp", date)}
              />
            </div>
            <div className="space-y-1.5 col-span-2 sm:col-span-1">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Next Follow-Up Date &amp; Time</label>
              <DateTimePicker
                value={getFuDateObj(editFuForm.nextFollowUpDate, editFuForm.nextFollowUpTime)}
                onChange={(date) => handleEditDateTimeChange("nextFollowUp", date)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Contacted Via</label>
              <FormSelect
                name="editContactedVia"
                placeholder="How contacted?"
                options={CONTACTED_VIA_OPTIONS}
                value={editFuForm.contactedVia}
                onValueChange={(v) => setEditFuForm((f: any) => ({ ...f, contactedVia: v || "" }))}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Priority</label>
              <FormSelect
                name="editPriority"
                placeholder="Priority"
                options={PRIORITIES}
                value={editFuForm.priority}
                onValueChange={(v) => setEditFuForm((f: any) => ({ ...f, priority: v || "" }))}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">RNR Status</label>
              <FormSelect
                name="editRnr"
                placeholder="RNR"
                options={RNR_OPTIONS}
                value={editFuForm.rnr}
                onValueChange={(v) => setEditFuForm((f: any) => ({ ...f, rnr: v || "" }))}
              />
            </div>
            <div className="col-span-2 space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Notes</label>
              <Textarea
                value={editFuForm.notes}
                onChange={(e) => setEditFuForm((f: any) => ({ ...f, notes: e.target.value }))}
                className="bg-muted/30 rounded-xl resize-none"
                rows={3}
              />
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
