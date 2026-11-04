"use client";

import {
  ArrowRightLeft, ImagePlus, Layers, PencilLine, Sparkles, UserMinus, UserPlus,
} from "lucide-react";
import { formatIndianCurrencyShort } from "@/lib/indian-currency";
import { INBOUND_STATUS_TONES } from "@/lib/inbound-form";
import { statusDot } from "@/components/tables/cells";
import { Value, Who, change, pretty, sortNewestFirst, type FeedItem } from "@/components/record/feed";
import { cn } from "@/lib/utils";

/** One entry from GET /inbounds/:id/activity (the lead timeline's shape). */
export type ActivityEntry = {
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
  property_title: "title", property_category: "category", property_type: "type", purpose: "purpose", bhk: "BHK",
  special_purpose: "suitable uses", inbound_status: "availability", total_rent: "monthly rent", rent_per_sqft: "rent per sq ft",
  sale_price: "sale price", advance: "advance", floor_number: "floor", state: "state", city: "city", area: "area",
  locality: "locality", landmark: "landmark", latitude: "latitude", longitude: "longitude", google_map_location: "map link",
  owner_name: "owner name", mobile_number: "mobile", whatsapp_number: "WhatsApp number", email: "email", address: "address",
  preferred_contact_time: "best time to call", alternate_contact: "alternate number", alternative_contact: "other contact",
  pan_available: "PAN", gst_applicable: "GST", primary_contact: "who handles visits", primary_contact_name: "visit contact",
  primary_contact_number: "visit contact's number", key_available_with: "who has the keys", key_contact_name: "key holder",
  key_contact_number: "key holder's number", prior_appointment_required: "appointment needed",
  brokerage_accepted: "brokerage", brokerage_type: "brokerage type", percentage: "brokerage percentage",
  fixed_amount: "brokerage amount", brokerage_days: "brokerage days", brokerage_paid_by: "brokerage paid by",
  brokerage_remarks: "brokerage remarks", is_exclusive: "exclusive", is_prime_location: "prime location",
  documents_collected: "documents collected",
};
const MONEY = new Set(["total_rent", "sale_price", "fixed_amount"]);

const money = (v: string | null) => (v && !isNaN(Number(v)) ? formatIndianCurrencyShort(Number(v)) : v);
/** brokerage_paid_by is stored as a JSON list. */
const list = (v: string | null) => {
  if (!v?.startsWith("[")) return v;
  try { return (JSON.parse(v) as string[]).join(", ") || null; } catch { return v; }
};

function Status({ name }: { name: string | null }) {
  if (!name) return <Value>none</Value>;
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap font-medium text-foreground">
      <span className={cn("h-2 w-2 rounded-full", statusDot(name, INBOUND_STATUS_TONES[name]))} />
      {name}
    </span>
  );
}

function toItem(e: ActivityEntry): FeedItem {
  const actor = <Who>{e.actor?.name ?? "System"}</Who>;
  const base = { key: e.id, at: new Date(e.at) };
  const label = FIELD_LABELS[e.field ?? ""] ?? pretty(e.field) ?? "a field";

  switch (e.kind) {
    case "created":
      return {
        ...base, icon: <Sparkles />,
        title: e.actor
          ? <>{actor} added this inbound{e.meta?.quick ? " from the field" : null}</>
          : <>Inbound added</>,
      };
    case "status_changed":
      return { ...base, icon: <ArrowRightLeft />, title: <>{actor} changed status from <Status name={e.from} /> to <Status name={e.to} /></> };
    case "field_changed":
      if (e.meta?.hidden) return { ...base, icon: <PencilLine />, title: <>{actor} updated the {label}</> };
      if (MONEY.has(e.field ?? "")) return { ...base, icon: <PencilLine />, title: change(actor, label, money(e.from), money(e.to)) };
      return { ...base, icon: <PencilLine />, title: change(actor, label, list(e.from), list(e.to)) };
    case "floors_changed":
      return {
        ...base, icon: <Layers />,
        title: e.to ? <>{actor} updated the floors: <Value>{e.to}</Value></> : <>{actor} removed the floor-wise pricing</>,
      };
    case "assigned":
      return {
        ...base, icon: <UserPlus />,
        title: e.from ? <>{actor} reassigned the inbound from <Value>{e.from}</Value> to <Value>{e.to}</Value></> : <>{actor} assigned the inbound to <Value>{e.to}</Value></>,
      };
    case "unassigned":
      return { ...base, icon: <UserMinus />, title: <>{actor} returned the inbound to the queue{e.from ? <> (was <Value>{e.from}</Value>)</> : null}</> };
    case "photo_added":
      return { ...base, icon: <ImagePlus />, title: <>{actor} added a photo</> };
    case "photo_replaced":
      return { ...base, icon: <ImagePlus />, title: <>{actor} replaced the photo</> };
    default:
      return { ...base, icon: <PencilLine />, title: <>{actor} updated the inbound</> };
  }
}

export function activityItems(entries: ActivityEntry[]): FeedItem[] {
  return sortNewestFirst(entries.map(toItem));
}
