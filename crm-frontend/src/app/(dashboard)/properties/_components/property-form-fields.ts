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
  reraNumber: { listing: "Buy" },
  rentPerSqft: { types: ALL.filter((type) => type !== "coworking"), listing: "Rent" },
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
  tenantOccupied: { types: BUILDINGS, listing: "Rent" },
  bookingAmount: { listing: "Buy" },
  expectedSalePrice: { types: ALL.filter((type) => !["commercial", "industrial", "villa"].includes(type)), listing: "Buy" },
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
  floorsOccupied: { types: [] },
  hasRestroom: { types: ["coworking"] },
  floorPlans: { types: ALL },
  roomDimensions: { types: HOMES },
  amenityIds: { types: BUILDINGS },
  furnishingItemIds: { types: [...HOMES, "coworking"] },
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
  udsArea: { types: ["apartment", "commercial"] },
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
  furnishingStatus = "",
): boolean {
  if (propertyType === "coworking" && ["documentsVerification", "documentUploads", "verificationStatus", "ownershipTitleVerified", "encumbranceCertificate", "rentalAgreementDraft", "tslrFmb", "taxReceipt", "ebReceipt", "pattaChitta", "approvals", "hypothecation", "financeFacing", "fundedBy", "deviation", "areaSqft", "openSides", "availableFrom", "handoverDate", "possessionStatus"].includes(field)) return false;
  if (field === "accessibility" && propertyType === "commercial") return listingType === "Rent";
  if (field === "specialPurpose") return propertyType === "commercial" && listingType === "Rent";
  if (propertyType === "commercial" && listingType === "Rent") {
    if (["constructionDate", "documentRequire"].includes(field)) return false;
    if (["conferenceRoom", "privateCabins", "seater"].includes(field)) return ["fullyfurnished", "semifurnished"].includes(furnishingStatus.toLowerCase().replace(/[^a-z]/g, ""));
  }
  if (propertyType === "farm_house") {
    const agricultural = ["plotSizeCents", "zoning", "plotNos", "plotType", "sfNumber", "landType", "waterSources", "boundaryWall", "plotLength", "plotWidth", "topography", "soilType", "irrigation", "fencing", "cropSuitability", "existingPlantation", "boreWell", "boreWellCount", "storageTank", "pattaChitta"];
    return isPropertyFieldVisible(field, agricultural.includes(field) ? "farmland" : "individual_portion", listingType, tenantOccupied, furnishingStatus);
  }
  if (field === "furnishingItemIds") {
    const normalized = furnishingStatus.toLowerCase().replace(/[^a-z]/g, "");
    if (!["fullyfurnished", "semifurnished"].includes(normalized)) return false;
  }
  if (["openSides", "topography", "fencing", "plotLength", "plotWidth"].includes(field) && propertyType === "plot") return false;
  if (["plotSizeCents", "zoning"].includes(field) && propertyType === "farmland") return false;
  if (["availableVisitTime", "blueprintLayout"].includes(field)) return false;
  if (["plotArea", "builtUpArea", "carpetArea"].includes(field) && propertyType === "industrial") return true;
  if (["containerAccess", "laborRooms", "toilets"].includes(field)) return propertyType === "industrial";
  if (field === "plotBoundaries") return propertyType === "plot";
  if (field === "boreWellCount") return propertyType === "farmland";
  if (field === "amenityIds" && propertyType === "plot") return true;
  if (field === "pricePerSqft" && ["plot", "individual_portion", "investment_property"].includes(propertyType)) return listingType === "Buy";
  if (listingType === "Rent" && ["builderName", "projectName"].includes(field)) {
    return ["apartment", "villa"].includes(propertyType);
  }
  const fieldType = propertyType === "investment_property" ? "individual_portion"
    : propertyType === "pg_service_apartment" ? "apartment" : propertyType;
  if (field === "areaSqft" && (fieldType === "villa" || (fieldType === "apartment" && listingType === "Rent"))) return false;
  if (["possessionStatus", "superBuiltUpArea"].includes(field) && fieldType === "apartment" && listingType === "Rent") return false;
  if (field === "noOfLifts") return fieldType === "commercial" || (fieldType === "apartment" && listingType === "Rent");
  if (field === "parking") return fieldType === "apartment" && listingType === "Rent";
  if (field === "numberOfPortions") return fieldType === "individual_portion";
  if (["plotFacing", "hasGroundFloor"].includes(field)) return fieldType === "villa";
  if (field === "monthlyRent" && fieldType === "commercial") return listingType === "Buy";
  if (field === "pricePerSqft" && fieldType === "villa") return listingType === "Buy";
  if (field === "fundedBy") return listingType === "Buy";
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
  furnishingStatus = "",
): Record<string, unknown> {
  return Object.fromEntries(Object.entries(payload).filter(([field]) =>
    isPropertyFieldVisible(field, propertyType, listingType, tenantOccupied, furnishingStatus),
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
  farm_house: "Farm House details",
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

export function isPropertyTypeAllowed(value: string, listingType: string, label = ""): boolean {
  if (isRemovedPropertyType(value) || isRemovedPropertyType(label)) return false;
  if (listingType === "Rent" && label.toLowerCase().replace(/[^a-z0-9]/g, "") === "farmhouse") return false;
  const normalized = value.toLowerCase().replace(/[^a-z0-9]/g, "");
  return listingType === "Rent" ? !["farmland", "farmhouse", "investmentproperty"].includes(normalized) : !isRentalOnlyPropertyType(value);
}

export function propertyTypesForListing<T extends { value: string; label: string }>(
  types: T[], listingType: string,
): T[] {
  return types.filter((type) => isPropertyTypeAllowed(type.value, listingType, type.label));
}
