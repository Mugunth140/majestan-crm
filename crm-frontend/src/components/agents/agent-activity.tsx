"use client";

import { AGENT_CATEGORIES, AGENT_STATUS_TONES, COMMISSION_TYPES, PARTNER_TYPES } from "@/lib/agent-form";
import { statusDot } from "@/components/tables/cells";
import type { ActivityWords } from "@/components/record/activity";

const OPTION_LISTS: Record<string, { label: string; value: string }[]> = {
  partner_type: PARTNER_TYPES, property_category: AGENT_CATEGORIES, commission_type: COMMISSION_TYPES,
};

/** How the agent Activity tab words its history. */
export const AGENT_ACTIVITY: ActivityWords = {
  noun: "agent",
  labels: {
    name: "name", company_name: "company", mobile_number: "mobile", whatsapp_number: "WhatsApp number", email: "email",
    city: "city", state: "state", partner_type: "partner type", property_category: "property category",
    commission_accepted: "commission accepted", commission_type: "commission type", commission_value: "commission", remarks: "remarks",
  },
  format: (field, value) => OPTION_LISTS[field]?.find((o) => o.value === value)?.label ?? value,
  statusDot: (s) => statusDot(s, AGENT_STATUS_TONES[s]),
};
