// What an inbound (an owner's property offered to us) is made of: the option
// lists, which fields apply to which property, what a step needs before it's
// done, and the payload the API takes. Shared by the create form and the
// inbound page so both agree.

import { parseIndianCurrency } from "@/lib/indian-currency";
import type { StatusTone } from "@/components/tables/cells";

type Opt = { label: string; value: string };
const opts = (...values: string[]): Opt[] => values.map((v) => ({ label: v, value: v }));

export const INBOUND_CATEGORIES: Opt[] = [
  { label: "Residential", value: "residential" },
  { label: "Commercial", value: "commercial" },
  { label: "Industrial", value: "industrial" },
  { label: "Agricultural", value: "agricultural" },
  { label: "Institutional", value: "institutional" },
];

export const INBOUND_TYPES: Record<string, Opt[]> = {
  residential: [
    { label: "Apartment", value: "apartment" }, { label: "Villa", value: "villa" },
    { label: "Independent House", value: "independent_house" }, { label: "Plot", value: "plot" },
    { label: "Farm House", value: "farm_house" }, { label: "Builder Floor", value: "builder_floor" },
  ],
  commercial: [
    { label: "Office", value: "office" }, { label: "Shop", value: "shop" }, { label: "Showroom", value: "showroom" },
    { label: "Commercial Building", value: "commercial_building" }, { label: "Warehouse", value: "warehouse" },
    { label: "Hotel", value: "hotel" }, { label: "Restaurant", value: "restaurant" }, { label: "Commercial Land", value: "commercial_land" },
  ],
  industrial: [
    { label: "Factory", value: "factory" }, { label: "Industrial Shed", value: "industrial_shed" },
    { label: "Industrial Land", value: "industrial_land" }, { label: "Warehouse", value: "warehouse" },
    { label: "Manufacturing Unit", value: "manufacturing_unit" },
  ],
  agricultural: [
    { label: "Agricultural Land", value: "agricultural_land" }, { label: "Farm Land", value: "farm_land" },
    { label: "Coconut Farm", value: "coconut_farm" }, { label: "Plantation", value: "plantation" }, { label: "Orchard", value: "orchard" },
  ],
  institutional: [
    { label: "School", value: "school" }, { label: "College", value: "college" }, { label: "Hospital", value: "hospital" },
    { label: "Clinic", value: "clinic" }, { label: "Training Centre", value: "training_centre" },
  ],
};

export const INBOUND_PURPOSES = opts("Sale", "Rent", "Lease");
export const SPECIAL_PURPOSES = ["Salon", "Spa", "Restaurant", "Gym"];
export const PRIMARY_CONTACTS = opts("Owner", "Building Manager", "Caretaker", "Security", "Broker");
export const KEY_HOLDERS = opts("Owner", "Manager", "Security", "Tenant");
export const BROKERAGE_ACCEPTED = opts("Yes", "No", "Negotiable");
export const BROKERAGE_PAYERS = ["Owner", "Buyer", "Tenant"];
export const BROKERAGE_TYPES = opts("Percentage", "Fixed", "Days");
export const BHK_CHOICES: Opt[] = [1, 2, 3, 4, 5, 6].map((n) => ({ label: `${n} BHK`, value: String(n) }));
/** States and union territories, for the State dropdown. */
export const INDIAN_STATES = opts(
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana", "Himachal Pradesh",
  "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha",
  "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Jammu and Kashmir",
  "Ladakh", "Lakshadweep", "Puducherry",
);
export const ADVANCE_MONTHS: Opt[] = Array.from({ length: 12 }, (_, i) => ({ label: `${i + 1} month${i ? "s" : ""}`, value: String(i + 1) }));

/** The listing's progress, as the inbound table colours it. */
export const INBOUND_STATUS_TONES: Record<string, StatusTone> = {
  "New Inbound": "gray",
  "Contacting Owner": "blue",
  "Terms not Accepted": "red",
  "On Hold": "gray",
  "Pending Verification": "amber",
  "Approved": "green",
  "Rejected": "red",
  "Closed": "green",
};
export const INBOUND_STATUSES = Object.keys(INBOUND_STATUS_TONES);

const FLOOR_TYPES = ["apartment", "builder_floor", "office", "shop", "showroom", "commercial_building", "hotel", "restaurant", "school", "college", "hospital", "clinic", "training_centre"];
const BHK_TYPES = ["apartment", "villa", "independent_house"];
// Commercial types priced per floor (land has no floors).
const FLOOR_PRICING_TYPES = ["office", "shop", "showroom", "commercial_building", "warehouse", "hotel", "restaurant"];

export const hasFloor = (type?: string | null) => !!type && FLOOR_TYPES.includes(type);
export const hasBhk = (category?: string | null, type?: string | null) => category === "residential" && !!type && BHK_TYPES.includes(type);
export const hasFloorPricing = (category?: string | null, type?: string | null) => category === "commercial" && !!type && FLOOR_PRICING_TYPES.includes(type);
export const typeLabel = (type?: string | null) =>
  Object.values(INBOUND_TYPES).flat().find((t) => t.value === type)?.label ?? (type ? type.replace(/_/g, " ") : "");

/**
 * Older records carry display values ("Commercial", "Office Space"); map them
 * to the keys the form uses. Unknown values pass through; when the type belongs
 * to another category, the type's category wins.
 */
export function normalizeCategoryAndType(rawCategory: string | null, rawType: string | null): { category: string | null; type: string | null } {
  const clean = (v: string | null | undefined) => (v ?? "").trim();
  const catLow = clean(rawCategory).toLowerCase();
  const typeLow = clean(rawType).toLowerCase();
  if (!catLow && !typeLow) return { category: null, type: null };
  const category = INBOUND_CATEGORIES.find((c) => c.value === catLow || c.label.toLowerCase() === catLow)?.value ?? (catLow ? clean(rawCategory) : null);
  const ordered = () => {
    const all = Object.entries(INBOUND_TYPES).map(([key, list]) => ({ key, list }));
    const own = category ? all.findIndex((e) => e.key === category) : -1;
    if (own <= 0) return all;
    const [first] = all.splice(own, 1);
    return [first, ...all];
  };
  const find = (needle: string) => {
    for (const { key, list } of ordered()) {
      const hit = list.find((t) => t.value === needle || t.label.toLowerCase() === needle);
      if (hit) return { value: hit.value, category: key };
    }
    return null;
  };
  if (typeLow) {
    const direct = find(typeLow) ?? (typeLow.match(/^(.*)\s+space$/) ? find(typeLow.replace(/\s+space$/, "")) : null);
    if (direct) return { category: direct.category, type: direct.value };
    return { category, type: clean(rawType) };
  }
  return { category, type: null };
}

/** The API's error text: `message` or `error`, possibly a list from validation. */
export function inboundErrorMessage(result: unknown): string | undefined {
  const r = result as { message?: unknown; error?: unknown } | null;
  const raw = r?.message ?? r?.error;
  if (Array.isArray(raw)) return raw.map(String).join(", ").trim() || undefined;
  if (typeof raw === "string" && raw.trim()) return raw;
  if (raw && typeof raw === "object" && "message" in raw) return inboundErrorMessage(raw);
  return undefined;
}

export type FloorRow = { floor_label: string; area: string; price: string; notes: string };

export const EMPTY_INBOUND = {
  property_title: "", category: "", type: "", bhk: "", purpose: "", special: [] as string[],
  status: "New Inbound", inbound_status: "",
  state: "Tamil Nadu", city: "", locality: "", area: "", landmark: "", latitude: "", longitude: "",
  total_rent: "", sale_price: "", advance: "", rent_per_sqft: "", floor_number: "", units: [] as FloorRow[],
  owner_name: "", mobile: "", whatsapp: "", email: "", alternative_contact: "", alternate_contact: "", preferred_time: "", address: "",
  pan_available: false, gst_applicable: false,
  primary_contact: "", primary_contact_name: "", primary_contact_number: "",
  key_with: "", key_contact_name: "", key_contact_number: "", prior_appointment: false,
  brokerage_accepted: "", brokerage_paid_by: [] as string[], brokerage_type: "", percentage: "", fixed_amount: "", brokerage_days: "", brokerage_remarks: "",
  is_exclusive: false, is_prime_location: false, documents_collected: false,
};
export type InboundForm = typeof EMPTY_INBOUND;

export const INBOUND_STEPS = [
  { key: "property", label: "Property" },
  { key: "location", label: "Location" },
  { key: "pricing", label: "Pricing" },
  { key: "owner", label: "Owner" },
  { key: "access", label: "Access" },
  { key: "brokerage", label: "Brokerage" },
] as const;
export type InboundStep = (typeof INBOUND_STEPS)[number]["key"] | "capture";

const MOBILE = /^\+?(?:[ ()-]*\d){10,15}[ ()-]*$/;
const brokered = (f: InboundForm) => f.brokerage_accepted === "Yes" || f.brokerage_accepted === "Negotiable";

/** What's missing on a step; an empty object means it's done. "capture" is the phone's quick form. */
export function checkInbound(step: InboundStep, f: InboundForm): Record<string, string> {
  const e: Record<string, string> = {};
  const need = (key: keyof InboundForm, message: string) => { if (!String(f[key] ?? "").trim()) e[key] = message; };
  if (step === "property" || step === "capture") {
    need("category", "Pick a property category.");
    need("type", "Pick a property type.");
  }
  if (step === "capture" && !MOBILE.test(f.mobile.trim())) e.mobile = "Enter a mobile number with 10 to 15 digits.";
  if (step === "property") {
    need("property_title", "Give the property a title.");
    need("purpose", "Pick sale, rent or lease.");
    need("status", "Pick a status.");
  }
  if (step === "location") {
    need("state", "Enter the state.");
    need("city", "Pick the city.");
    need("locality", "Pick the locality.");
    if (f.latitude.trim() && (!Number.isFinite(Number(f.latitude)) || Math.abs(Number(f.latitude)) > 90)) e.latitude = "Latitude runs from -90 to 90.";
    if (f.longitude.trim() && (!Number.isFinite(Number(f.longitude)) || Math.abs(Number(f.longitude)) > 180)) e.longitude = "Longitude runs from -180 to 180.";
  }
  if (step === "pricing") {
    const checkPrice = (key: string, value: string) => {
      try { parseInboundPrice(value); } catch { e[key] = "Enter a valid price."; }
    };
    if (f.purpose === "Rent") {
      if (f.total_rent.trim() && !Number.isFinite(Number(f.total_rent))) e.total_rent = "Enter a valid rent.";
      if (f.rent_per_sqft.trim() && !Number.isFinite(Number(f.rent_per_sqft))) e.rent_per_sqft = "Enter a valid rent per square foot.";
    }
    if (f.purpose === "Sale" && f.category === "residential") checkPrice("sale_price", f.sale_price);
    if (hasFloorPricing(f.category, f.type)) {
      for (const unit of f.units) if (unit.floor_label.trim()) checkPrice("units", unit.price);
    }
  }
  if (step === "owner") {
    need("owner_name", "Enter the owner's name.");
    if (!MOBILE.test(f.mobile.trim())) e.mobile = "Enter a mobile number with 10 to 15 digits.";
    if (f.email.trim() && !/^\S+@\S+\.\S+$/.test(f.email.trim())) e.email = "This doesn't look like an email address.";
  }
  if (step === "access") {
    need("primary_contact", "Who should we contact?");
    need("key_with", "Who has the keys?");
  }
  if (step === "brokerage") {
    need("brokerage_accepted", "Does the owner accept brokerage?");
    if (brokered(f)) {
      if (f.brokerage_type === "Percentage" && f.percentage.trim() && (!Number.isFinite(Number(f.percentage)) || Number(f.percentage) < 0)) e.percentage = "Enter a valid percentage.";
      if (f.brokerage_type === "Fixed" && f.fixed_amount.trim() && (!Number.isFinite(Number(f.fixed_amount)) || Number(f.fixed_amount) < 0)) e.fixed_amount = "Enter a valid amount.";
      if (f.brokerage_type === "Days" && f.brokerage_days.trim() && (!Number.isInteger(Number(f.brokerage_days)) || Number(f.brokerage_days) < 0)) e.brokerage_days = "Enter a whole number of days.";
    }
  }
  return e;
}

const num = (v: string) => (v.trim() === "" ? null : Number(v));
const text = (v: string) => v.trim() || null;
export function parseInboundPrice(value: string): number | null {
  const text = value.trim();
  if (!text) return null;
  const cleaned = text.replace(/^₹\s*/, "").replace(/,/g, "");
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)\s*(?:cr(?:ores?)?|l(?:akhs?)?|lacs?|k|thousands?)?$/i.test(cleaned)) {
    throw new Error("Enter a valid price.");
  }
  const price = parseIndianCurrency(cleaned);
  if (!Number.isFinite(price)) throw new Error("Enter a valid price.");
  return price;
}

/** The body for POST /inbounds. The quick form sends only what it asks for. */
export function inboundPayload(f: InboundForm, quick = false): Record<string, unknown> {
  if (quick) {
    return {
      quick_capture: true,
      property_category: f.category,
      property_type: f.type,
      mobile_number: f.mobile.trim(),
      inbound_status: f.inbound_status || null,
      alternate_contact: text(f.alternate_contact),
      alternative_contact: text(f.alternative_contact),
    };
  }
  const rent = f.purpose === "Rent";
  const showOther = (who: string) => !!who && who !== "Owner";
  return {
    property_title: f.property_title.trim(),
    property_category: f.category,
    property_type: f.type,
    bhk: hasBhk(f.category, f.type) ? f.bhk || null : null,
    purpose: f.purpose,
    special_purpose: f.category === "commercial" && f.special.length ? f.special.join(", ") : null,
    status: f.status,
    inbound_status: f.inbound_status || null,
    state: f.state.trim(),
    city: f.city,
    locality: f.locality,
    area: text(f.area),
    landmark: text(f.landmark),
    latitude: num(f.latitude),
    longitude: num(f.longitude),
    total_rent: rent ? num(f.total_rent) : null,
    rent_per_sqft: rent ? num(f.rent_per_sqft) : null,
    sale_price: f.purpose === "Sale" && f.category === "residential" ? parseInboundPrice(f.sale_price) : null,
    // Rent advance is a number of months; otherwise an amount like "5 Lakhs".
    advance: f.advance.trim() ? (rent ? f.advance : parseIndianCurrency(f.advance) || f.advance) : null,
    floor_number: hasFloor(f.type) ? text(f.floor_number) : null,
    ...(hasFloorPricing(f.category, f.type) && f.units.some((u) => u.floor_label.trim())
      ? {
          units: f.units.filter((u) => u.floor_label.trim()).map((u) => ({
            floor_label: u.floor_label.trim(),
            area: text(u.area),
            price: parseInboundPrice(u.price),
            notes: text(u.notes),
          })),
        }
      : {}),
    owner_name: f.owner_name.trim(),
    mobile_number: f.mobile.trim(),
    whatsapp_number: text(f.whatsapp),
    email: text(f.email),
    alternative_contact: text(f.alternative_contact),
    alternate_contact: text(f.alternate_contact),
    preferred_contact_time: f.preferred_time || null,
    address: text(f.address),
    pan_available: f.pan_available,
    gst_applicable: f.gst_applicable,
    primary_contact: f.primary_contact,
    primary_contact_name: showOther(f.primary_contact) ? text(f.primary_contact_name) : null,
    primary_contact_number: showOther(f.primary_contact) ? text(f.primary_contact_number) : null,
    key_available_with: f.key_with,
    key_contact_name: showOther(f.key_with) && f.key_with !== f.primary_contact ? text(f.key_contact_name) : null,
    key_contact_number: showOther(f.key_with) && f.key_with !== f.primary_contact ? text(f.key_contact_number) : null,
    prior_appointment_required: f.prior_appointment,
    brokerage_accepted: f.brokerage_accepted,
    brokerage_paid_by: brokered(f) ? f.brokerage_paid_by : [],
    brokerage_type: brokered(f) ? f.brokerage_type || null : null,
    percentage: brokered(f) && f.brokerage_type === "Percentage" ? num(f.percentage) : null,
    fixed_amount: brokered(f) && f.brokerage_type === "Fixed" ? num(f.fixed_amount) : null,
    brokerage_days: brokered(f) && f.brokerage_type === "Days" ? num(f.brokerage_days) : null,
    brokerage_remarks: brokered(f) ? text(f.brokerage_remarks) : null,
    is_exclusive: f.is_exclusive,
    is_prime_location: f.is_prime_location,
    documents_collected: f.documents_collected,
  };
}
