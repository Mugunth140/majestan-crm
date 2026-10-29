/** Shared by rendering, validation and submission. Existing fields stay in the
 * draft when hidden; the API receives only fields relevant to this selection. */
const HOMES = ["apartment", "villa", "individual_portion"];
const LAND = ["plot", "farmland"];
const BUILDINGS = [...HOMES, "commercial", "coworking", "industrial"];
const FURNISHABLE = [...HOMES, "commercial", "coworking"];
const ALL = [...BUILDINGS, ...LAND];

type FieldRule = {
  types?: readonly string[];
  listing?: "Buy" | "Rent";
  occupiedSale?: boolean;
};

export const PROPERTY_FIELD_RULES: Record<string, FieldRule> = {
  propertyCondition: { types: BUILDINGS, listing: "Buy" },
  projectName: { types: ALL.filter((type) => type !== "farmland") },
  builderName: { types: ALL.filter((type) => type !== "farmland") },
  transactionType: { listing: "Buy" },
  handoverDate: { types: BUILDINGS, listing: "Buy" },
  ownershipType: { listing: "Buy" },
  modeOfPayment: { listing: "Buy" },
  hypothecation: { listing: "Buy" },
  financeFacing: { listing: "Buy" },
  tslrFmb: { listing: "Buy" },
  saleType: { listing: "Buy" },
  tenantOccupied: { types: BUILDINGS, listing: "Buy" },
  bookingAmount: { listing: "Buy" },
  expectedSalePrice: { types: ALL.filter((type) => !["commercial", "industrial"].includes(type)), listing: "Buy" },
  pricePerSqft: { types: ["commercial", "industrial"], listing: "Buy" },
  monthlyRent: { types: BUILDINGS, listing: "Buy", occupiedSale: true },
  maintenanceCharges: { types: BUILDINGS },
  securityDeposit: { listing: "Rent" },
  lockInPeriod: { listing: "Rent" },
  registrationCharge: { listing: "Buy" },
  timeForRegistration: { listing: "Buy" },
  bedrooms: { types: HOMES },
  bathrooms: { types: HOMES },
  furnished: { types: FURNISHABLE },
  furnishingStatus: { types: FURNISHABLE },
  floorFacing: { types: ["apartment", "individual_portion", "commercial", "coworking"] },
  propertyAge: { types: BUILDINGS },
  possessionStatus: { types: BUILDINGS },
  suitableFor: { types: HOMES, listing: "Rent" },
  floorNumber: { types: ["apartment", "individual_portion", "commercial", "coworking"] },
  totalFloors: { types: BUILDINGS },
  guestParking: { types: HOMES },
  parkingType: { types: HOMES },
  floorsOccupied: { types: ["commercial"] },
  hasRestroom: { types: ["coworking"] },
  floorPlans: { types: ALL },
  roomDimensions: { types: HOMES },
  amenityIds: { types: BUILDINGS },
  furnishingItemIds: { types: FURNISHABLE },
  rentalAgreementDraft: { listing: "Rent" },
  ebReceipt: { types: BUILDINGS },
  pattaChitta: { types: LAND, listing: "Buy" },
  deviation: { types: BUILDINGS, listing: "Buy" },
  rentalYield: { types: BUILDINGS, listing: "Buy" },
  unitType: { types: HOMES },
  unitNumber: { types: HOMES },
  numberOfFlats: { types: ["apartment"] },
  towerNos: { types: ["apartment", "commercial"] },
  superBuiltUpArea: { types: ["apartment"] },
  udsArea: { types: ["apartment"] },
  plotArea: { types: ["villa", "individual_portion", "commercial"] },
  architecturalStyle: { types: ["villa", "individual_portion"] },
  availablePortion: { types: ["individual_portion"] },
  plotNos: { types: ["plot"] },
  plotType: { types: ["plot"] },
  soilType: { types: ["farmland"] },
  irrigation: { types: ["farmland"] },
  rentPerSeat: { types: ["coworking"], listing: "Rent" },
  minSeats: { types: ["coworking"], listing: "Rent" },
  advanceRent: { types: ["coworking"], listing: "Rent" },
  leaseTerm: { types: ["coworking"], listing: "Rent" },
  incrementalRent: { types: ["coworking"], listing: "Rent" },
};

export function isPropertyFieldVisible(
  field: string,
  propertyType: string,
  listingType: string,
  tenantOccupied = "",
): boolean {
  const fieldType = propertyType === "investment_property" ? "individual_portion"
    : propertyType === "pg_service_apartment" ? "apartment" : propertyType;
  const rule = PROPERTY_FIELD_RULES[field];
  if (!rule) return true;
  if (rule.listing === "Buy" && isRentalOnlyPropertyType(propertyType)) return false;
  if (rule.types && !rule.types.includes(fieldType)) return false;
  if (rule.listing && rule.listing !== listingType) return false;
  return !rule.occupiedSale || tenantOccupied === "Yes";
}

export function curatePropertyPayload(
  payload: Record<string, unknown>,
  propertyType: string,
  listingType: string,
  tenantOccupied = "",
): Record<string, unknown> {
  return Object.fromEntries(Object.entries(payload).filter(([field]) =>
    isPropertyFieldVisible(field, propertyType, listingType, tenantOccupied),
  ));
}

export const PROPERTY_TYPE_LABELS: Record<string, string> = {
  apartment: "Apartment details",
  pg_service_apartment: "PG / Service Apartment details",
  villa: "Villa details",
  individual_portion: "Individual portion details",
  investment_property: "Investment Property details",
  plot: "Plot details",
  farmland: "Farmland details",
  commercial: "Commercial space details",
  coworking: "Coworking space details",
  industrial: "Industrial property details",
};

/** The master registry can contain old labels/aliases. PG/co-living is excluded. */
export function isRemovedPropertyType(value: string): boolean {
  return ["pg", "coliving", "pgcoliving", "payingguest", "payingguests"].includes(
    value.toLowerCase().replace(/[^a-z0-9]/g, ""),
  );
}

export function isRentalOnlyPropertyType(value: string): boolean {
  return ["coworking", "pgserviceapartment"].includes(value.toLowerCase().replace(/[^a-z0-9]/g, ""));
}

export function isPropertyTypeAllowed(value: string, listingType: string): boolean {
  if (isRemovedPropertyType(value)) return false;
  return listingType === "Rent" ? !["farmland", "investment_property"].includes(value) : !isRentalOnlyPropertyType(value);
}

export function propertyTypesForListing<T extends { value: string; label: string }>(
  types: T[], listingType: string,
): T[] {
  return types.filter((type) => !isRemovedPropertyType(type.label) && isPropertyTypeAllowed(type.value, listingType));
}
