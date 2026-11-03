"use client";

import type { ReactNode } from "react";
import {
  ArrowRightLeft, CalendarCheck, ClipboardPlus, FilePlus2, FileX2, Inbox, PencilLine, ShieldAlert, Sparkles, TrendingUp, UserCheck, UserMinus, UserPlus,
} from "lucide-react";
import { LEAD_STATUS_DOTS } from "@/lib/lead-constants";
import { cn } from "@/lib/utils";
import { Feed, Who, sortNewestFirst, type FeedItem } from "./lead-feed";

/** One entry from GET /leads/:id/timeline. */
export type TimelineEntry = {
  id: string;
  kind: string;
  at: string;
  actor: { id: number; name: string } | null;
  field: string | null;
  from: string | null;
  to: string | null;
  meta: Record<string, unknown> | null;
};

const FIELD_LABELS: Record<string, string> = {
  name: "name", mobile_number: "mobile", whatsapp_number: "WhatsApp number", email: "email", city: "city",
  address: "address", lead_source: "source", commission: "commission", is_referral: "referral",
  referred_by_name: "referrer", referred_by_contact: "referrer's contact",
  purchase_type: "purchase type", property_category: "category", property_type: "property type", funder: "funding",
  project_list: "project", city_id: "city", sub_locations: "locations", purchase_timeline: "timeline",
  qualification_purpose: "purpose", decision_maker: "decision maker", preferences: "preferences",
};

const TONE = {
  neutral: "bg-foreground/[0.07] text-foreground/70",
  green: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  blue: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  red: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  violet: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
};

const pretty = (v: string | null) => {
  if (v === null || v === "") return null;
  if (v === "1" || v === "true") return "Yes";
  if (v === "0" || v === "false") return "No";
  return v.replace(/_/g, " ");
};

const Value = ({ children }: { children: ReactNode }) => <span className="font-medium text-foreground">{children}</span>;

function Status({ name }: { name: string | null }) {
  if (!name) return <Value>none</Value>;
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap font-medium text-foreground">
      <span className={cn("h-2 w-2 rounded-full", LEAD_STATUS_DOTS[name] ?? "bg-gray-400")} />
      {name}
    </span>
  );
}

/** "Asha changed city from Chennai to Coimbatore", "set …", or "cleared …". */
function change(actor: ReactNode, label: string, from: string | null, to: string | null) {
  const a = pretty(from);
  const b = pretty(to);
  if (a && b) return <>{actor} changed {label} from <Value>{a}</Value> to <Value>{b}</Value></>;
  if (b) return <>{actor} set {label} to <Value>{b}</Value></>;
  return <>{actor} cleared {label}{a ? <> (was <Value>{a}</Value>)</> : null}</>;
}

function toItem(e: TimelineEntry): FeedItem {
  const actor = <Who>{e.actor?.name ?? "System"}</Who>;
  const base = { key: e.id, at: new Date(e.at) };
  const meta = e.meta ?? {};

  switch (e.kind) {
    case "created":
      return {
        ...base, icon: <Sparkles />, tone: TONE.neutral,
        title: e.actor
          ? <>{actor} created this lead{meta.source ? <> from <Value>{String(meta.source)}</Value></> : null}</>
          : <>Lead created{meta.source ? <> from <Value>{String(meta.source)}</Value></> : null}</>,
      };
    case "status_changed":
      return {
        ...base, icon: <ArrowRightLeft />, tone: TONE.blue,
        title: <>{actor} changed status from <Status name={e.from} /> to <Status name={e.to} /></>,
        body: meta.reason ? `Reason: ${String(meta.reason)}` : null,
      };
    case "field_changed":
      return { ...base, icon: <PencilLine />, tone: TONE.neutral, title: change(actor, FIELD_LABELS[e.field ?? ""] ?? pretty(e.field) ?? "a field", e.from, e.to) };
    case "requirement_changed":
      return {
        ...base, icon: <PencilLine />, tone: TONE.violet,
        title: change(actor, `requirement ${FIELD_LABELS[e.field ?? ""] ?? pretty(e.field) ?? "details"}`, e.field === "preferences" ? null : e.from, e.field === "preferences" ? "updated" : e.to),
      };
    case "requirement_added":
      return { ...base, icon: <ClipboardPlus />, tone: TONE.violet, title: <>{actor} added a requirement</> };
    case "qualification_changed":
      return {
        ...base, icon: <ShieldAlert />, tone: e.to === "Unqualified" ? TONE.red : TONE.green,
        title: <>{actor} marked the lead <Value>{e.to}</Value></>,
      };
    case "visit_scheduled":
      return {
        ...base, icon: <CalendarCheck />, tone: TONE.amber,
        title: <>{actor} scheduled a site visit{e.to ? <> for <Value>{e.to}</Value></> : null}</>,
        chips: [meta.project, meta.location && `at ${meta.location}`].filter(Boolean).map(String),
      };
    case "document_added":
      return { ...base, icon: <FilePlus2 />, tone: TONE.neutral, title: <>{actor} attached <Value>{e.to}</Value></> };
    case "document_removed":
      return { ...base, icon: <FileX2 />, tone: TONE.neutral, title: <>{actor} removed <Value>{e.from}</Value></> };
    case "routing":
      return routingItem(e, actor, base);
    default:
      return { ...base, icon: <PencilLine />, tone: TONE.neutral, title: <>{actor} updated the lead</> };
  }
}

/** Assignment history (routing_histories). `field` holds the event type. */
function routingItem(e: TimelineEntry, actor: ReactNode, base: Pick<FeedItem, "key" | "at">): FeedItem {
  const feedback = e.meta?.feedback ? String(e.meta.feedback) : null;
  const to = e.to ? <Value>{e.to}</Value> : null;
  const from = e.from ? <Value>{e.from}</Value> : null;
  switch (e.field) {
    case "Assigned":
      return {
        ...base, icon: <UserPlus />, tone: TONE.green, body: feedback,
        title: from && e.from !== e.to ? <>{actor} reassigned the lead from {from} to {to}</> : <>{actor} assigned the lead to {to}</>,
      };
    case "Claimed":
      return { ...base, icon: <UserCheck />, tone: TONE.green, title: <>{to ?? actor} picked up the lead</> };
    case "Auto-transferred":
      return { ...base, icon: <TrendingUp />, tone: TONE.amber, title: <>Moved to the <Value>Sales</Value> pipeline</>, body: feedback };
    case "Auto-unassigned":
      return { ...base, icon: <UserMinus />, tone: TONE.red, title: <>Unassigned from {from ?? "its owner"} automatically</>, body: feedback };
    case "Returned to Queue":
      return { ...base, icon: <UserMinus />, tone: TONE.red, title: <>{actor} returned the lead to the queue</>, body: feedback };
    case "Converted":
      return { ...base, icon: <TrendingUp />, tone: TONE.green, title: <>{actor} converted the lead</>, body: feedback };
    case "Queued":
      return { ...base, icon: <Inbox />, tone: TONE.neutral, title: <>Lead queued for assignment</> };
    case "Enquiry Attached":
      return { ...base, icon: <Inbox />, tone: TONE.blue, title: <>A new website enquiry was added to this lead</>, body: feedback };
    case "Enquiry Acknowledged":
      return { ...base, icon: <Inbox />, tone: TONE.neutral, title: <>{actor} saw the website enquiry</> };
    default:
      return { ...base, icon: <ArrowRightLeft />, tone: TONE.neutral, title: <>{e.field ?? "Routing"}{to ? <> · {to}</> : null}</>, body: feedback };
  }
}

export function timelineItems(entries: TimelineEntry[]): FeedItem[] {
  return sortNewestFirst(entries.map(toItem));
}

export { Feed };
