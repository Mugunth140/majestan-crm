"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { CalendarClock, CalendarDays, ChevronDown, Plus, Flag, Loader2, Mail, MessageCircle, MoreHorizontal, NotebookPen, Phone, PhoneIncoming, PhoneMissed, PhoneOutgoing, Reply, ReplyAll, RotateCcw, Send, Share2, Smartphone, StickyNote, Timer, X } from "lucide-react";
import { toHrFollowUpPayload } from "@/lib/hr-follow-up";
import Link from "next/link";
import { apiFetch } from "@/lib/api-fetch";
import { listingHref, parseShare, shareApi } from "@/lib/listing-share";
import { mailApi, MAIL_STATUS, newDraftIds, type MailCatalog, type MailSummary, type MailTarget } from "@/lib/mail-api";
import { contactLogAuthor, formatDuration } from "@/lib/contact-log-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { FormSelect } from "@/components/shared/form-select";
import { DateTimePicker } from "@/components/shared/datetime-picker";
import { MailComposer, type ComposerStart } from "@/components/mail/mail-composer";
import { MailPreviewDialog } from "@/components/mail/mail-preview-dialog";
import { cn } from "@/lib/utils";
import { withCurrent } from "./inline-field";
import { Avatar, CARD, Chip, Feed, FeedTime, TabHeader, Who, sortOldestFirst, type FeedItem } from "./feed";

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
  created_by?: { id?: number; name?: string } | null;
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

const VIA: Record<string, { label: string; icon: typeof Phone }> = {
  call: { label: "call", icon: Phone },
  whatsapp: { label: "WhatsApp", icon: MessageCircle },
  sms: { label: "SMS", icon: Smartphone },
  email: { label: "email", icon: Mail },
};

const PRIORITY_FLAG: Record<string, string> = {
  low: "text-sky-500", medium: "text-amber-500", high: "text-orange-500", urgent: "text-red-500",
};

const PRIORITIES = [
  { label: "Low", value: "low" },
  { label: "Medium", value: "medium" },
  { label: "High", value: "high" },
  { label: "Urgent", value: "urgent" },
];

function followUpTime(fu: FollowUp, useContactDate: boolean) {
  const contactDate = new Date(`${fu.follow_up_date?.slice(0, 10)}T${fu.follow_up_time || "00:00"}`);
  return fu.created_at && (!useContactDate || Number.isNaN(contactDate.getTime())) ? new Date(fu.created_at) : contactDate;
}

const NO_SELECTION = { label: "None", value: "__none" };
const followUpChoice = (value: string | null) => value && value !== NO_SELECTION.value ? value : "";
const EDIT_CHANNELS = [NO_SELECTION, ...Object.entries(VIA).map(([value, { label }]) => ({
  value, label: label[0].toUpperCase() + label.slice(1),
}))];
const EDIT_RNR = [NO_SELECTION, ...[1, 2, 3, 4, 5].map((n) => ({ label: `RNR ${n}`, value: `rnr${n}` }))];

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

/** Which record the conversation belongs to: its API path and mail entity. */
export type ConversationEntity = {
  api: "leads" | "inbounds" | "agents" | "hr";
  mail: "lead" | "inbound" | "agent" | "hr_candidate";
  noun: string;
  editMethod: "PUT" | "PATCH";
  /** Reshapes a follow-up body for APIs that don't take the camelCase one (HR). */
  followUpBody?: (body: Record<string, string>) => Record<string, unknown>;
};
export const LEAD_ENTITY: ConversationEntity = { api: "leads", mail: "lead", noun: "lead", editMethod: "PUT" };
export const INBOUND_ENTITY: ConversationEntity = { api: "inbounds", mail: "inbound", noun: "inbound", editMethod: "PATCH" };
export const AGENT_ENTITY: ConversationEntity = { api: "agents", mail: "agent", noun: "agent", editMethod: "PUT" };
export const HR_ENTITY: ConversationEntity = { api: "hr", mail: "hr_candidate", noun: "candidate", editMethod: "PUT", followUpBody: toHrFollowUpPayload };

export type ComposeMode = "followup" | "email" | "whatsapp";
/** Opens a composer from outside; `n` changes per request. `mail` starts the email pre-written. */
export type ComposeRequest = { mode: ComposeMode; n: number; mail?: ComposerStart };
type Mode = ComposeMode;

const MODES: { key: Mode; label: string; icon: typeof Phone }[] = [
  { key: "followup", label: "Follow-up", icon: NotebookPen },
  { key: "email", label: "Email", icon: Mail },
  { key: "whatsapp", label: "WhatsApp", icon: MessageCircle },
];

/** Digits for wa.me links; bare 10-digit numbers are taken as Indian (+91). */
const dialable = (n?: string | null) => {
  const digits = (n ?? "").replace(/\D/g, "");
  return digits.length === 10 ? `91${digits}` : digits;
};

/**
 * Everything said to and from the lead in one place, read like a chat:
 * follow-ups, calls, WhatsApp, SMS and email, oldest first, with a composer
 * docked at the bottom that switches between follow-up, email and messages.
 */
export function LeadConversation({
  leadId, leadName, entity = LEAD_ENTITY, email, mobile, whatsapp, followUps, contactLogs, composer, canEdit, isAdmin, refreshKey, onRefresh, request,
}: {
  leadId: number;
  leadName?: string | null;
  /** Defaults to a lead. */
  entity?: ConversationEntity;
  email?: string | null;
  mobile?: string | null;
  whatsapp?: string | null;
  followUps: FollowUp[];
  contactLogs: ContactLog[];
  composer: ReactNode;
  canEdit: boolean;
  isAdmin: boolean;
  refreshKey: number;
  onRefresh: () => void;
  /** Opens a composer from outside (the page's Call / WhatsApp / Email buttons, or sharing listings). */
  request?: ComposeRequest | null;
}) {
  const [catalog, setCatalog] = useState<MailCatalog | null>(null);
  const [mails, setMails] = useState<MailSummary[]>([]);
  const [target, setTarget] = useState<MailTarget | null>(null);
  const [mailComposer, setMailComposer] = useState<ComposerStart | null>(null);
  const [mode, setMode] = useState<Mode | null>(null);
  const [handled, setHandled] = useState<number | null>(null);
  if (request && request.n !== handled) {
    setHandled(request.n);
    setMode(request.mode);
    if (request.mail) setMailComposer(request.mail);
    else if (request.mode === "email" && !mailComposer) setMailComposer({ kind: "blank" });
  }
  const end = useRef<HTMLDivElement>(null);
  const [retrying, setRetrying] = useState<number | null>(null);
  const [editing, setEditing] = useState<FollowUp | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set());
  const seen = useRef<Set<number> | null>(null);

  const fetchMail = useCallback(
    () => Promise.all([mailApi.catalog(entity.mail), mailApi.history(entity.mail, leadId)]),
    [leadId, entity.mail],
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

  /** Automatic emails wait a few minutes before sending; this stops one in that window. */
  const stopSending = async (id: number) => {
    setRetrying(id);
    try {
      await mailApi.cancel(id);
      toast.success("Email won't be sent.");
      await loadMail();
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Could not stop the email");
      await loadMail();
    } finally {
      setRetrying(null);
    }
  };

  const deleteFollowUp = async (id: number) => {
    if (!confirm("Delete this follow-up?")) return;
    try {
      const res = await apiFetch(`${API_URL}/${entity.api}/${leadId}/follow-ups/${id}`, { method: "DELETE" });
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
      const who = fu.created_by?.name || "Staff";
      const next = nextFollowUp(fu);
      list.push({
        key: `fu-${fu.id}`,
        at: followUpTime(fu, entity.api === "inbounds"),
        icon: <Icon />,
        who,
        whoId: fu.created_by?.id,
        title: <><Who>{who}</Who> logged {via ? (via.label === "SMS" ? "an SMS" : `a ${via.label}`) : "a"} follow-up</>,
        body: fu.notes,
        chips: [
          fu.outcome && <Chip key="o">{fu.outcome}</Chip>,
          fu.priority && <Chip key="p"><Flag className={PRIORITY_FLAG[fu.priority]} />{fu.priority[0].toUpperCase() + fu.priority.slice(1)}</Chip>,
          fu.rnr && !/\brnr\b/i.test(fu.notes ?? "") && <Chip key="r"><PhoneMissed />{fu.rnr.toUpperCase().replace("RNR", "RNR ")}</Chip>,
          next && <Chip key="n"><CalendarClock />{next}</Chip>,
        ].filter(Boolean),
        actions: isAdmin ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<button type="button" aria-label="Follow-up actions" className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-muted focus-visible:opacity-100 group-hover/item:opacity-100 data-[popup-open]:opacity-100" />}
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
      const at = new Date(log.created_at);
      const who = contactLogAuthor(log);
      if (log.contact_type === "call") {
        const direction = (log.call_direction || "").toLowerCase();
        const incoming = direction === "incoming" || direction === "missed" || direction === "rejected";
        const seconds = Number(log.call_duration) || 0;
        const answered = seconds > 0 && direction !== "missed" && direction !== "rejected";
        const outcome = answered
          ? { label: "Completed", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" }
          : { label: incoming ? "Missed" : "No answer", className: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" };
        list.push({
          key: `log-${log.id}`,
          at,
          icon: !answered ? <PhoneMissed /> : incoming ? <PhoneIncoming /> : <PhoneOutgoing />,
          iconClass: !answered ? "text-red-600 dark:text-red-400" : undefined,
          who,
          title: <><Who>{who}</Who> {incoming ? (answered ? "received a call" : "missed a call") : "made a call"}</>,
          extra: (
            <div className={cn(CARD, "px-3.5 py-3")}>
              <div className="flex items-center gap-2">
                <p className="flex-1 text-[14px] font-medium text-foreground">{incoming ? "Inbound call" : "Outbound call"}</p>
                {/* Who was on the call: the staff member, then the lead. */}
                <span className="flex -space-x-1">
                  <Avatar name={who} staff className="ring-2 ring-card" />
                  {leadName && <Avatar name={leadName} className="ring-2 ring-card" />}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <Chip><CalendarDays />{format(at, "MMM d, EEEE")}</Chip>
                {answered && <Chip><Timer />{formatDuration(log.call_duration)}</Chip>}
                <Chip>{format(at, "h:mm a")}</Chip>
                <span className={cn("inline-flex h-6 items-center rounded-md px-2 text-[12px] font-medium", outcome.className)}>{outcome.label}</span>
              </div>
              {log.message && <p className="mt-2.5 whitespace-pre-wrap text-[14px] leading-6 text-foreground/85">{log.message}</p>}
            </div>
          ),
        });
        continue;
      }
      if (log.contact_type === "share") {
        const listings = parseShare(log.message);
        const what = listings.length === 1 ? `a ${listings[0].kind}` : `${listings.length} listings`;
        list.push({
          key: `log-${log.id}`,
          at,
          icon: <Share2 />,
          who,
          title: <><Who>{who}</Who> shared {what} {log.subject === "whatsapp" ? "on WhatsApp" : "by email"}</>,
          extra: listings.length ? (
            <div className={cn(CARD, "divide-y divide-border/60 overflow-hidden")}>
              {listings.map((l) => (
                <div key={`${l.kind}-${l.id}`} className="flex items-center gap-3 px-3.5 py-2.5">
                  <div className="min-w-0 flex-1">
                    <Link href={listingHref(l)} className="block truncate text-[14px] font-medium text-foreground hover:underline">{l.title}</Link>
                    <p className="truncate text-[12px] text-muted-foreground">{[l.code, l.subtitle, l.price].filter(Boolean).join(" · ")}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => shareApi.downloadPdf(leadId, l).then(onRefresh, () => toast.error("Couldn't prepare the PDF"))}
                    className="shrink-0 rounded-md px-2 py-1 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    PDF
                  </button>
                </div>
              ))}
            </div>
          ) : undefined,
        });
        continue;
      }
      const kind = log.contact_type === "sms" ? "an SMS" : log.contact_type === "email" ? "an email" : "a WhatsApp message";
      list.push({
        key: `log-${log.id}`,
        at,
        icon: log.contact_type === "sms" ? <Smartphone /> : log.contact_type === "email" ? <Mail /> : <MessageCircle />,
        who,
        title: <><Who>{who}</Who> sent {kind}</>,
        extra: (log.message || log.subject) ? (
          <div
            className={cn(
              "w-fit max-w-[90%] rounded-xl rounded-tl-sm px-3 py-2 text-[14px] leading-6 text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.06)]",
              log.contact_type === "whatsapp" ? "bg-emerald-50 dark:bg-emerald-950/40" : "bg-foreground/[0.05]",
            )}
          >
            {log.subject && <p className="font-medium">{log.subject}</p>}
            {log.message && <span className="whitespace-pre-wrap">{log.message}</span>}
            <span className="float-right ml-3 mt-1.5 text-[11px] leading-4 text-muted-foreground">{format(at, "h:mm a")}</span>
          </div>
        ) : undefined,
      });
    }

    for (const mail of mails) {
      if (mail.status === "draft") continue;
      const at = new Date(mail.sentAt ?? mail.confirmedAt ?? mail.createdAt);
      const status = MAIL_STATUS[mail.status];
      const problem = mail.lastError && ["failed", "pending", "suppressed"].includes(mail.status) ? mail.lastError : null;
      const sender = mail.from || mail.label;
      const open = expanded.has(mail.id);
      const long = (mail.body?.length ?? 0) > 420 || (mail.body?.split("\n").length ?? 0) > 8;
      const subject = /^re:/i.test(mail.subject) ? mail.subject : `Re: ${mail.subject}`;
      const replyButton = (all: boolean) => (
        <button
          type="button"
          aria-label={all ? "Reply all" : "Reply"}
          title={all ? "Reply all" : "Reply"}
          onClick={() => { setMailComposer({ kind: "blank", subject, cc: all ? mail.cc : undefined }); setMode("email"); }}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          {all ? <ReplyAll className="h-4 w-4" /> : <Reply className="h-4 w-4" />}
        </button>
      );
      list.push({
        key: `mail-${mail.id}`,
        at,
        icon: <Avatar name={sender.replace(/@.*/, "")} />,
        iconClass: "mt-2.5",
        extra: (
          <div className={cn(CARD, "px-3.5 py-3")}>
            <div className="flex items-center gap-2 text-[14px] leading-6">
              <p className="flex min-w-0 flex-1 items-center gap-2">
                <span className="truncate font-medium text-foreground">{sender}</span>
                {mail.from && <span className="hidden shrink-0 text-[13px] text-muted-foreground sm:inline">{mail.label}</span>}
                {mail.status !== "sent" && (
                  <span className={cn("shrink-0 rounded px-1.5 py-px text-[11px] font-medium", status.className)}>
                    {status.label}{mail.status === "pending" && mail.attempts > 0 ? ` · attempt ${mail.attempts + 1}` : ""}
                  </span>
                )}
              </p>
              <FeedTime at={at} className="shrink-0" />
              {canSendMail && email && <span className="-mr-1.5 flex shrink-0">{replyButton(false)}{mail.cc.length > 0 && replyButton(true)}</span>}
            </div>
            <div className="text-[14px] leading-6 text-foreground/90">
              <p>{mail.subject}</p>
              <p className="truncate">
                <span className="text-muted-foreground">To: </span>{mail.to.join(", ")}
                {mail.cc.length > 0 && <><span className="text-muted-foreground"> · Cc: </span>{mail.cc.join(", ")}</>}
              </p>
            </div>
            {mail.body && (
              <div className="mt-3 border-t pt-3">
                <p className={cn("whitespace-pre-wrap text-[14px] leading-6 text-foreground/90", long && !open && "line-clamp-6")}>{mail.body}</p>
                {long && (
                  <button
                    type="button"
                    onClick={() => setExpanded((prev) => { const next = new Set(prev); if (open) next.delete(mail.id); else next.add(mail.id); return next; })}
                    className="mt-1 text-[13px] font-medium text-muted-foreground hover:text-foreground"
                  >
                    {open ? "Show less" : "Show more"}
                  </button>
                )}
              </div>
            )}
            {problem && <p className="mt-3 border-t pt-2.5 text-[13px] text-red-600 dark:text-red-400">{problem}</p>}
            {mail.status === "failed" && canSendMail && (
              <Button variant="outline" size="sm" disabled={retrying === mail.id} onClick={() => retry(mail.id)} className="mt-2 h-7 gap-1.5 text-[12px]">
                {retrying === mail.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                Retry
              </Button>
            )}
            {mail.status === "pending" && mail.attempts === 0 && canSendMail && (
              <Button variant="outline" size="sm" disabled={retrying === mail.id} onClick={() => stopSending(mail.id)} className="mt-2 h-7 gap-1.5 text-[12px]">
                {retrying === mail.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
                Don&apos;t send
              </Button>
            )}
          </div>
        ),
      });
    }

    return sortOldestFirst(list);
    // retry/deleteFollowUp only read state through setters and props already listed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [followUps, contactLogs, mails, entity.api, isAdmin, canSendMail, retrying, expanded, leadName, email]);

  // Like a chat: open at the latest message, and follow new ones as they arrive.
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [items.length, drafts.length]);

  const openMode = (next: Mode) => {
    setMode((current) => (current === next ? null : next));
    if (next === "email" && !mailComposer) setMailComposer({ kind: "blank" });
  };

  const closeEmail = () => {
    setMailComposer(null);
    setMode(null);
  };

  const modes = MODES.filter((m) => m.key !== "email" || writable.length > 0);

  return (
    <div className="flex flex-col md:min-h-0 md:flex-1">
      <div className="md:min-h-0 md:flex-1 md:overflow-y-auto">
        <div className={cn("pb-4", canEdit && "max-md:pb-20")}>
          <TabHeader
            title="Conversation"
            action={canEdit && (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={<button type="button" className="inline-flex h-8 items-center gap-1.5 rounded-md bg-foreground px-3 text-[13px] font-medium text-background transition-colors hover:bg-foreground/85" />}
                >
                  <Plus className="h-4 w-4" />
                  New
                  <ChevronDown className="h-3.5 w-3.5 opacity-70" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  {modes.map(({ key, label, icon: Icon }) => (
                    <DropdownMenuItem key={key} onClick={() => { setMode(key); if (key === "email" && !mailComposer) setMailComposer({ kind: "blank" }); }}>
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      {label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          />
          {items.length ? (
            <Feed items={items} />
          ) : (
            <div className="flex flex-col items-center py-14 text-center">
              <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-foreground/[0.05] text-muted-foreground"><MessageCircle className="h-5 w-5" /></span>
              <p className="text-[14px] font-medium text-foreground">No conversation yet</p>
              <p className="mt-1 text-[13px] text-muted-foreground">Follow-ups, calls, messages and emails will show up here.</p>
            </div>
          )}

          {drafts.map((draft) => (
            <div key={draft.id} className="mx-3 mb-4 rounded-xl sm:ml-[86px] sm:mr-10 border border-amber-200 bg-amber-50/70 p-3.5 dark:border-amber-900/60 dark:bg-amber-950/20">
              <p className="text-[13px] font-semibold text-amber-900 dark:text-amber-300">Email ready to send: {draft.label}</p>
              <p className="mt-0.5 truncate text-[12px] text-amber-900/70 dark:text-amber-300/70">To {draft.to.join(", ")}</p>
              {canSendMail && (
                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => { setMailComposer({ kind: "draft", id: draft.id, eventKey: draft.event }); setMode("email"); }}
                    className="h-8 bg-background"
                  >
                    Edit
                  </Button>
                  <Button size="sm" onClick={() => setTarget({ kind: "draft", id: draft.id })} className="h-8 bg-foreground text-background hover:bg-foreground/85">
                    Preview &amp; send
                  </Button>
                </div>
              )}
            </div>
          ))}

          <div ref={end} aria-hidden className="scroll-mb-32 md:scroll-mb-0" />
        </div>
      </div>

      {/* Frappe-style bottom bar: pinned under the feed; the chosen composer opens above it. */}
      {canEdit && (
        <div className="z-40 shrink-0 border-t bg-background max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:pb-[calc(env(safe-area-inset-bottom)+80px)] max-md:shadow-[0_-8px_24px_-16px_rgba(0,0,0,0.25)]">
          {/* Panels stay mounted once opened, so switching keeps what was typed. */}
          <div hidden={mode !== "followup"} className="max-h-[60dvh] overflow-y-auto">{composer}</div>
          {mailComposer && (
            <div hidden={mode !== "email"}>
              {catalog?.redirectTo && (
                <p className="border-b bg-violet-50 px-4 py-1.5 text-[12px] text-violet-900 md:px-6 dark:bg-violet-950/40 dark:text-violet-200">
                  Test mode: emails go to {catalog.redirectTo}.
                </p>
              )}
              <MailComposer
                inline
                entityType={entity.mail}
                entityId={leadId}
                start={mailComposer}
                recipients={email ? [email] : []}
                senders={writable}
                onClose={closeEmail}
                onSent={() => {
                  // A share is recorded once its email has actually gone out.
                  const shared = mailComposer.kind === "blank" ? mailComposer.share : undefined;
                  closeEmail();
                  void loadMail();
                  if (shared?.length) {
                    shareApi.log(leadId, "email", shared).then(onRefresh, () => toast.error("The email was sent, but the share couldn't be recorded"));
                  }
                }}
              />
            </div>
          )}
          {mode === "whatsapp" && (
            <QuickMessage leadId={leadId} entity={entity} number={whatsapp || mobile} onSent={() => { setMode(null); onRefresh(); }} />
          )}

          <div role="tablist" aria-label="Compose" className={cn("flex h-12 items-center gap-1 overflow-x-auto px-3 scrollbar-hide md:gap-2 md:px-5", mode && "border-t")}>
            {modes.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={mode === key}
                onClick={() => openMode(key)}
                className={cn(
                  "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2 text-[14px] transition-colors sm:px-2.5",
                  mode === key ? "bg-foreground/[0.07] font-medium text-foreground" : "text-foreground/70 hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
            {mode && (
              <button
                type="button"
                aria-label="Close composer"
                onClick={() => setMode(null)}
                className="ml-auto hidden h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:flex"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      )}

      <MailPreviewDialog target={target} entityId={leadId} onClose={() => setTarget(null)} onDone={() => { setTarget(null); void loadMail(); }} />
      <EditFollowUpDialog leadId={leadId} entity={entity} followUp={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); onRefresh(); }} />
    </div>
  );
}

/**
 * WhatsApp from the dock. There is no messaging API yet, so the message opens
 * in WhatsApp and is logged on the lead.
 */
function QuickMessage({ leadId, entity, number, onSent }: {
  entity: ConversationEntity;
  leadId: number;
  number?: string | null;
  onSent: () => void;
}) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const to = dialable(number);
  const label = "WhatsApp";

  const send = async () => {
    if (!message.trim()) return;
    window.open(`https://wa.me/${to}?text=${encodeURIComponent(message)}`, "_blank", "noopener");
    setSending(true);
    try {
      const res = await apiFetch(`${API_URL}/${entity.api}/${leadId}/contact-log`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact_type: "whatsapp", message }),
      });
      if (!res.ok) throw new Error();
      toast.success(`${label} logged on the ${entity.noun}.`);
      setMessage("");
      onSent();
    } catch {
      toast.error(`Could not log the ${label} message`);
    } finally {
      setSending(false);
    }
  };

  if (!to) {
    return <p className="px-4 py-4 text-[13px] text-muted-foreground md:px-6">Add a WhatsApp or mobile number to this {entity.noun} to message them.</p>;
  }

  return (
    <div>
      <Textarea
        autoFocus
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void send(); }}
        placeholder={`${label} message to +${to}`}
        aria-label={`${label} message`}
        className="min-h-[76px] resize-none rounded-none border-0 bg-transparent px-4 pb-1 pt-3 text-[14px] shadow-none focus-visible:ring-0 md:px-6 dark:bg-transparent"
      />
      <div className="flex items-center gap-2 px-3 pb-2.5 md:px-5">
        <p className="min-w-0 flex-1 truncate text-[12px] text-muted-foreground max-sm:invisible">
          Opens WhatsApp with this message and logs it here.
        </p>
        <Button size="sm" onClick={send} disabled={sending || !message.trim()} className="h-8 gap-1.5 bg-foreground text-background hover:bg-foreground/85">
          {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          Send on WhatsApp
        </Button>
      </div>
    </div>
  );
}

function EditFollowUpDialog({ leadId, entity, followUp, onClose, onSaved }: {
  entity: ConversationEntity;
  leadId: number;
  followUp: FollowUp | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [notes, setNotes] = useState("");
  const [priority, setPriority] = useState("");
  const [next, setNext] = useState<Date | undefined>();
  const [saving, setSaving] = useState(false);
  const isInbound = entity.api === "inbounds";
  const [inboundFields, setInboundFields] = useState({
    followUpDate: "", followUpTime: "", nextFollowUpDate: "", nextFollowUpTime: "", contactedVia: "", rnr: "",
  });
  const setInboundField = (key: keyof typeof inboundFields, value: string) =>
    setInboundFields((fields) => ({ ...fields, [key]: value }));
  const [openedFor, setOpenedFor] = useState<number | null>(null);

  // Load the follow-up's values each time a different one is opened.
  if (followUp && openedFor !== followUp.id) {
    setOpenedFor(followUp.id);
    setNotes(followUp.notes ?? "");
    setPriority(followUp.priority ?? "");
    setNext(dateTime(followUp.next_follow_up_date, followUp.next_follow_up_time));
    setInboundFields({
      followUpDate: followUp.follow_up_date?.slice(0, 10) ?? "",
      followUpTime: followUp.follow_up_time ?? "",
      nextFollowUpDate: followUp.next_follow_up_date?.slice(0, 10) ?? "",
      nextFollowUpTime: followUp.next_follow_up_time ?? "",
      contactedVia: followUp.contacted_via ?? "",
      rnr: followUp.rnr ?? "",
    });
  }
  if (!followUp && openedFor !== null) setOpenedFor(null);

  const save = async () => {
    if (!followUp) return;
    setSaving(true);
    try {
      const res = await apiFetch(`${API_URL}/${entity.api}/${leadId}/follow-ups/${followUp.id}`, {
        method: entity.editMethod,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify((entity.followUpBody ?? ((b) => b))({
          followUpDate: followUp.follow_up_date ?? "",
          followUpTime: followUp.follow_up_time ?? "",
          contactedVia: followUp.contacted_via ?? "",
          rnr: followUp.rnr ?? "",
          notes,
          priority,
          nextFollowUpDate: next ? format(next, "yyyy-MM-dd") : "",
          nextFollowUpTime: next ? format(next, "HH:mm") : "",
          ...(isInbound ? inboundFields : {}),
        })),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error();
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
          <Textarea aria-label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes" className="min-h-[96px] resize-none" />
          {isInbound && (
            <div className="grid grid-cols-2 gap-2">
              {([
                ["followUpDate", "Contact date", "date"],
                ["followUpTime", "Contact time", "time"],
                ["nextFollowUpDate", "Next follow-up date", "date"],
                ["nextFollowUpTime", "Next follow-up time", "time"],
              ] as const).map(([key, label, type]) => (
                <label key={key} className="min-w-0 space-y-1 text-sm">
                  <span>{label}</span>
                  <Input type={type} value={inboundFields[key]} onChange={(e) => setInboundField(key, e.target.value)} className="h-9 w-full min-w-0" />
                </label>
              ))}
              <div className="space-y-1 text-sm">
                <label htmlFor="edit-contacted-via">Contacted via</label>
                <FormSelect id="edit-contacted-via" name="editContactedVia" placeholder="None" options={withCurrent(EDIT_CHANNELS, inboundFields.contactedVia)}
                  value={inboundFields.contactedVia || NO_SELECTION.value} onValueChange={(v) => setInboundField("contactedVia", followUpChoice(v))} className="h-9! w-full rounded-md! text-sm" />
              </div>
              <div className="space-y-1 text-sm">
                <label htmlFor="edit-rnr">RNR status</label>
                <FormSelect id="edit-rnr" name="editRnr" placeholder="None" options={withCurrent(EDIT_RNR, inboundFields.rnr)}
                  value={inboundFields.rnr || NO_SELECTION.value} onValueChange={(v) => setInboundField("rnr", followUpChoice(v))} className="h-9! w-full rounded-md! text-sm" />
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            {!isInbound && <DateTimePicker value={next} onChange={setNext} placeholder="Next follow-up" className="h-9! rounded-md! text-[13px]!" />}
            <div className="space-y-1 text-sm">
              {isInbound && <label htmlFor="edit-priority">Priority</label>}
              <FormSelect id="edit-priority" name="editPriority" placeholder="Priority" options={isInbound ? withCurrent([NO_SELECTION, ...PRIORITIES], priority) : PRIORITIES}
                value={isInbound ? priority || NO_SELECTION.value : priority} onValueChange={(v) => setPriority(followUpChoice(v))} className="h-9! w-full rounded-md! text-[13px]!" />
            </div>
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
