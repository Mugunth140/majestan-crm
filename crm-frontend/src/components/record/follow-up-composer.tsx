"use client";

import { useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Flag, Loader2, Mail, MessageCircle, Phone, PhoneMissed, Smartphone } from "lucide-react";
import { apiFetch } from "@/lib/api-fetch";
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DateTimePicker } from "@/components/shared/datetime-picker";
import { cn } from "@/lib/utils";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

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

const PRIORITY_FLAG: Record<string, string> = {
  low: "text-sky-500", medium: "text-amber-500", high: "text-orange-500", urgent: "text-red-500",
};

// Small text buttons in the composer's toolbar.
const CHIP =
  "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";
const PRIMARY =
  "inline-flex h-8 items-center gap-1.5 rounded-md bg-foreground px-3 text-[13px] font-medium text-background transition-colors hover:bg-foreground/85";

const EMPTY = { contactedVia: "", nextFollowUpDate: "", nextFollowUpTime: "", priority: "", rnr: "", notes: "" };

type FollowUpLike = { follow_up_date?: string | null; follow_up_time?: string | null; rnr?: string | null };

const toDate = (d: string, t: string) => {
  if (!d) return undefined;
  const date = new Date(d);
  if (t) {
    const [hh, mm] = t.split(":");
    date.setHours(Number(hh), Number(mm), 0, 0);
  }
  return date;
};

/** The RNR count of the latest follow-up: the next one is this + 1, up to 5. */
export function latestRnr(followUps: FollowUpLike[]) {
  const latest = [...followUps].sort(
    (a, b) => new Date(`${b.follow_up_date}T${b.follow_up_time || "00:00:00"}`).getTime() - new Date(`${a.follow_up_date}T${a.follow_up_time || "00:00:00"}`).getTime(),
  )[0];
  const n = latest?.rnr?.startsWith("rnr") ? Number(latest.rnr.slice(3)) : 0;
  return Number.isFinite(n) ? n : 0;
}

/**
 * The follow-up composer in a record's Conversation bottom bar: notes, how the
 * contact happened, the next follow-up, priority and RNR, logged in one row.
 * Shared by leads and inbounds (`api` is the record's API path).
 */
export function FollowUpComposer({ api, entityId, noun, followUps, onSaved }: {
  api: "leads" | "inbounds" | "agents";
  entityId: number | string;
  /** "lead", "owner"… for the messages. */
  noun: string;
  followUps: FollowUpLike[];
  onSaved: () => void;
}) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const highest = latestRnr(followUps);
  const nextNumber = highest + 1;
  const nextValue = `rnr${nextNumber}`;
  const maxed = highest >= 5;
  const rnrOn = form.rnr === nextValue;
  const rnrNote = `RNR ${nextNumber} for this ${noun}`;

  const setNext = (d: Date | undefined) =>
    setForm((f) => ({ ...f, nextFollowUpDate: d ? format(d, "yyyy-MM-dd") : "", nextFollowUpTime: d ? format(d, "HH:mm") : "" }));

  const save = async () => {
    if (!form.contactedVia) return void toast.error(`Pick how you contacted the ${noun}.`);
    const next = toDate(form.nextFollowUpDate, form.nextFollowUpTime);
    if (next && Math.abs(next.getTime() - Date.now()) > 45 * 86_400_000) {
      return void toast.error("Pick a follow-up date within the next 45 days.");
    }
    setSaving(true);
    const now = new Date();
    try {
      const res = await apiFetch(`${API_URL}/${api}/${entityId}/follow-ups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, followUpDate: format(now, "yyyy-MM-dd"), followUpTime: format(now, "HH:mm") }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      toast.success("Follow-up logged.");
      setForm(EMPTY);
      onSaved();
    } catch (reason) {
      toast.error(reason instanceof Error && reason.message ? reason.message : "Failed to save follow-up");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <Textarea
        value={form.notes}
        onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
        onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void save(); }}
        placeholder="What was discussed? Log a follow-up…"
        disabled={!!form.rnr}
        aria-label="Follow-up notes"
        className="max-h-[40vh] min-h-[76px] resize-none rounded-none border-0 bg-transparent px-4 pb-1 pt-3 text-[14px] shadow-none focus-visible:ring-0 disabled:opacity-70 md:px-6 dark:bg-transparent"
      />
      <div className="flex flex-wrap items-center gap-1 px-3 pb-2.5 md:px-5">
        <div role="radiogroup" aria-label="Contacted via" className="flex items-center gap-0.5 rounded-lg bg-foreground/[0.05] p-0.5">
          {CONTACTED_VIA.map(({ label, value, icon: Icon }) => {
            const on = form.contactedVia === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={on}
                aria-label={label}
                title={label}
                onClick={() => setForm((f) => ({ ...f, contactedVia: on ? "" : value }))}
                className={cn(
                  "inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[13px] font-medium transition-colors",
                  on ? "bg-background text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.08)] dark:bg-foreground/15" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {on && label}
              </button>
            );
          })}
        </div>
        <span aria-hidden className="mx-1 hidden h-5 w-px bg-border sm:block" />
        <DateTimePicker
          inline
          value={toDate(form.nextFollowUpDate, form.nextFollowUpTime)}
          onChange={setNext}
          placeholder="Next follow-up"
          displayFormat="d MMM, h:mm a"
          className={cn(CHIP, "w-auto! border-0! bg-transparent! shadow-none! [&_svg]:mr-0!", form.nextFollowUpDate && "text-foreground!")}
        />
        <DropdownMenu>
          <DropdownMenuTrigger render={<button type="button" className={cn(CHIP, form.priority && "text-foreground")} />}>
            <Flag className={cn("h-4 w-4", PRIORITY_FLAG[form.priority])} />
            {PRIORITIES.find((p) => p.value === form.priority)?.label ?? "Priority"}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-36">
            {PRIORITIES.map((p) => (
              <DropdownMenuItem key={p.value} onClick={() => setForm((f) => ({ ...f, priority: p.value }))}>
                <Flag className={cn("h-4 w-4", PRIORITY_FLAG[p.value])} /> {p.label}
              </DropdownMenuItem>
            ))}
            {form.priority && <DropdownMenuItem onClick={() => setForm((f) => ({ ...f, priority: "" }))} className="text-muted-foreground">Clear</DropdownMenuItem>}
          </DropdownMenuContent>
        </DropdownMenu>
        <button
          type="button"
          disabled={maxed}
          aria-pressed={rnrOn}
          title="Mark this attempt as Ringing, No Response"
          onClick={() => setForm((f) => ({
            ...f,
            rnr: rnrOn ? "" : nextValue,
            notes: !rnrOn ? rnrNote : f.notes === rnrNote ? "" : f.notes,
          }))}
          className={cn(CHIP, "disabled:opacity-50", rnrOn && "bg-orange-500/10 text-orange-600 hover:bg-orange-500/15 hover:text-orange-600 dark:text-orange-400")}
        >
          <PhoneMissed className="h-4 w-4" />
          {maxed ? "Max RNR" : `RNR ${nextNumber}`}
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving || !form.contactedVia}
          title={form.contactedVia ? "Log follow-up (Ctrl+Enter)" : `Pick how you contacted the ${noun}`}
          className={cn(PRIMARY, "ml-auto disabled:opacity-50")}
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Log follow-up
        </button>
      </div>
    </div>
  );
}
