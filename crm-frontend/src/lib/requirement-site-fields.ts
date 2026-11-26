/**
 * Extra requirement preferences for non-residential leads: what a shop,
 * office, warehouse or factory buyer needs from the site, picked by the
 * requirement's property type (or its category before a type is chosen). Shared by the
 * new-lead form and the lead page so both ask the same questions and store
 * the same keys in the requirement's `preferences` JSON.
 */
export type SiteFieldOption = { label: string; value: string };

export type SiteField = {
  key: string;
  label: string;
  kind: "number" | "text" | "select" | "check";
  /** Categories that ask this question when no property type is picked yet. */
  categories: string[];
  /** Property types that ask it once a type is picked. */
  types: string[];
  unit?: string;
  placeholder?: string;
  options?: SiteFieldOption[];
  /** The checkbox text for a `check` field. */
  checkText?: string;
};

// Commercial units people sit, shop or eat in; and the ones goods move through.
const UNITS = ["office", "shop", "showroom", "restaurant", "commercial_building"];
const STREET = ["shop", "showroom", "restaurant", "commercial_building", "commercial_land"];
const GOODS = ["warehouse", "factory", "industrial_shed", "manufacturing_unit"];
const INDUSTRIAL = [...GOODS, "industrial_land"];
const LAND_AND_SITES = ["commercial_land", "showroom", "commercial_building", "hotel", "warehouse", ...INDUSTRIAL,
  "agricultural_land", "farm_land", "coconut_farm", "plantation", "orchard", "school", "college", "hospital", "clinic", "training_centre"];

/** Lift choices for commercial and industrial; "required" and "not_needed" match the residential values. */
export const SITE_LIFT_OPTIONS: SiteFieldOption[] = [
  { label: "Passenger lift", value: "required" },
  { label: "Goods lift", value: "goods" },
  { label: "Passenger & goods lift", value: "both" },
  { label: "Not needed", value: "not_needed" },
];

export const SITE_FIELDS: SiteField[] = [
  { key: "floorNumber", label: "Floor", kind: "text", categories: ["commercial"], types: UNITS, placeholder: "e.g. Ground, 1st" },
  { key: "frontageFt", label: "Min frontage", kind: "number", unit: "ft", categories: ["commercial"], types: STREET, placeholder: "ft" },
  { key: "ceilingHeightFt", label: "Min ceiling height", kind: "number", unit: "ft", categories: ["industrial"], types: GOODS, placeholder: "ft" },
  { key: "lift", label: "Lift", kind: "select", categories: ["commercial", "industrial"], types: ["office", "showroom", "commercial_building", "hotel", ...GOODS], options: SITE_LIFT_OPTIONS },
  {
    key: "roadAccess", label: "Road access", kind: "select", categories: ["industrial", "agricultural", "institutional"], types: LAND_AND_SITES, options: [
      { label: "20 ft road or wider", value: "20" },
      { label: "30 ft road or wider", value: "30" },
      { label: "40 ft road or wider", value: "40" },
      { label: "60 ft / main road", value: "60" },
      { label: "Highway frontage", value: "highway" },
    ],
  },
  {
    key: "containerSize", label: "Container access", kind: "select", categories: ["industrial"], types: INDUSTRIAL, options: [
      { label: "Not needed", value: "none" },
      { label: "20 ft container", value: "20ft" },
      { label: "40 ft container", value: "40ft" },
    ],
  },
  {
    key: "truckParking", label: "Truck parking", kind: "select", categories: ["industrial"], types: INDUSTRIAL, options: [
      { label: "Not needed", value: "0" },
      { label: "1 truck", value: "1" },
      { label: "2–3 trucks", value: "2" },
      { label: "4 or more", value: "4" },
    ],
  },
  { key: "powerLoad", label: "Power load", kind: "text", categories: ["industrial"], types: GOODS, placeholder: "e.g. 50 kVA, 3-phase" },
  {
    key: "washroom", label: "Washroom", kind: "select", categories: ["commercial"], types: UNITS, options: [
      { label: "Private", value: "private" },
      { label: "Shared is fine", value: "shared" },
      { label: "Not needed", value: "none" },
    ],
  },
  { key: "loadingBay", label: "Loading bay", kind: "check", categories: ["industrial"], types: GOODS, checkText: "Needs a loading bay or dock" },
  { key: "fireSafety", label: "Fire safety", kind: "check", categories: ["industrial"], types: [...GOODS, "hotel", "restaurant", "commercial_building"], checkText: "Needs fire NOC / fire safety" },
];

/** The site questions a requirement asks, in display order: by its property type, else its category. */
export function siteFieldsFor(category?: string | null, type?: string | null): SiteField[] {
  if (!category || category === "residential") return [];
  return type ? SITE_FIELDS.filter((f) => f.types.includes(type)) : SITE_FIELDS.filter((f) => f.categories.includes(category));
}

/** The section title for a category's site questions. */
export function siteFieldsTitle(category?: string | null): string {
  if (category === "commercial") return "Commercial needs";
  if (category === "industrial") return "Industrial needs";
  return "Site needs";
}

const LAND = ["plot", "commercial_land", "industrial_land", "agricultural_land", "farm_land", "coconut_farm", "plantation", "orchard"];
/** Commercial spaces that come furnished or bare. */
const FURNISHABLE = ["office", "shop", "showroom", "restaurant", "hotel", "commercial_building"];

/** Which of the general preference questions a requirement asks, from its category and property type. */
export function requirementShows(category?: string | null, type?: string | null) {
  const home = category === "residential";
  const land = !!type && LAND.includes(type);
  const commercialSpace = category === "commercial" && (type ? FURNISHABLE.includes(type) : true);
  return {
    /** BHK, floor and lift: homes with rooms. */
    rooms: home && !land,
    facing: home,
    furnishing: (home && !land) || commercialSpace,
    area: (!!category && !home) || land,
    carParking: (home && !land) || commercialSpace,
    petFriendly: home && !land,
  };
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
