"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRightLeft, CalendarCheck, ClipboardPlus, ClipboardX, FileDown, FilePlus2, FileX2, Inbox, PencilLine, Share2, ShieldAlert, Sparkles, TrendingUp, UserCheck, UserMinus, UserPlus,
} from "lucide-react";
import { listingHref, type SharedListing } from "@/lib/listing-share";
import { LEAD_STATUS_DOTS } from "@/lib/lead-constants";
import { cn } from "@/lib/utils";
import { CARD, Chip, Feed, Value, Who, change, pretty, sortNewestFirst, type FeedItem } from "@/components/record/feed";

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


function Status({ name }: { name: string | null }) {
  if (!name) return <Value>none</Value>;
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap font-medium text-foreground">
      <span className={cn("h-2 w-2 rounded-full", LEAD_STATUS_DOTS[name] ?? "bg-gray-400")} />
      {name}
    </span>
  );
}

function toItem(e: TimelineEntry): FeedItem {
  const actor = <Who>{e.actor?.name ?? "System"}</Who>;
  const base = { key: e.id, at: new Date(e.at) };
  const meta = e.meta ?? {};

  switch (e.kind) {
    case "created":
      return {
        ...base, icon: <Sparkles />,
        title: e.actor
          ? <>{actor} created this lead{meta.source ? <> from <Value>{String(meta.source)}</Value></> : null}</>
          : <>Lead created{meta.source ? <> from <Value>{String(meta.source)}</Value></> : null}</>,
      };
    case "status_changed":
      return {
        ...base, icon: <ArrowRightLeft />,
        title: <>{actor} changed status from <Status name={e.from} /> to <Status name={e.to} /></>,
        body: meta.reason ? `Reason: ${String(meta.reason)}` : null,
      };
    case "field_changed":
      return { ...base, icon: <PencilLine />, title: change(actor, FIELD_LABELS[e.field ?? ""] ?? pretty(e.field) ?? "a field", e.from, e.to) };
    case "requirement_changed":
      return {
        ...base, icon: <PencilLine />,
        title: change(actor, `requirement ${FIELD_LABELS[e.field ?? ""] ?? pretty(e.field) ?? "details"}`, e.field === "preferences" ? null : e.from, e.field === "preferences" ? "updated" : e.to),
      };
    case "requirement_added":
      return { ...base, icon: <ClipboardPlus />, title: <>{actor} added a requirement</> };
    case "requirement_removed":
      return { ...base, icon: <ClipboardX />, title: <>{actor} deleted a requirement{e.from ? <> (<Value>{e.from}</Value>)</> : null}</> };
    case "qualification_changed":
      return {
        ...base, icon: <ShieldAlert />, iconClass: e.to === "Unqualified" ? "text-red-600 dark:text-red-400" : undefined,
        title: <>{actor} marked the lead <Value>{e.to}</Value></>,
      };
    case "visit_scheduled":
      return {
        ...base, icon: <CalendarCheck />,
        title: <>{actor} scheduled a site visit{e.to ? <> for <Value>{e.to}</Value></> : null}</>,
        chips: [meta.project, meta.location && `at ${meta.location}`].filter(Boolean).map((c) => <Chip key={String(c)}>{String(c)}</Chip>),
      };
    case "document_added":
      return { ...base, icon: <FilePlus2 />, title: <>{actor} attached <Value>{e.to}</Value></> };
    case "document_removed":
      return { ...base, icon: <FileX2 />, title: <>{actor} removed <Value>{e.from}</Value></> };
    case "routing":
      return routingItem(e, actor, base);
    case "listing_downloaded": {
      const l = listingOf(meta);
      return {
        ...base, icon: <FileDown />,
        title: <>{actor} downloaded the PDF of <Value>{l?.title ?? e.to ?? `a ${e.field ?? "listing"}`}</Value></>,
        extra: l ? <Listings items={[l]} /> : undefined,
      };
    }
    case "listings_shared": {
      const listings = sharedListings(e);
      const what = listings.length === 1 ? <Value>{listings[0].title}</Value> : `${listings.length || "some"} listings`;
      return {
        ...base, icon: <Share2 />,
        title: <>{actor} shared {what} {e.field === "whatsapp" ? "on WhatsApp" : "by email"}</>,
        extra: listings.length ? <Listings items={listings} /> : undefined,
      };
    }
    default:
      return { ...base, icon: <PencilLine />, title: <>{actor} updated the lead</> };
  }
}

const listingOf = (m: Record<string, unknown>): SharedListing | null =>
  (m.kind === "property" || m.kind === "project") && m.id ? (m as unknown as SharedListing) : null;

/** The listings a share sent, as they were at the time. */
export const sharedListings = (e: TimelineEntry): SharedListing[] =>
  Array.isArray(e.meta?.listings) ? (e.meta.listings as Record<string, unknown>[]).map(listingOf).filter((l): l is SharedListing => !!l) : [];

/** Entries about sharing listings: what the Shared filter keeps. */
export const isShareEntry = (e: TimelineEntry) => e.kind === "listings_shared" || e.kind === "listing_downloaded";

/** How many different properties and projects this lead has been sent. */
export function sharedCount(entries: TimelineEntry[]) {
  const seen = new Set<string>();
  for (const e of entries) if (e.kind === "listings_shared") for (const l of sharedListings(e)) seen.add(`${l.kind}-${l.id}`);
  return seen.size;
}

function Listings({ items }: { items: SharedListing[] }) {
  return (
    <div className={cn(CARD, "divide-y divide-border/60 overflow-hidden")}>
      {items.map((l) => (
        <div key={`${l.kind}-${l.id}`} className="min-w-0 px-3.5 py-2.5">
          <Link href={listingHref(l)} className="block truncate text-[14px] font-medium text-foreground hover:underline">{l.title}</Link>
          <p className="truncate text-[12px] text-muted-foreground">{[l.code, l.subtitle, l.price].filter(Boolean).join(" · ")}</p>
        </div>
      ))}
    </div>
  );
}

/** Assignment history (routing_histories). `field` holds the event type. */
function routingItem(e: TimelineEntry, actor: ReactNode, base: Pick<FeedItem, "key" | "at">): FeedItem {
  const feedback = e.meta?.feedback ? String(e.meta.feedback) : null;
  const to = e.to ? <Value>{e.to}</Value> : null;
  const from = e.from ? <Value>{e.from}</Value> : null;
  switch (e.field) {
    case "Assigned":
      return {
        ...base, icon: <UserPlus />, body: feedback,
        title: from && e.from !== e.to ? <>{actor} reassigned the lead from {from} to {to}</> : <>{actor} assigned the lead to {to}</>,
      };
    case "Claimed":
      return { ...base, icon: <UserCheck />, title: <>{to ?? actor} picked up the lead</> };
    case "Auto-transferred":
      return { ...base, icon: <TrendingUp />, title: <>Moved to the <Value>Sales</Value> pipeline</>, body: feedback };
    case "Auto-unassigned":
      return { ...base, icon: <UserMinus />, title: <>Unassigned from {from ?? "its owner"} automatically</>, body: feedback };
    case "Returned to Queue":
      return { ...base, icon: <UserMinus />, title: <>{actor} returned the lead to the queue</>, body: feedback };
    case "Converted":
      return { ...base, icon: <TrendingUp />, title: <>{actor} converted the lead</>, body: feedback };
    case "Queued":
      return { ...base, icon: <Inbox />, title: <>Lead queued for assignment</> };
    case "Enquiry Attached":
      return { ...base, icon: <Inbox />, title: <>A new website enquiry was added to this lead</>, body: feedback };
    case "Enquiry Acknowledged":
      return { ...base, icon: <Inbox />, title: <>{actor} saw the website enquiry</> };
    default:
      return { ...base, icon: <ArrowRightLeft />, title: <>{e.field ?? "Routing"}{to ? <> · {to}</> : null}</>, body: feedback };
  }
}

export function timelineItems(entries: TimelineEntry[]): FeedItem[] {
  // The actor's photo (or initials) leads each entry they made.
  return sortNewestFirst(entries.map((e) => ({ ...toItem(e), ...(e.actor && { who: e.actor.name, whoId: e.actor.id }) })));
}

export { Feed };
