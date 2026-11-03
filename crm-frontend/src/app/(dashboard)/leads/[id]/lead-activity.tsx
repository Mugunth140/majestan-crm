"use client";

import type { ReactNode } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { Mail, MessageCircle, Phone, Smartphone, Sparkles, StickyNote } from "lucide-react";
import { CONTACT_TYPE_STYLES, contactLogAuthor, contactLogIcon, formatDuration } from "@/lib/contact-log-utils";
import { cn } from "@/lib/utils";

// One feed of everything that happened to a lead, newest first, in the style
// of Frappe CRM's Activity tab: an icon on a rail, a one-line sentence, then
// the note or message in a quiet box.

const VIA: Record<string, { label: string; icon: typeof Phone; tone: string }> = {
  call: { label: "call", icon: Phone, tone: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  whatsapp: { label: "WhatsApp", icon: MessageCircle, tone: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  sms: { label: "SMS", icon: Smartphone, tone: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400" },
  email: { label: "email", icon: Mail, tone: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400" },
};

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

type Item = {
  key: string;
  at: Date;
  icon: ReactNode;
  tone: string;
  title: ReactNode;
  body?: string | null;
  chips?: string[];
};

function followUpTime(fu: FollowUp): Date {
  if (fu.created_at) return new Date(fu.created_at);
  return new Date(`${fu.follow_up_date}T${fu.follow_up_time || "00:00"}`);
}

function nextFollowUp(fu: FollowUp): string | null {
  if (!fu.next_follow_up_date) return null;
  const at = new Date(`${String(fu.next_follow_up_date).slice(0, 10)}T${fu.next_follow_up_time || "00:00"}`);
  if (Number.isNaN(at.getTime())) return null;
  return `Next: ${format(at, fu.next_follow_up_time ? "d MMM, h:mm a" : "d MMM")}`;
}

export function buildActivity(
  lead: { created_at?: string; lead_source?: string | null } | null,
  followUps: FollowUp[],
  contactLogs: ContactLog[],
): Item[] {
  const items: Item[] = [];

  for (const fu of followUps) {
    const via = (fu.contacted_via && VIA[fu.contacted_via]) || null;
    const Icon = via?.icon ?? StickyNote;
    const chips = [
      fu.outcome,
      fu.priority && `${fu.priority[0].toUpperCase()}${fu.priority.slice(1)} priority`,
      fu.rnr && fu.rnr.toUpperCase().replace("RNR", "RNR "),
      nextFollowUp(fu),
    ].filter(Boolean) as string[];
    items.push({
      key: `fu-${fu.id}`,
      at: followUpTime(fu),
      icon: <Icon className="h-3.5 w-3.5" />,
      tone: via?.tone ?? "bg-muted text-muted-foreground",
      title: (
        <>
          <b className="font-semibold text-foreground">{fu.created_by?.name || "Staff"}</b> logged a{" "}
          {via ? `${via.label} ` : ""}follow-up
        </>
      ),
      body: fu.notes,
      chips,
    });
  }

  for (const log of contactLogs) {
    const isCall = log.contact_type === "call";
    items.push({
      key: `log-${log.id}`,
      at: new Date(log.created_at),
      icon: contactLogIcon(log),
      tone: CONTACT_TYPE_STYLES[log.contact_type] || "bg-muted text-muted-foreground",
      title: (
        <>
          <b className="font-semibold text-foreground">{contactLogAuthor(log)}</b>{" "}
          {isCall
            ? `· ${(log.call_direction || "voice").toLowerCase()} call, ${formatDuration(log.call_duration)}`
            : `sent ${log.contact_type === "email" ? "an email" : `a ${log.contact_type === "sms" ? "SMS" : "WhatsApp message"}`}`}
        </>
      ),
      body: [log.subject && `Subject: ${log.subject}`, log.message].filter(Boolean).join("\n") || null,
    });
  }

  if (lead?.created_at) {
    items.push({
      key: "created",
      at: new Date(lead.created_at),
      icon: <Sparkles className="h-3.5 w-3.5" />,
      tone: "bg-foreground/[0.07] text-foreground/70",
      title: (
        <>
          Lead created{lead.lead_source ? <> from <b className="font-semibold text-foreground">{lead.lead_source}</b></> : null}
        </>
      ),
    });
  }

  return items
    .filter((i) => !Number.isNaN(i.at.getTime()))
    .sort((a, b) => b.at.getTime() - a.at.getTime());
}

export function ActivityFeed({ items }: { items: Item[] }) {
  return (
    <ol className="relative">
      {items.map((item, idx) => (
        <li key={item.key} className="relative flex gap-3 pb-6 last:pb-0">
          {idx < items.length - 1 && <span aria-hidden className="absolute left-[13px] top-8 bottom-0 w-px bg-border" />}
          <span className={cn("relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full [&_svg]:h-3.5 [&_svg]:w-3.5", item.tone)}>
            {item.icon}
          </span>
          <div className="min-w-0 flex-1 pt-1">
            <div className="flex items-baseline gap-3">
              <p className="min-w-0 flex-1 text-[14px] leading-5 text-muted-foreground">{item.title}</p>
              <time
                dateTime={item.at.toISOString()}
                title={format(item.at, "d MMM yyyy, h:mm a")}
                className="shrink-0 text-[12px] text-muted-foreground/80"
              >
                {formatDistanceToNow(item.at, { addSuffix: true })}
              </time>
            </div>
            {item.body && (
              <p className="mt-2 whitespace-pre-wrap rounded-lg border bg-muted/30 px-3 py-2 text-[13.5px] leading-relaxed text-foreground/85">
                {item.body}
              </p>
            )}
            {item.chips && item.chips.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {item.chips.map((chip) => (
                  <span key={chip} className="rounded-md bg-foreground/[0.06] px-2 py-0.5 text-[12px] font-medium text-foreground/75">
                    {chip}
                  </span>
                ))}
              </div>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
