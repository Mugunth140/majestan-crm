import { parseIndianCurrency } from "@/lib/indian-currency";
import { parseMultiValue } from "./PropertyMultiSelect";

export const WATER_SUPPLY_OPTIONS = [
  "24/7",
  "Corporation water",
  "Bore water",
  "No water Facility",
  "Corp & bore Mixed Water",
  "Water Tanker / Lorry",
];
export const ELECTRICITY_OPTIONS = ["Single Phase", "Three Phase"];
export const OWNERSHIP_OPTIONS = ["Individual", "Company", "Joint"];
export const IRRIGATION_OPTIONS = [
  "Drip Irrigation",
  "Sprinkler Irrigation",
  "Furrow / Ridge Irrigation",
  "Flood / Basin Irrigation",
  "Rainfed / Dryland Farming",
  "Tank / Well Irrigation",
];
export const STORAGE_OPTIONS = [
  "50,000 Litres",
  ...[1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5].map((n) => `${n} Lakh Litres`),
];
export const POWER_OPTIONS = [
  ...[25, 50, 75, 100, 125, 150].map((n) => `${n} HP`),
  "High Density",
];
export const PLOT_RENT_USES = [
  "Parking",
  "Storage Yard",
  "Nursery",
  "Agriculture",
  "Commercial Use",
  "Other",
];
export const BHK_OPTIONS = [
  "1 RK",
  ...Array.from({ length: 10 }, (_, i) => `${i + 1} BHK`),
];
export const CONTACT_ROLES = ["Care Taker", "Security", "Manager"];
export type AlternativeContact = {
  role: string;
  name: string;
  phone: string;
  email: string;
};
export type ContactDetails = {
  ownerAlternatives: AlternativeContact[];
  agentPhone: string;
  agentEmail: string;
  agentAlternative: AlternativeContact;
};
export const emptyContact = (): AlternativeContact => ({
  role: "",
  name: "",
  phone: "",
  email: "",
});
export function restoreContactDetails(
  value: Partial<ContactDetails> | null | undefined,
): ContactDetails {
  const contact = (
    v: Partial<AlternativeContact> | null | undefined,
  ): AlternativeContact => ({
    role: String(v?.role ?? ""),
    name: String(v?.name ?? ""),
    phone: String(v?.phone ?? ""),
    email: String(v?.email ?? ""),
  });
  return {
    ownerAlternatives: Array.from({ length: 2 }, (_, i) =>
      contact(value?.ownerAlternatives?.[i]),
    ),
    agentPhone: String(value?.agentPhone ?? ""),
    agentEmail: String(value?.agentEmail ?? ""),
    agentAlternative: contact(value?.agentAlternative),
  };
}
export type PortionDraft = { bhk: string; count: string };
export type ParkingDraft = {
  vehicle: "Car" | "Bike";
  type: "Open" | "Covered";
  count: string;
};
const NUMBER_FIELDS = [
  "individualBathrooms",
  "attachedBathrooms",
  "passengerLifts",
  "serviceLifts",
  "agricultureEb",
  "restroomCount",
  "totalRentPerMonth",
  "expectedRentPerMonth",
] as const;
const TEXT_FIELDS = [
  "roadApproach",
  "storageTankCapacity",
  "powerSupplyCapacity",
  "availableFloorNumbers",
  "propertyUses",
  "specialPurposes",
  "utilities",
] as const;
export type CurationDraft = Record<
  (typeof NUMBER_FIELDS)[number] | (typeof TEXT_FIELDS)[number],
  string
> & {
  portions: PortionDraft[];
  parkingSpaces: ParkingDraft[];
  hasCanteen: boolean;
  hasFreeRefreshment: boolean;
  hasCanteenKnown: boolean;
  hasFreeRefreshmentKnown: boolean;
  parkingRecorded: boolean;
};
export function restoreCurationDetails(
  value: Record<string, unknown> | null | undefined,
): CurationDraft {
  const data = value ?? {};
  return {
    ...Object.fromEntries(
      [...NUMBER_FIELDS, ...TEXT_FIELDS].map((key) => [
        key,
        Array.isArray(data[key])
          ? JSON.stringify(data[key])
          : data[key] == null
            ? ""
            : String(data[key]),
      ]),
    ),
    portions: Array.isArray(data.portions)
      ? data.portions
          .filter((p) => p && typeof p === "object")
          .map((p) => ({
            bhk: String(p.bhk ?? ""),
            count: String(p.count ?? ""),
          }))
      : [],
    parkingSpaces: Array.isArray(data.parkingSpaces)
      ? data.parkingSpaces
          .filter((p) => p && typeof p === "object")
          .map((p) => ({
            vehicle: p.vehicle === "Bike" ? "Bike" : "Car",
            type: p.type === "Covered" ? "Covered" : "Open",
            count: String(p.count ?? ""),
          }))
      : [],
    hasCanteenKnown:
      typeof data.hasCanteenKnown === "boolean"
        ? data.hasCanteenKnown
        : typeof data.hasCanteen === "boolean",
    hasFreeRefreshmentKnown:
      typeof data.hasFreeRefreshmentKnown === "boolean"
        ? data.hasFreeRefreshmentKnown
        : typeof data.hasFreeRefreshment === "boolean",
    hasCanteen: data.hasCanteen === true,
    hasFreeRefreshment: data.hasFreeRefreshment === true,
    parkingRecorded:
      typeof data.parkingRecorded === "boolean"
        ? data.parkingRecorded
        : Array.isArray(data.parkingSpaces),
  } as CurationDraft;
}
export function curationPayload(
  draft: CurationDraft,
  visible: (field: string) => boolean,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of NUMBER_FIELDS)
    if (visible(key))
      out[key] = draft[key].trim()
        ? ["totalRentPerMonth", "expectedRentPerMonth"].includes(key)
          ? parseIndianCurrency(draft[key])
          : Number(draft[key])
        : null;
  for (const key of TEXT_FIELDS)
    if (visible(key))
      out[key] = ["propertyUses", "specialPurposes", "utilities"].includes(key)
        ? parseMultiValue(draft[key])
        : draft[key].trim();
  if (visible("numberOfPortions"))
    out.portions = draft.portions.map((p) => ({
      bhk: p.bhk,
      count: Number(p.count),
    }));
  if (
    visible("parkingSpaces") &&
    (draft.parkingSpaces.length || draft.parkingRecorded)
  )
    out.parkingSpaces = draft.parkingSpaces.map((p) => ({
      ...p,
      count: Number(p.count),
    }));
  for (const key of ["hasCanteen", "hasFreeRefreshment"] as const)
    if (visible(key) && draft[`${key}Known`]) out[key] = draft[key];
  return out;
}
export function curationErrors(
  draft: CurationDraft,
  visible: (field: string) => boolean,
  numberOfPortions: string,
): string[] {
  const errors: string[] = [];
  for (const key of NUMBER_FIELDS)
    if (visible(key) && draft[key].trim()) {
      const n = ["totalRentPerMonth", "expectedRentPerMonth"].includes(key)
        ? parseIndianCurrency(draft[key])
        : Number(draft[key]);
      if (
        !Number.isFinite(n) ||
        n < 0 ||
        (["totalRentPerMonth", "expectedRentPerMonth"].includes(key) &&
          n === 0 &&
          !/^0+(?:\.0+)?(?:l|lakh|k|crore|cr)?$/i.test(
            draft[key].replace(/[₹,\s]/g, ""),
          )) ||
        (!["totalRentPerMonth", "expectedRentPerMonth"].includes(key) &&
          !Number.isInteger(n))
      )
        errors.push("Enter nonnegative whole counts and valid rent amounts.");
    }
  if (visible("numberOfPortions") && draft.portions.length) {
    if (
      draft.portions.some(
        (p) =>
          !p.bhk.trim() ||
          !Number.isInteger(Number(p.count)) ||
          Number(p.count) < 1,
      )
    )
      errors.push(
        "Choose a configuration and positive count for every portion row.",
      );
    if (
      new Set(draft.portions.map((p) => p.bhk)).size !== draft.portions.length
    )
      errors.push("Combine matching BHK configurations into one row.");
    if (
      draft.portions.reduce((sum, p) => sum + Number(p.count), 0) !==
      Number(numberOfPortions)
    )
      errors.push("Portion configuration counts must equal No of Portions.");
  }
  if (visible("parkingSpaces")) {
    if (
      draft.parkingSpaces.some(
        (p) => !Number.isInteger(Number(p.count)) || Number(p.count) < 1,
      )
    )
      errors.push("Parking counts must be positive whole numbers.");
    if (
      new Set(draft.parkingSpaces.map((p) => p.vehicle + p.type)).size !==
      draft.parkingSpaces.length
    )
      errors.push("Use each vehicle and parking type combination once.");
  }
  return [...new Set(errors)];
}
export function bathroomTotal(
  draft: CurationDraft,
  legacy: string,
): number | undefined {
  return draft.individualBathrooms.trim() || draft.attachedBathrooms.trim()
    ? Number(draft.individualBathrooms || 0) +
        Number(draft.attachedBathrooms || 0)
    : legacy.trim()
      ? Number(legacy)
      : undefined;
}

export function curationReadFields(
  value: Record<string, unknown> | null | undefined,
  visible: (field: string) => boolean,
): { label: string; value: string }[] {
  if (!value) return [];
  const labels: Record<string, string> = {
    individualBathrooms: "Individual Bathrooms",
    attachedBathrooms: "Attached Bathrooms",
    passengerLifts: "Passenger Lifts",
    serviceLifts: "Service Lifts",
    agricultureEb: "Agriculture EB",
    roadApproach: "Road Approach",
    storageTankCapacity: "Storage Tank Capacity",
    powerSupplyCapacity: "Power Supply",
    hasCanteen: "Has Canteen",
    hasFreeRefreshment: "Has Free Refreshment",
    restroomCount: "No of Rest Rooms",
    expectedMonthlyRentPerSqft: "Expected Monthly Rent per Sqft",
    totalRentPerMonth: "Total Rent per Month",
    expectedRentPerMonth: "Expected Rent per Month",
    availableFloorNumbers: "Available Floor Numbers",
    propertyUses: "Property Use",
    specialPurposes: "Special Purpose",
    utilities: "Utilities Provided",
  };
  const rows = Object.entries(labels).flatMap(([key, label]) => {
    const stored = value[key];
    return !visible(key) ||
      stored == null ||
      stored === "" ||
      (Array.isArray(stored) && !stored.length)
      ? []
      : [
          {
            label,
            value: Array.isArray(stored)
              ? stored.join(", ")
              : typeof stored === "boolean"
                ? stored
                  ? "Yes"
                  : "No"
                : String(stored),
          },
        ];
  });
  if (
    visible("numberOfPortions") &&
    Array.isArray(value.portions) &&
    value.portions.length
  )
    rows.push({
      label: "Portion Configurations",
      value: value.portions.map((p) => `${p.bhk} × ${p.count}`).join(", "),
    });
  if (
    visible("parkingSpaces") &&
    Array.isArray(value.parkingSpaces) &&
    value.parkingSpaces.length
  )
    rows.push({
      label: "Parking Spaces",
      value: value.parkingSpaces
        .map((p) => `${p.vehicle} ${p.type} × ${p.count}`)
        .join(", "),
    });
  return rows;
}
