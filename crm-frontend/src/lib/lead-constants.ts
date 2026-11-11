export const LEAD_STATUS_STYLES: Record<string, string> = {
  "New Lead":             "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900 dark:text-gray-300",
  "Contacted":            "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400",
  "Qualified":            "bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400",
  "Property Shared":      "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400",
  "Other Location":       "bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-900/30 dark:text-violet-400",
  "Interested":           "bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200 dark:bg-fuchsia-900/30 dark:text-fuchsia-400",
  "Site Visit Scheduled": "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400",
  "Site Visit Completed": "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400",
  "Re Visit Scheduled":   "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400",
  "Re Visit Completed":   "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400",
  "Negotiation":          "bg-pink-100 text-pink-800 border-pink-200 dark:bg-pink-900/30 dark:text-pink-400",
  "Booking Advance":      "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400",
  "Agreement":            "bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-900/30 dark:text-teal-400",
  "Closed Won":           "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400",
  "Not Interested":       "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400",
  "Dropped":              "bg-red-100 text-red-800 border-red-300 dark:bg-red-900/40 dark:text-red-400",
  "Lost":                 "bg-red-200 text-red-900 border-red-300 dark:bg-red-900/50 dark:text-red-300",
  "Future Follow-up":     "bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-300",
};

// Solid dot colour per status, for list rows, kanban columns and group headers.
export const LEAD_STATUS_DOTS: Record<string, string> = {
  "New Lead": "bg-gray-400",
  "Contacted": "bg-blue-500",
  "Qualified": "bg-indigo-500",
  "Property Shared": "bg-purple-500",
  "Other Location": "bg-violet-500",
  "Interested": "bg-fuchsia-500",
  "Site Visit Scheduled": "bg-amber-500",
  "Site Visit Completed": "bg-yellow-500",
  "Re Visit Scheduled": "bg-orange-500",
  "Re Visit Completed": "bg-rose-500",
  "Negotiation": "bg-pink-500",
  "Booking Advance": "bg-emerald-500",
  "Agreement": "bg-teal-500",
  "Closed Won": "bg-green-600",
  "Not Interested": "bg-red-500",
  "Dropped": "bg-red-600",
  "Lost": "bg-red-700",
  "Future Follow-up": "bg-slate-500",
};

// Pipeline order, used for kanban columns and status grouping.
export const LEAD_STATUS_ORDER = Object.keys(LEAD_STATUS_STYLES);

export const PURCHASE_TYPES = [
  { label: "Rental", value: "rental" },
  { label: "Construction", value: "construction" },
  { label: "Liasioning", value: "liasioning" },
  { label: "Property Management", value: "property_management" },
  { label: "Sale", value: "sale" },
  { label: "Buy", value: "buy" },
];

export const PURCHASE_TIMELINES = [
  { label: "Immediate", value: "immediate" },
  { label: "Within 30 Days", value: "within_30_days" },
  { label: "3 Months", value: "3_months" },
  { label: "6 Months", value: "6_months" },
  { label: "Just Enquiry", value: "just_enquiry" },
];

export const QUALIFICATION_PURPOSES = [
  { label: "Self Use", value: "self_use" },
  { label: "Investment", value: "investment" },
  { label: "Rental Income", value: "rental_income" },
  { label: "Business Use", value: "business_use" },
];

export const PROPERTY_CATEGORIES = [
  { label: "Residential", value: "residential" },
  { label: "Commercial", value: "commercial" },
  { label: "Industrial", value: "industrial" },
  { label: "Agricultural", value: "agricultural" },
  { label: "Institutional", value: "institutional" },
];

export const PROPERTY_TYPES_MAP: Record<string, { label: string; value: string }[]> = {
  residential: [
    { label: "Apartment", value: "apartment" },
    { label: "Villa", value: "villa" },
    { label: "Independent House", value: "independent_house" },
    { label: "Plot", value: "plot" },
    { label: "Farm House", value: "farm_house" },
    { label: "Builder Floor", value: "builder_floor" },
  ],
  commercial: [
    { label: "Office", value: "office" },
    { label: "Shop", value: "shop" },
    { label: "Showroom", value: "showroom" },
    { label: "Commercial Building", value: "commercial_building" },
    { label: "Warehouse", value: "warehouse" },
    { label: "Hotel", value: "hotel" },
    { label: "Restaurant", value: "restaurant" },
    { label: "Commercial Land", value: "commercial_land" },
  ],
  industrial: [
    { label: "Factory", value: "factory" },
    { label: "Industrial Shed", value: "industrial_shed" },
    { label: "Industrial Land", value: "industrial_land" },
    { label: "Warehouse", value: "warehouse" },
    { label: "Manufacturing Unit", value: "manufacturing_unit" },
  ],
  agricultural: [
    { label: "Agricultural Land", value: "agricultural_land" },
    { label: "Farm Land", value: "farm_land" },
    { label: "Coconut Farm", value: "coconut_farm" },
    { label: "Plantation", value: "plantation" },
    { label: "Orchard", value: "orchard" },
  ],
  institutional: [
    { label: "School", value: "school" },
    { label: "College", value: "college" },
    { label: "Hospital", value: "hospital" },
    { label: "Clinic", value: "clinic" },
    { label: "Training Centre", value: "training_centre" },
  ],
};

export const FUNDERS = [
  { label: "Self Funded", value: "self" },
  { label: "Bank Loan", value: "bank" },
];

export const PROJECTS = [
  { label: "Majestan Prestige", value: "majestan_prestige" },
  { label: "Majestan Heights", value: "majestan_heights" },
  { label: "Majestan Residency", value: "majestan_residency" },
  { label: "Majestan Enclave", value: "majestan_enclave" },
  { label: "Majestan Grand", value: "majestan_grand" },
];

// Older statuses still on some leads, shown with the colours of their current name.
const LEGACY_STATUS: Record<string, string> = { "Follow Up": "Future Follow-up" };

/** Pill classes for a status, the same on the leads table and the lead page. */
// Requirement preferences, shared by the new-lead form and the lead page.
export const BHK_OPTIONS = ["1", "2", "3", "4", "5"].map((v) => ({ label: v, value: v }));
export const FURNISHING_OPTIONS = [
  { label: "Furnished", value: "1" }, { label: "Semi furnished", value: "2" }, { label: "Unfurnished", value: "0" },
];
/** Car parking slots a requirement needs; "0" means none. */
export const CAR_PARKING_OPTIONS = [
  { label: "Not needed", value: "0" }, { label: "1 car", value: "1" }, { label: "2 cars", value: "2" }, { label: "3 or more", value: "3" },
];
export const LIFT_OPTIONS = [
  { label: "Required", value: "required" }, { label: "Not needed", value: "not_needed" },
];
export const FACING_OPTIONS = [
  { label: "North", value: "North" }, { label: "East", value: "East" }, { label: "South", value: "South" }, { label: "West", value: "West" },
  { label: "North-East", value: "North-East" }, { label: "North-West", value: "North-West" },
  { label: "South-East", value: "South-East" }, { label: "South-West", value: "South-West" }, { label: "Any", value: "Any" },
];
export const DECISION_MAKERS = [
  "Self", "Spouse", "Father", "Mother", "Son", "Daughter", "Brother", "Sister", "Father-in-law", "Mother-in-law",
  "Business Partner", "Joint Family", "Other Relative",
].map((v) => ({ label: v, value: v }));
/**
 * A multi-pick preference (BHK, facing) as a list in option order. Older
 * requirements stored one value, so a single value reads as a list of one;
 * values no longer offered are kept at the end.
 */
export function prefList(value: unknown, options: { value: string }[]): string[] {
  const raw = (Array.isArray(value) ? value : [value]).filter((v) => v != null && v !== "").map(String);
  const order = (v: string) => { const i = options.findIndex((o) => o.value === v); return i < 0 ? options.length : i; };
  return [...new Set(raw)].sort((a, b) => order(a) - order(b));
}

/** Facing "Any" stands alone: picked last it clears the rest, otherwise it drops out. */
export function facingList(picked: string[]): string[] {
  if (picked[picked.length - 1] === "Any") return ["Any"];
  return picked.filter((v) => v !== "Any");
}

/** Categories whose preferences are an area range rather than BHK / facing. */
export const AREA_CATEGORIES = ["commercial", "industrial", "agricultural", "institutional"];

export const leadStatusPill = (status?: string | null) =>
  LEAD_STATUS_STYLES[status ?? ""] ?? LEAD_STATUS_STYLES[LEGACY_STATUS[status ?? ""]] ?? "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";

export const leadStatusDot = (status?: string | null) =>
  LEAD_STATUS_DOTS[status ?? ""] ?? LEAD_STATUS_DOTS[LEGACY_STATUS[status ?? ""]] ?? "bg-gray-400";
