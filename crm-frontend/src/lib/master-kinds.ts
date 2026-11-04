// Master lists the property and project forms can add to without leaving the form.

export type MasterKind =
  | "amenities" | "furnishing-items" | "utilities" | "road-names" | "room-names"
  | "room-dimensions" | "registration-charges" | "specifications" | "cities" | "sublocations";

export const MASTER_KINDS: Record<MasterKind, { title: string; noun: string; description: string; fieldLabel: string; placeholder: string }> = {
  amenities: { title: "Amenity", noun: "amenity", description: "Create a new amenity for property and project listings.", fieldLabel: "Amenity", placeholder: "e.g. Swimming Pool" },
  "furnishing-items": { title: "Furnishing Item", noun: "furnishing item", description: "Create a new furnishing item.", fieldLabel: "Item Name", placeholder: "e.g. Sofa" },
  utilities: { title: "Utility", noun: "utility", description: "Create a new utility.", fieldLabel: "Item Name", placeholder: "e.g. Water Purifier" },
  "road-names": { title: "Road Name", noun: "road name", description: "Create a new road name.", fieldLabel: "Road Name", placeholder: "e.g. 100 Feet Road" },
  "room-names": { title: "Room Name", noun: "room name", description: "Create a new room name.", fieldLabel: "Room Name", placeholder: "e.g. Master Bedroom" },
  "room-dimensions": { title: "Room Dimension", noun: "room dimension", description: "Create a new room dimension from its length and width.", fieldLabel: "Dimension", placeholder: "" },
  "registration-charges": { title: "Registration Charge", noun: "registration charge", description: "Create a new registration charge.", fieldLabel: "Registration Charge", placeholder: "e.g. 7% of guideline value" },
  specifications: { title: "Specification", noun: "specification", description: "Create a new specification label.", fieldLabel: "Specification", placeholder: "e.g. Flooring" },
  cities: { title: "City", noun: "city", description: "Create a new city for property listings.", fieldLabel: "City Name", placeholder: "e.g. Chennai" },
  sublocations: { title: "Locality", noun: "locality", description: "Create a new locality and map it to a city.", fieldLabel: "Locality / Sublocation Name", placeholder: "e.g. Velachery" },
};

// Mirrors the site AmenityCategory enum (site amenities table).
export const AMENITY_CATEGORIES = [
  { value: "security", label: "Security" },
  { value: "utilities", label: "Utilities" },
  { value: "recreation", label: "Recreation" },
  { value: "community", label: "Community" },
  { value: "connectivity", label: "Connectivity" },
  { value: "interior", label: "Interior" },
  { value: "other", label: "Other" },
  { value: "feature", label: "Feature" },
  { value: "utility", label: "Utility" },
];

export const INDIA_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
  "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
  "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
  "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry",
];

/** The room-dimension master's name for a length × width, as its page builds it ("12 × 10 ft"). */
export function roomDimensionName(lengthFt: string, widthFt: string): string | null {
  const toNum = (v: string) => {
    const n = Number(v);
    return v.trim() !== "" && Number.isFinite(n) && n > 0 ? String(parseFloat(n.toFixed(2))) : null;
  };
  const len = toNum(lengthFt);
  const wid = toNum(widthFt);
  return len == null || wid == null ? null : `${len} × ${wid} ft`;
}

/** Same name ignoring case and spacing; used so "Create" isn't offered for an item that's already listed. */
export const sameName = (a: string, b: string) => a.trim().toLowerCase().replace(/\s+/g, " ") === b.trim().toLowerCase().replace(/\s+/g, " ");
