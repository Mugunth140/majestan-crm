"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { CalendarClock, Mail, MessageCircle, Phone, PhoneIncoming, PhoneMissed, PhoneOutgoing, Smartphone, StickyNote } from "lucide-react";
import { Chip, Who, type FeedItem } from "@/components/record/feed";
import { activityItems, type ActivityEntry, type ActivityWords } from "@/components/record/activity";
import { AGENT_ACTIVITY } from "@/components/agents/agent-activity";
import { HR_ACTIVITY } from "@/components/hr/hr-activity";
import { INBOUND_ACTIVITY } from "@/components/inbound/inbound-activity";
import { timelineItems } from "@/app/(dashboard)/leads/[id]/lead-timeline";
import { formatDuration } from "@/lib/contact-log-utils";

// The Activity Logs page: one staff member's history across every module,
// worded the way each record's own Activity and Conversation tabs word it,
// with a link to the record it happened on.

export type StaffActivitySource = "lead" | "inbound" | "agent" | "hr" | "asset";

/** One entry from GET /staff-activity. */
export type StaffActivityEntry = ActivityEntry & {
  group: "activity" | "conversation";
  source: StaffActivitySource;
  record: { id: number; name: string | null };
};

const RECORDS: Record<StaffActivitySource, { noun: string; href: (id: number) => string }> = {
  lead: { noun: "Lead", href: (id) => `/leads/${id}` },
  inbound: { noun: "Inbound", href: (id) => `/inbound/${id}` },
  agent: { noun: "Agent", href: (id) => `/agent-network/${id}` },
  hr: { noun: "Candidate", href: (id) => `/hr/${id}` },
  asset: { noun: "Asset", href: (id) => `/asset-inventory/${id}` },
};

const WORDS: Partial<Record<StaffActivitySource, ActivityWords>> = { inbound: INBOUND_ACTIVITY, agent: AGENT_ACTIVITY, hr: HR_ACTIVITY };

const VIA: Record<string, { label: string; icon: ReactNode }> = {
  call: { label: "a call", icon: <Phone /> },
  whatsapp: { label: "a WhatsApp", icon: <MessageCircle /> },
  sms: { label: "an SMS", icon: <Smartphone /> },
  email: { label: "an email", icon: <Mail /> },
};

/** "Lead · Pam Beesly", linking to the record. */
function RecordLink({ e }: { e: StaffActivityEntry }) {
  const r = RECORDS[e.source];
  return (
    <Link href={r.href(e.record.id)} className="inline-flex min-w-0 items-center gap-1 rounded-[5px] bg-foreground/[0.06] px-1.5 text-[12px] font-medium leading-5 text-foreground/80 transition-colors hover:bg-foreground/[0.1] hover:text-foreground">
      <span className="text-muted-foreground">{r.noun}</span>
      <span className="max-w-[220px] truncate">{e.record.name || `#${e.record.id}`}</span>
    </Link>
  );
}

const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

function conversationItem(e: StaffActivityEntry, who: string): FeedItem {
  const base = { key: e.id, at: new Date(e.at) };
  const meta = e.meta ?? {};
  const actor = <Who>{who}</Who>;
  if (e.kind === "follow_up") {
    const via = VIA[String(meta.via ?? "")];
    const next = text(meta.next);
    return {
      ...base, icon: via?.icon ?? <StickyNote />,
      title: <>{actor} logged {via ? `${via.label} follow-up` : "a follow-up"}</>,
      body: text(meta.notes),
      chips: [
        next && <Chip key="next"><CalendarClock />Next {next}</Chip>,
        text(meta.outcome) && <Chip key="outcome">{String(meta.outcome)}</Chip>,
        text(meta.rnr) && <Chip key="rnr">{String(meta.rnr).toUpperCase()}</Chip>,
      ].filter(Boolean) as ReactNode[],
    };
  }
  // A call or a message.
  if (e.field === "call") {
    const direction = String(meta.direction ?? "").toLowerCase();
    const incoming = direction === "incoming" || direction === "missed" || direction === "rejected";
    const answered = Number(meta.duration ?? 0) > 0;
    return {
      ...base,
      icon: !answered ? <PhoneMissed /> : incoming ? <PhoneIncoming /> : <PhoneOutgoing />,
      iconClass: !answered ? "text-red-600 dark:text-red-400" : undefined,
      title: <>{actor} {incoming ? (answered ? "received a call" : "missed a call") : "made a call"}</>,
      chips: answered ? [<Chip key="d">{formatDuration(meta.duration)}</Chip>] : [],
    };
  }
  const kind = e.field === "sms" ? "an SMS" : e.field === "email" ? "an email" : "a WhatsApp message";
  return {
    ...base, icon: e.field === "sms" ? <Smartphone /> : e.field === "email" ? <Mail /> : <MessageCircle />,
    title: <>{actor} sent {kind}</>,
    body: [text(meta.subject), text(meta.message)].filter(Boolean).join("\n") || null,
  };
}

function toItem(entry: StaffActivityEntry, person: { id: number; name: string }): FeedItem | null {
  const e = { ...entry, actor: person };
  const who = person.name;
  let item: FeedItem | undefined;
  if (e.group === "conversation") item = conversationItem(e, who);
  else if (e.source === "lead") item = timelineItems([e])[0];
  else if (WORDS[e.source]) item = activityItems([e], WORDS[e.source]!)[0];
  if (!item) return null;
  // Every entry is the same person's, so the record leads instead of their photo.
  return { ...item, who: undefined, whoId: undefined, title: <>{item.title} <RecordLink e={e} /></> };
}

/** Feed entries for one person's history, in the order given (newest first). */
export function staffActivityItems(entries: StaffActivityEntry[], person: { id: number; name: string }): FeedItem[] {
  return entries.map((e) => toItem(e, person)).filter((i): i is FeedItem => !!i);
}
