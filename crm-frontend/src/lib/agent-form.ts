// What an agent (a channel partner who brings us buyers or listings) is made
// of: option lists, statuses, what each create step needs, and the payload the
// API takes. Shared by the create form, the agent page and the list.

import type { StatusTone } from "@/components/tables/cells";

type Opt = { label: string; value: string };

export const PARTNER_TYPES: Opt[] = [
  { label: "Individual broker", value: "individual_broker" },
  { label: "Real estate company", value: "real_estate_company" },
  { label: "Referral partner", value: "referral_partner" },
  { label: "Builder", value: "builder" },
];
export const AGENT_CATEGORIES: Opt[] = [
  { label: "Residential", value: "residential" },
  { label: "Commercial", value: "commercial" },
  { label: "Industrial", value: "industrial" },
  { label: "Agricultural", value: "agricultural" },
];
export const COMMISSION_TYPES: Opt[] = [
  { label: "Percentage", value: "percentage" },
  { label: "Fixed amount", value: "fixed_amount" },
];

/** The partnership's progress, as the agent table colours it. */
export const AGENT_STATUS_TONES: Record<string, StatusTone> = {
  "New": "gray",
  "Contacted": "blue",
  "Meeting Done": "violet",
  "Documents Pending": "amber",
  "Approved": "green",
  "Active": "green",
  "Hold": "amber",
  "Rejected": "red",
};
export const AGENT_STATUSES = Object.keys(AGENT_STATUS_TONES);

export const partnerTypeLabel = (v?: string | null) => PARTNER_TYPES.find((p) => p.value === v)?.label ?? (v ? v.replace(/_/g, " ") : "");

/** "2" + percentage → "2%", "50000" + fixed_amount → "₹50,000"; anything else as typed. */
/** "fixed_amount" or "percentage", also from older records that stored "Fixed Amount" / "Percentage". */
export const commissionKind = (type?: string | null) => String(type ?? "").trim().toLowerCase().replace(/\s+/g, "_");

export function commissionText(type?: string | null, value?: string | null) {
  const kind = commissionKind(type);
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const n = Number(raw.replace(/[,%₹\s]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return raw;
  if (kind === "percentage") return `${n}%`;
  if (kind === "fixed_amount") return `₹${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n)}`;
  return raw;
}

export const EMPTY_AGENT = {
  name: "", company_name: "", partner_type: "", property_category: "",
  mobile: "", whatsapp: "", email: "", city: "", state: "Tamil Nadu",
  commission_accepted: false, commission_type: "", commission_value: "", remarks: "",
  contactedVia: "", next: "" /* ISO date-time of the next follow-up */, priority: "", notes: "",
};
export type AgentForm = typeof EMPTY_AGENT;

export const AGENT_STEPS = [
  { key: "partner", label: "Partner" },
  { key: "contact", label: "Contact" },
  { key: "commission", label: "Commission" },
  { key: "follow_up", label: "First follow-up" },
] as const;
export type AgentStep = (typeof AGENT_STEPS)[number]["key"];

const MOBILE = /^\+?(?:[ ()-]*\d){10,15}[ ()-]*$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** What's missing on a step; an empty object means it's done. */
export function checkAgent(step: AgentStep, f: AgentForm): Record<string, string> {
  const e: Record<string, string> = {};
  if (step === "partner") {
    if (!f.name.trim()) e.name = "Enter the partner's name.";
    if (!f.partner_type) e.partner_type = "Pick a partner type.";
  }
  if (step === "contact") {
    if (!MOBILE.test(f.mobile.trim())) e.mobile = "Enter a mobile number with 10 to 15 digits.";
    if (f.whatsapp.trim() && !MOBILE.test(f.whatsapp.trim())) e.whatsapp = "Enter a WhatsApp number with 10 to 15 digits.";
    if (f.email.trim() && !EMAIL.test(f.email.trim())) e.email = "Enter a valid email address.";
    if (!f.city) e.city = "Pick a city.";
  }
  if (step === "commission" && f.commission_accepted) {
    if (!f.commission_type) e.commission_type = "Pick how the commission is paid.";
    if (!f.commission_value.trim()) e.commission_value = "Enter the commission.";
  }
  if (step === "follow_up" && (f.next || f.priority || f.notes.trim()) && !f.contactedVia) {
    e.contactedVia = "Pick how you spoke to them, or clear the follow-up.";
  }
  return e;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** The body for POST /agents. The follow-up is sent only when something was filled in. */
export function agentPayload(f: AgentForm, now = new Date()) {
  const blank = (v: string) => v.trim() || null;
  const next = f.next ? new Date(f.next) : null;
  const followUp = f.contactedVia
    ? {
        contactedVia: f.contactedVia,
        followUpDate: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
        followUpTime: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
        nextFollowUpDate: next ? `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}` : null,
        nextFollowUpTime: next ? `${pad(next.getHours())}:${pad(next.getMinutes())}` : null,
        priority: f.priority || null,
        notes: blank(f.notes),
      }
    : {};
  return {
    name: f.name.trim(),
    company_name: blank(f.company_name),
    partner_type: f.partner_type || null,
    property_category: f.property_category || null,
    mobile: f.mobile.trim(),
    whatsapp: blank(f.whatsapp),
    email: blank(f.email),
    city: f.city || null,
    state: f.state || null,
    commission_accepted: f.commission_accepted,
    commission_type: f.commission_accepted ? f.commission_type || null : null,
    commission_value: f.commission_accepted ? blank(f.commission_value) : null,
    remarks: blank(f.remarks),
    ...followUp,
  };
}
