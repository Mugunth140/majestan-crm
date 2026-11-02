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
  rentPerSqft: {
    types: ALL.filter((type) => type !== "coworking"),
    listing: "Rent",
  },
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
  floorFacing: {
    types: ["apartment", "individual_portion", "commercial", "coworking"],
  },
  propertyAge: { types: BUILDINGS },
  possessionStatus: { types: BUILDINGS },
  suitableFor: { types: HOMES, listing: "Rent" },
  floorNumber: {
    types: ["apartment", "individual_portion", "commercial", "coworking"],
  },
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
  propertyType: string | null | undefined,
  listingType: string,
  tenantOccupied = "",
  furnishingStatus: string | null | undefined = "",
): boolean {
  // Single-select controls can emit null when cleared or reset. Treat these
  // values like an empty selection, including older drafts and API records.
  propertyType ??= "";
  furnishingStatus ??= "";
  if (propertyType === "pg_service_apartment") {
    if (field === "superBuiltUpArea") return true;
    if (["individualBathrooms", "attachedBathrooms", "negotiable", "taxes", "roadName", "roadAccess", "rentPerSqft", "unitType", "unitNumber", "numberOfFlats", "towerNos", "noOfLifts", "parking", "parkingType", "guestParking", "udsArea", "outdoorSpaces", "floorFacing", "propertyFacing", "openSides", "suitableFor", "securityDeposit", "maintenanceCharges", "lockInPeriod", "tenantOccupied", "roomDimensions", "furnishingItemIds", "approvals"].includes(field)) return false;
  }
  const residential = [
    "apartment",
    "villa",
    "individual_portion",
    "investment_property",
    "pg_service_apartment",
    "farm_house",
  ].includes(propertyType);
  const homeType =
    propertyType === "investment_property" || propertyType === "farm_house"
      ? "individual_portion"
      : propertyType === "pg_service_apartment"
        ? "apartment"
        : propertyType;
  const documentFields = [
    "documentsVerification",
    "documentUploads",
    "verificationStatus",
    "ownershipTitleVerified",
    "encumbranceCertificate",
    "rentalAgreementDraft",
    "tslrFmb",
    "taxReceipt",
    "ebReceipt",
    "pattaChitta",
    "hypothecation",
    "financeFacing",
    "fundedBy",
    "deviation",
  ];
  if (documentFields.includes(field)) {
    if (residential && listingType === "Rent") return false;
    if (propertyType === "farmland")
      return ["documentsVerification", "taxReceipt"].includes(field);
  }
  if (field === "areaSqft") return false;
  if (field === "landArea") return ["plot", "farmland"].includes(propertyType);
  if (field === "expectedSalePrice") return false;
  if (field === "pricePerSqft")
    return (
      listingType === "Buy" &&
      !!propertyType &&
      !isRentalOnlyPropertyType(propertyType)
    );
  if (field === "plotBoundaries" && propertyType === "commercial")
    return listingType === "Buy";
  if (field === "plotBoundaries" || field === "plotFacing")
    return [
      "plot",
      "farmland",
      "villa",
      "individual_portion",
      "investment_property",
      "farm_house",
    ].includes(propertyType);
  if (field === "hasGroundFloor")
    return [
      "villa",
      "individual_portion",
      "investment_property",
      "farm_house",
    ].includes(propertyType);
  if (["individualBathrooms", "attachedBathrooms"].includes(field))
    return residential;
  if (field === "numberOfPortions")
    return (
      homeType === "individual_portion" ||
      (propertyType === "commercial" && listingType === "Buy")
    );
  if (
    ["parking", "carParking", "bikeParking", "parkingType"].includes(field) &&
    (["apartment", "villa"].includes(propertyType) ||
      (propertyType === "commercial" && listingType === "Buy"))
  )
    return false;
  if (field === "expectedMonthlyRentPerSqft")
    return propertyType === "commercial" && listingType === "Buy";
  if (field === "parkingSpaces")
    return (
      ["apartment", "villa", "investment_property"].includes(propertyType) ||
      (propertyType === "commercial" && listingType === "Buy")
    );
  if (["totalRentPerMonth", "expectedRentPerMonth"].includes(field))
    return propertyType === "investment_property";
  if (
    [
      "propertyUses",
      "specialPurposes",
      "utilities",
      "passengerLifts",
      "serviceLifts",
    ].includes(field)
  )
    return propertyType === "commercial" && listingType === "Rent";
  if (["agricultureEb", "roadApproach", "storageTankCapacity"].includes(field))
    return ["farmland", "farm_house"].includes(propertyType);
  if (["powerSupplyCapacity", "hasCanteen"].includes(field))
    return propertyType === "industrial";
  if (["restroomCount", "hasFreeRefreshment"].includes(field))
    return propertyType === "coworking";
  if (field === "availableFloorNumbers")
    return (
      ["individual_portion", "investment_property"].includes(propertyType) &&
      listingType === "Rent"
    );
  if (field === "noOfLifts")
    return (
      homeType === "apartment" ||
      (propertyType === "commercial" && listingType === "Buy")
    );
  if (propertyType === "commercial" && field === "documentRequire")
    return false;
  if (
    propertyType === "commercial" &&
    listingType === "Rent" &&
    [
      "udsArea",
      "tenantMix",
      "elevatorAccess",
      "plotArea",
      "furnished",
      "propertyUse",
      "specialPurpose",
      "utilitiesProvided",
    ].includes(field)
  )
    return false;
  if (
    homeType === "apartment" &&
    listingType === "Rent" &&
    ["udsArea", "outdoorSpaces"].includes(field)
  )
    return false;
  if (
    propertyType === "farm_house" &&
    [
      "plotArea",
      "floorNumber",
      "unitNumber",
      "availablePortion",
      "reraNumber",
    ].includes(field)
  )
    return false;
  if (
    propertyType === "farmland" &&
    ["reraNumber", "boundaryWall"].includes(field)
  )
    return false;
  if (
    propertyType === "plot" &&
    listingType === "Rent" &&
    ["plotNos", "sfNumber"].includes(field)
  )
    return false;
  if (propertyType === "plot" && field === "suitableFor")
    return listingType === "Rent";
  if (propertyType === "plot" && field === "zoning") return true;
  if (
    homeType === "individual_portion" &&
    listingType === "Rent" &&
    field === "availablePortion"
  )
    return false;
  if (
    propertyType === "industrial" &&
    [
      "heavyVehicleAccess",
      "truckTrailerCount",
      "truckTrailerAccess",
      "ownershipProofVerified",
      "otherLegalClearance",
      "powerSupplyHp",
      "powerSupply2",
      "powerSupply3",
    ].includes(field)
  )
    return false;
  if (
    propertyType === "coworking" &&
    [
      "builtUpArea",
      "carpetArea",
      "leaseTerm",
      "monthlyRent",
      "incrementalRent",
      "electricityCharges",
    ].includes(field)
  )
    return false;
  if (
    propertyType === "coworking" &&
    [
      "documentsVerification",
      "documentUploads",
      "verificationStatus",
      "ownershipTitleVerified",
      "encumbranceCertificate",
      "rentalAgreementDraft",
      "tslrFmb",
      "taxReceipt",
      "ebReceipt",
      "pattaChitta",
      "approvals",
      "hypothecation",
      "financeFacing",
      "fundedBy",
      "deviation",
      "areaSqft",
      "openSides",
      "availableFrom",
      "handoverDate",
      "possessionStatus",
    ].includes(field)
  )
    return false;
  if (field === "accessibility" && propertyType === "commercial")
    return listingType === "Rent";
  if (field === "specialPurpose")
    return propertyType === "commercial" && listingType === "Rent";
  if (propertyType === "commercial" && listingType === "Rent") {
    if (["constructionDate", "documentRequire"].includes(field)) return false;
    if (["conferenceRoom", "privateCabins", "seater"].includes(field))
      return ["fullyfurnished", "semifurnished"].includes(
        furnishingStatus.toLowerCase().replace(/[^a-z]/g, ""),
      );
  }
  if (propertyType === "farm_house") {
    const agricultural = [
      "plotSizeCents",
      "zoning",
      "plotNos",
      "plotType",
      "sfNumber",
      "landType",
      "waterSources",
      "boundaryWall",
      "plotLength",
      "plotWidth",
      "topography",
      "soilType",
      "irrigation",
      "fencing",
      "cropSuitability",
      "existingPlantation",
      "boreWell",
      "boreWellCount",
      "storageTank",
      "pattaChitta",
    ];
    return isPropertyFieldVisible(
      field,
      agricultural.includes(field) ? "farmland" : "individual_portion",
      listingType,
      tenantOccupied,
      furnishingStatus,
    );
  }
  if (field === "furnishingItemIds") {
    const normalized = furnishingStatus.toLowerCase().replace(/[^a-z]/g, "");
    if (!["fullyfurnished", "semifurnished"].includes(normalized)) return false;
  }
  if (
    ["openSides", "topography", "fencing", "plotLength", "plotWidth"].includes(
      field,
    ) &&
    propertyType === "plot"
  )
    return false;
  if (
    ["plotSizeCents", "zoning"].includes(field) &&
    propertyType === "farmland"
  )
    return false;
  if (["availableVisitTime", "blueprintLayout"].includes(field)) return false;
  if (
    ["plotArea", "builtUpArea", "carpetArea"].includes(field) &&
    propertyType === "industrial"
  )
    return true;
  if (["containerAccess", "laborRooms", "toilets"].includes(field))
    return propertyType === "industrial";
  if (field === "boreWellCount") return propertyType === "farmland";
  if (field === "amenityIds" && propertyType === "plot") return true;
  if (
    listingType === "Rent" &&
    ["builderName", "projectName"].includes(field)
  ) {
    return ["apartment", "villa"].includes(propertyType);
  }
  const fieldType =
    propertyType === "investment_property"
      ? "individual_portion"
      : propertyType === "pg_service_apartment"
        ? "apartment"
        : propertyType;
  if (
    ["possessionStatus", "superBuiltUpArea"].includes(field) &&
    fieldType === "apartment" &&
    listingType === "Rent"
  )
    return false;
  if (field === "parking")
    return fieldType === "apartment" && listingType === "Rent";
  if (field === "monthlyRent" && fieldType === "commercial")
    return listingType === "Buy";
  if (field === "fundedBy") return listingType === "Buy";
  const rule = PROPERTY_FIELD_RULES[field];
  if (!rule) return true;
  if (rule.listing === "Buy" && isRentalOnlyPropertyType(propertyType))
    return false;
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
  return Object.fromEntries(
    Object.entries(payload).filter(([field]) =>
      isPropertyFieldVisible(
        field,
        propertyType,
        listingType,
        tenantOccupied,
        furnishingStatus,
      ),
    ),
  );
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
function propertyTypeKey(value: string | null | undefined): string {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function isRemovedPropertyType(
  value: string | null | undefined,
): boolean {
  return [
    "pg",
    "coliving",
    "pgcoliving",
    "payingguest",
    "payingguests",
  ].includes(propertyTypeKey(value));
}

export function isRentalOnlyPropertyType(
  value: string | null | undefined,
): boolean {
  return ["coworking", "pgserviceapartment"].includes(propertyTypeKey(value));
}

export function isPropertyTypeAllowed(
  value: string | null | undefined,
  listingType: string,
  label: string | null | undefined = "",
): boolean {
  const normalized = propertyTypeKey(value);
  if (
    !normalized ||
    /^farmhouse$/i.test(String(value ?? "").trim()) ||
    /^farmhouse$/i.test(String(label ?? "").trim())
  )
    return false;
  if (isRemovedPropertyType(value) || isRemovedPropertyType(label))
    return false;
  if (listingType === "Rent" && propertyTypeKey(label) === "farmhouse")
    return false;
  return listingType === "Rent"
    ? !["farmland", "farmhouse", "investmentproperty"].includes(normalized)
    : !isRentalOnlyPropertyType(value);
}

export function propertyTypesForListing<
  T extends { value: string; label: string },
>(types: T[], listingType: string): T[] {
  return types.filter((type) =>
    isPropertyTypeAllowed(type.value, listingType, type.label),
  );
}
