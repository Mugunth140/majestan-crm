/**
 * Extra requirement preferences for non-residential leads: what a shop,
 * office, warehouse or factory buyer needs from the site. Shared by the
 * new-lead form and the lead page so both ask the same questions and store
 * the same keys in the requirement's `preferences` JSON.
 */
export type SiteFieldOption = { label: string; value: string };

export type SiteField = {
  key: string;
  label: string;
  kind: "number" | "text" | "select" | "check";
  /** Categories that ask this question. */
  categories: string[];
  unit?: string;
  placeholder?: string;
  options?: SiteFieldOption[];
  /** The checkbox text for a `check` field. */
  checkText?: string;
};

const COMMERCIAL = ["commercial"];
const BUILT = ["commercial", "industrial"];
const ALL_SITES = ["commercial", "industrial", "agricultural", "institutional"];

/** Lift choices for commercial and industrial; "required" and "not_needed" match the residential values. */
export const SITE_LIFT_OPTIONS: SiteFieldOption[] = [
  { label: "Passenger lift", value: "required" },
  { label: "Goods lift", value: "goods" },
  { label: "Passenger & goods lift", value: "both" },
  { label: "Not needed", value: "not_needed" },
];

export const SITE_FIELDS: SiteField[] = [
  { key: "floorNumber", label: "Floor", kind: "text", categories: COMMERCIAL, placeholder: "e.g. Ground, 1st" },
  { key: "frontageFt", label: "Min frontage", kind: "number", unit: "ft", categories: COMMERCIAL, placeholder: "ft" },
  { key: "ceilingHeightFt", label: "Min ceiling height", kind: "number", unit: "ft", categories: BUILT, placeholder: "ft" },
  { key: "lift", label: "Lift", kind: "select", categories: BUILT, options: SITE_LIFT_OPTIONS },
  {
    key: "roadAccess", label: "Road access", kind: "select", categories: ALL_SITES, options: [
      { label: "20 ft road or wider", value: "20" },
      { label: "30 ft road or wider", value: "30" },
      { label: "40 ft road or wider", value: "40" },
      { label: "60 ft / main road", value: "60" },
      { label: "Highway frontage", value: "highway" },
    ],
  },
  {
    key: "containerSize", label: "Container access", kind: "select", categories: BUILT, options: [
      { label: "Not needed", value: "none" },
      { label: "20 ft container", value: "20ft" },
      { label: "40 ft container", value: "40ft" },
    ],
  },
  {
    key: "truckParking", label: "Truck parking", kind: "select", categories: BUILT, options: [
      { label: "Not needed", value: "0" },
      { label: "1 truck", value: "1" },
      { label: "2–3 trucks", value: "2" },
      { label: "4 or more", value: "4" },
    ],
  },
  { key: "powerLoad", label: "Power load", kind: "text", categories: BUILT, placeholder: "e.g. 50 kVA, 3-phase" },
  {
    key: "washroom", label: "Washroom", kind: "select", categories: COMMERCIAL, options: [
      { label: "Private", value: "private" },
      { label: "Shared is fine", value: "shared" },
      { label: "Not needed", value: "none" },
    ],
  },
  { key: "loadingBay", label: "Loading bay", kind: "check", categories: BUILT, checkText: "Needs a loading bay or dock" },
  { key: "fireSafety", label: "Fire safety", kind: "check", categories: BUILT, checkText: "Needs fire NOC / fire safety" },
];

/** The site questions a category asks, in display order. */
export function siteFieldsFor(category?: string | null): SiteField[] {
  return category ? SITE_FIELDS.filter((f) => f.categories.includes(category)) : [];
}

/** The section title for a category's site questions. */
export function siteFieldsTitle(category?: string | null): string {
  if (category === "commercial") return "Commercial needs";
  if (category === "industrial") return "Industrial needs";
  return "Site needs";
}

/** Turn what a form field holds into the stored preference value, or null to clear it. */
export function siteFieldValue(field: SiteField, raw: unknown): string | number | boolean | null {
  if (field.kind === "check") return raw === true ? true : null;
  const text = raw == null ? "" : String(raw).trim();
  if (!text) return null;
  if (field.kind === "number") {
    const n = Number(text);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  return text;
}
