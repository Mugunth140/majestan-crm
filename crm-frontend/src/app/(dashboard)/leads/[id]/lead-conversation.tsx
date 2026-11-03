"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Loader2, Mail, MessageCircle, MoreHorizontal, PenLine, Phone, RotateCcw, Smartphone, StickyNote } from "lucide-react";
import { apiFetch } from "@/lib/api-fetch";
import { mailApi, MAIL_STATUS, newDraftIds, type MailCatalog, type MailSummary, type MailTarget } from "@/lib/mail-api";
import { CONTACT_TYPE_STYLES, contactLogAuthor, contactLogIcon, formatDuration } from "@/lib/contact-log-utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { FormSelect } from "@/components/shared/form-select";
import { DateTimePicker } from "@/components/shared/datetime-picker";
import { MailComposer, type ComposerStart } from "@/components/mail/mail-composer";
import { MailPreviewDialog } from "@/components/mail/mail-preview-dialog";
import { cn } from "@/lib/utils";
import { Feed, Who, sortNewestFirst, type FeedItem } from "./lead-feed";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

type FollowUp = {
  id: number;
  contacted_via?: string | null;
  created_at?: string | null;
  follow_up_date?: string | null;
  follow_up_time?: string | null;
  next_follow_up_date?: string | null;
  next_follow_up_time?: string | null;
  notes?: string | null;
  outcome?: string | null;
  priority?: string | null;
  rnr?: string | null;
  created_by?: { name?: string } | null;
};

type ContactLog = {
  id: number;
  contact_type: string;
  call_direction?: string | null;
  call_duration?: number | string | null;
  created_at: string;
  subject?: string | null;
  message?: string | null;
  sent_by?: { name?: string } | null;
  source_call_id?: string | null;
};

const VIA: Record<string, { label: string; icon: typeof Phone; tone: string }> = {
  call: { label: "call", icon: Phone, tone: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  whatsapp: { label: "WhatsApp", icon: MessageCircle, tone: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  sms: { label: "SMS", icon: Smartphone, tone: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400" },
  email: { label: "email", icon: Mail, tone: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400" },
};

const PRIORITIES = [
  { label: "Low", value: "low" },
  { label: "Medium", value: "medium" },
  { label: "High", value: "high" },
  { label: "Urgent", value: "urgent" },
];

const followUpTime = (fu: FollowUp) =>
  fu.created_at ? new Date(fu.created_at) : new Date(`${fu.follow_up_date}T${fu.follow_up_time || "00:00"}`);

function nextFollowUp(fu: FollowUp): string | null {
  if (!fu.next_follow_up_date) return null;
  const at = new Date(`${String(fu.next_follow_up_date).slice(0, 10)}T${fu.next_follow_up_time || "00:00"}`);
  if (Number.isNaN(at.getTime())) return null;
  return `Next: ${format(at, fu.next_follow_up_time ? "d MMM, h:mm a" : "d MMM")}`;
}

const dateTime = (d?: string | null, t?: string | null) => {
  if (!d) return undefined;
  const date = new Date(String(d).slice(0, 10));
  if (t) {
    const [hh, mm] = t.split(":");
    date.setHours(Number(hh), Number(mm), 0, 0);
  }
  return date;
};

/**
 * Everything said to and from the lead in one place: follow-ups, calls,
 * WhatsApp, SMS and email (drafts waiting first), newest first.
 */
export function LeadConversation({
  leadId, email, followUps, contactLogs, composer, canEdit, isAdmin, refreshKey, onRefresh,
}: {
  leadId: number;
  email?: string | null;
  followUps: FollowUp[];
  contactLogs: ContactLog[];
  composer: ReactNode;
  canEdit: boolean;
  isAdmin: boolean;
  refreshKey: number;
  onRefresh: () => void;
}) {
  const [catalog, setCatalog] = useState<MailCatalog | null>(null);
  const [mails, setMails] = useState<MailSummary[]>([]);
  const [target, setTarget] = useState<MailTarget | null>(null);
  const [mailComposer, setMailComposer] = useState<ComposerStart | null>(null);
  const [retrying, setRetrying] = useState<number | null>(null);
  const [editing, setEditing] = useState<FollowUp | null>(null);
  const seen = useRef<Set<number> | null>(null);

  const fetchMail = useCallback(
    () => Promise.all([mailApi.catalog("lead"), mailApi.history("lead", leadId)]),
    [leadId],
  );

  const apply = useCallback(([nextCatalog, history]: [MailCatalog, MailSummary[]]) => {
    setCatalog(nextCatalog);
    setMails(history);
    // A status change that just created a draft opens it straight away.
    const fresh = newDraftIds(seen.current, history);
    if (fresh.length && nextCatalog.events.some((e) => e.canSend)) setTarget({ kind: "draft", id: fresh[0] });
    seen.current = new Set(history.map((row) => row.id));
  }, []);

  // Older backends without the mail API: show the rest of the conversation.
  const loadMail = useCallback(() => fetchMail().then(apply, () => setCatalog(null)), [fetchMail, apply]);

  useEffect(() => {
    let live = true;
    fetchMail().then((r) => { if (live) apply(r); }, () => { if (live) setCatalog(null); });
    return () => { live = false; };
  }, [fetchMail, apply, refreshKey]);

  const canSendMail = !!catalog?.events.some((e) => e.canSend);
  const writable = catalog?.senders?.filter((s) => s.canSend) ?? [];
  const drafts = mails.filter((m) => m.status === "draft");

  const retry = async (id: number) => {
    setRetrying(id);
    try {
      await mailApi.retry(id);
      toast.success("Email queued again.");
      await loadMail();
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Could not retry the email");
    } finally {
      setRetrying(null);
    }
  };

  const deleteFollowUp = async (id: number) => {
    if (!confirm("Delete this follow-up?")) return;
    try {
      const res = await apiFetch(`${API_URL}/leads/${leadId}/follow-ups/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      toast.success("Follow-up deleted.");
      onRefresh();
    } catch (reason) {
      toast.error(reason instanceof Error && reason.message ? reason.message : "Failed to delete follow-up");
    }
  };

  const items = useMemo(() => {
    const list: FeedItem[] = [];

    for (const fu of followUps) {
      const via = (fu.contacted_via && VIA[fu.contacted_via]) || null;
      const Icon = via?.icon ?? StickyNote;
      list.push({
        key: `fu-${fu.id}`,
        at: followUpTime(fu),
        icon: <Icon />,
        tone: via?.tone ?? "bg-muted text-muted-foreground",
        title: <><Who>{fu.created_by?.name || "Staff"}</Who> logged a {via ? `${via.label} ` : ""}follow-up</>,
        body: fu.notes,
        chips: [
          fu.outcome,
          fu.priority && `${fu.priority[0].toUpperCase()}${fu.priority.slice(1)} priority`,
          fu.rnr && fu.rnr.toUpperCase().replace("RNR", "RNR "),
          nextFollowUp(fu),
        ].filter(Boolean) as string[],
        actions: isAdmin ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<button type="button" aria-label="Follow-up actions" className="-my-1 flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-muted focus-visible:opacity-100 group-hover/item:opacity-100 data-[popup-open]:opacity-100" />}
            >
              <MoreHorizontal className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36">
              <DropdownMenuItem onClick={() => setEditing(fu)}>Edit</DropdownMenuItem>
              <DropdownMenuItem onClick={() => deleteFollowUp(fu.id)} className="text-red-600 focus:text-red-600">Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : undefined,
      });
    }

    for (const log of contactLogs) {
      const isCall = log.contact_type === "call";
      const kind = log.contact_type === "sms" ? "an SMS" : log.contact_type === "email" ? "an email" : "a WhatsApp message";
      list.push({
        key: `log-${log.id}`,
        at: new Date(log.created_at),
        icon: contactLogIcon(log),
        tone: CONTACT_TYPE_STYLES[log.contact_type] || "bg-muted text-muted-foreground",
        title: isCall
          ? <><Who>{contactLogAuthor(log)}</Who> · {(log.call_direction || "voice").toLowerCase()} call, {formatDuration(log.call_duration)}</>
          : <><Who>{contactLogAuthor(log)}</Who> sent {kind}</>,
        body: [log.subject && `Subject: ${log.subject}`, log.message].filter(Boolean).join("\n") || null,
      });
    }

    for (const mail of mails) {
      if (mail.status === "draft") continue;
      const status = MAIL_STATUS[mail.status];
      list.push({
        key: `mail-${mail.id}`,
        at: new Date(mail.sentAt ?? mail.confirmedAt ?? mail.createdAt),
        icon: <Mail />,
        tone: VIA.email.tone,
        title: <><Who>{mail.label}</Who> email to {mail.to.join(", ")}</>,
        body: [mail.subject, mail.lastError && ["failed", "pending", "suppressed"].includes(mail.status) ? `⚠ ${mail.lastError}` : null].filter(Boolean).join("\n"),
        chips: [status.label + (mail.status === "pending" && mail.attempts > 0 ? ` · attempt ${mail.attempts + 1}` : "")],
        extra: mail.status === "failed" && canSendMail ? (
          <Button variant="outline" size="sm" disabled={retrying === mail.id} onClick={() => retry(mail.id)} className="mt-2 h-7 gap-1.5 text-[12px]">
            {retrying === mail.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
            Retry
          </Button>
        ) : undefined,
      });
    }

    return sortNewestFirst(list);
    // retry/deleteFollowUp only read state through setters and props already listed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [followUps, contactLogs, mails, isAdmin, canSendMail, retrying]);

  return (
    <div className="space-y-6">
      {composer}

      {(writable.length > 0 || catalog?.redirectTo) && (
        <div className="flex flex-wrap items-center gap-2">
          {catalog?.redirectTo && (
            <p className="flex-1 rounded-md bg-violet-50 px-2.5 py-1.5 text-[12px] text-violet-900 dark:bg-violet-950/40 dark:text-violet-200">
              Test mode: emails go to {catalog.redirectTo}.
            </p>
          )}
          {writable.length > 0 && canEdit && (
            <button
              type="button"
              onClick={() => setMailComposer({ kind: "blank" })}
              className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-md border bg-background px-3 text-[13px] font-medium text-foreground transition-colors hover:bg-muted"
            >
              <PenLine className="h-3.5 w-3.5 text-muted-foreground" /> Write email
            </button>
          )}
        </div>
      )}

      {drafts.map((draft) => (
        <div key={draft.id} className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 dark:border-amber-900/60 dark:bg-amber-950/20">
          <p className="text-[13px] font-semibold text-amber-900 dark:text-amber-300">Email ready to send: {draft.label}</p>
          <p className="mt-0.5 truncate text-[12px] text-amber-900/70 dark:text-amber-300/70">To {draft.to.join(", ")}</p>
          {canSendMail && (
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setMailComposer({ kind: "draft", id: draft.id, eventKey: draft.event })} className="h-8 bg-background">
                Edit
              </Button>
              <Button size="sm" onClick={() => setTarget({ kind: "draft", id: draft.id })} className="h-8 bg-foreground text-background hover:bg-foreground/85">
                Preview &amp; send
              </Button>
            </div>
          )}
        </div>
      ))}

      {items.length ? (
        <Feed items={items} />
      ) : (
        <div className="flex flex-col items-center py-14 text-center">
          <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-foreground/[0.05] text-muted-foreground"><MessageCircle className="h-5 w-5" /></span>
          <p className="text-[14px] font-medium text-foreground">No conversation yet</p>
          <p className="mt-1 text-[13px] text-muted-foreground">Follow-ups, calls, messages and emails will show up here.</p>
        </div>
      )}

      <MailPreviewDialog target={target} entityId={leadId} onClose={() => setTarget(null)} onDone={() => { setTarget(null); void loadMail(); }} />
      <MailComposer
        entityType="lead"
        entityId={leadId}
        start={mailComposer}
        recipients={email ? [email] : []}
        senders={writable}
        onClose={() => setMailComposer(null)}
        onSent={() => { setMailComposer(null); void loadMail(); }}
      />
      <EditFollowUpDialog leadId={leadId} followUp={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); onRefresh(); }} />
    </div>
  );
}

function EditFollowUpDialog({ leadId, followUp, onClose, onSaved }: {
  leadId: number;
  followUp: FollowUp | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [notes, setNotes] = useState("");
  const [priority, setPriority] = useState("");
  const [next, setNext] = useState<Date | undefined>();
  const [saving, setSaving] = useState(false);
  const [openedFor, setOpenedFor] = useState<number | null>(null);

  // Load the follow-up's values each time a different one is opened.
  if (followUp && openedFor !== followUp.id) {
    setOpenedFor(followUp.id);
    setNotes(followUp.notes ?? "");
    setPriority(followUp.priority ?? "");
    setNext(dateTime(followUp.next_follow_up_date, followUp.next_follow_up_time));
  }
  if (!followUp && openedFor !== null) setOpenedFor(null);

  const save = async () => {
    if (!followUp) return;
    setSaving(true);
    try {
      const res = await apiFetch(`${API_URL}/leads/${leadId}/follow-ups/${followUp.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          followUpDate: followUp.follow_up_date ?? "",
          followUpTime: followUp.follow_up_time ?? "",
          contactedVia: followUp.contacted_via ?? "",
          rnr: followUp.rnr ?? "",
          notes,
          priority,
          nextFollowUpDate: next ? format(next, "yyyy-MM-dd") : "",
          nextFollowUpTime: next ? format(next, "HH:mm") : "",
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error();
      toast.success("Follow-up updated.");
      onSaved();
    } catch {
      toast.error("Failed to update follow-up");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!followUp} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit follow-up</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes" className="min-h-[96px] resize-none" />
          <div className="grid grid-cols-2 gap-2">
            <DateTimePicker value={next} onChange={setNext} placeholder="Next follow-up" className="h-9! rounded-md! text-[13px]!" />
            <FormSelect name="editPriority" placeholder="Priority" options={PRIORITIES} value={priority} onValueChange={(v) => setPriority(v || "")} className="h-9! rounded-md! text-[13px]!" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving} className={cn("bg-foreground text-background hover:bg-foreground/85")}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
