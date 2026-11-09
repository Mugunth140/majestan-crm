"use client";

import { Layers, Sparkles, UserMinus } from "lucide-react";
import { INBOUND_STATUS_TONES } from "@/lib/inbound-form";
import { statusDot } from "@/components/tables/cells";
import { Value } from "@/components/record/feed";
import type { ActivityWords } from "@/components/record/activity";

/** How the inbound Activity tab words its history. */
export const INBOUND_ACTIVITY: ActivityWords = {
  noun: "inbound",
  labels: {
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
  },
  money: new Set(["total_rent", "sale_price", "fixed_amount"]),
  statusDot: (s) => statusDot(s, INBOUND_STATUS_TONES[s]),
  extra: (e, actor, base) => {
    if (e.kind === "created" && e.actor && e.meta?.quick) return { ...base, icon: <Sparkles />, title: <>{actor} added this inbound from the field</> };
    if (e.kind === "unassigned") return { ...base, icon: <UserMinus />, title: <>{actor} returned the inbound to the queue{e.from ? <> (was <Value>{e.from}</Value>)</> : null}</> };
    if (e.kind === "floors_changed") {
      return { ...base, icon: <Layers />, title: e.to ? <>{actor} updated the floors: <Value>{e.to}</Value></> : <>{actor} removed the floor-wise pricing</> };
    }
    return null;
  },
};
