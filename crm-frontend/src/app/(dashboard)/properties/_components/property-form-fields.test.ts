import { describe, expect, it } from "vitest";
import { curatePropertyPayload, isPropertyFieldVisible as visible, isPropertyTypeAllowed, propertyTypesForListing, PROPERTY_FIELD_RULES } from "./property-form-fields";

const types = ["apartment", "villa", "individual_portion", "plot", "farmland", "commercial", "coworking", "industrial"];

describe("Property form curation", () => {
  it.each(types)("shows home fields only on residential types: %s", (type) => {
    const home = ["apartment", "villa", "individual_portion"].includes(type);
    for (const field of ["bedrooms", "bathrooms", "roomDimensions"]) {
      expect(visible(field, type, "Buy")).toBe(home);
    }
  });

  it("distinguishes apartments, villas and individual portions", () => {
    expect(visible("numberOfFlats", "apartment", "Buy")).toBe(true);
    expect(visible("udsArea", "apartment", "Buy")).toBe(true);
    expect(visible("plotArea", "apartment", "Buy")).toBe(false);
    expect(visible("numberOfFlats", "villa", "Buy")).toBe(false);
    expect(visible("udsArea", "villa", "Buy")).toBe(false);
    expect(visible("plotArea", "villa", "Buy")).toBe(true);
    expect(visible("availablePortion", "villa", "Rent")).toBe(false);
    expect(visible("availablePortion", "individual_portion", "Rent")).toBe(true);
  });

  it("separates agricultural and plotted development fields", () => {
    for (const field of ["soilType", "irrigation"]) {
      expect(visible(field, "plot", "Buy")).toBe(false);
      expect(visible(field, "farmland", "Buy")).toBe(true);
    }
    expect(visible("plotNos", "farmland", "Buy")).toBe(false);
    expect(visible("projectName", "plot", "Buy")).toBe(true);
    expect(visible("projectName", "farmland", "Buy")).toBe(false);
  });

  it.each(types)("separates sale and rental financial fields: %s", (type) => {
    for (const field of ["bookingAmount", "expectedSalePrice", "registrationCharge", "timeForRegistration", "saleType", "ownershipType", "modeOfPayment", "hypothecation", "financeFacing", "tslrFmb"]) {
      expect(visible(field, type, "Buy")).toBe(type !== "coworking" && (field !== "expectedSalePrice" || !["commercial", "industrial"].includes(type)));
      expect(visible(field, type, "Rent")).toBe(false);
    }
    for (const field of ["securityDeposit", "lockInPeriod", "rentalAgreementDraft"]) {
      expect(visible(field, type, "Buy")).toBe(false);
      expect(visible(field, type, "Rent")).toBe(true);
    }
  });

  it("shows one monthly rent input for rentals and current rent for occupied sales", () => {
    expect(visible("monthlyRent", "commercial", "Rent")).toBe(false);
    expect(visible("monthlyRent", "commercial", "Buy", "No")).toBe(false);
    expect(visible("monthlyRent", "commercial", "Buy", "Yes")).toBe(true);
    expect(visible("monthlyRent", "plot", "Buy", "Yes")).toBe(false);
  });

  it("does not show residential furnishings on industrial property", () => {
    expect(visible("furnishingItemIds", "industrial", "Rent")).toBe(false);
    expect(visible("furnishingStatus", "industrial", "Rent")).toBe(false);
    expect(visible("amenityIds", "industrial", "Rent")).toBe(true);
    expect(visible("furnishingItemIds", "coworking", "Rent")).toBe(true);
  });

  it("keeps hidden values in state while omitting them from requests", () => {
    const state = { bedrooms: 4, numberOfFlats: 120, plotArea: "2400", securityDeposit: "3 Months", price: 9000000, documents: [] };
    expect(curatePropertyPayload(state, "villa", "Buy")).toEqual({ bedrooms: 4, plotArea: "2400", price: 9000000, documents: [] });
    expect(curatePropertyPayload(state, "apartment", "Rent")).toEqual({ bedrooms: 4, numberOfFlats: 120, securityDeposit: "3 Months", price: 9000000, documents: [] });
    expect(state.numberOfFlats).toBe(120);
    expect(state.securityDeposit).toBe("3 Months");
  });

  it("does not offer specific building fields before selecting a property type", () => {
    expect(visible("bedrooms", "", "Buy")).toBe(false);
    expect(visible("furnishingItemIds", "", "Buy")).toBe(false);
  });
});

describe("Property types by listing", () => {
  const masterTypes = [...types, "pg", "co_living", "pg_coliving"].map((value) => ({ value, label: value }));
  it("only offers coworking for rentals and excludes PG/co-living entirely", () => {
    expect(propertyTypesForListing(masterTypes, "Buy").map((type) => type.value)).toEqual(types.filter((type) => type !== "coworking"));
    expect(propertyTypesForListing(masterTypes, "Rent").map((type) => type.value)).toEqual(types.filter((type) => type !== "farmland"));
    expect(propertyTypesForListing([{ value: "custom", label: "PG / Co living" }], "Rent")).toEqual([]);
  });
  it("detects incompatible selections when switching listing types or restoring drafts", () => {
    expect(isPropertyTypeAllowed("coworking", "Buy")).toBe(false);
    expect(isPropertyTypeAllowed("coworking", "Rent")).toBe(true);
    expect(isPropertyTypeAllowed("farmland", "Rent")).toBe(false);
    expect(isPropertyTypeAllowed("commercial", "Buy")).toBe(true);
    expect(isPropertyTypeAllowed("commercial", "Rent")).toBe(true);
  });
  it("omits stale sale values from coworking requests in either listing mode", () => {
    const values = { ownershipType: "Freehold", modeOfPayment: "Full Account", handoverDate: "2027-01-01", expectedSalePrice: 300000, rentPerSeat: 6000 };
    expect(curatePropertyPayload(values, "coworking", "Rent")).toEqual({ rentPerSeat: 6000 });
    expect(curatePropertyPayload(values, "coworking", "Buy")).toEqual({});
  });
});

describe("Investment Property", () => {
  it("is offered under Buy only", () => {
    const types = [{ value: "investment_property", label: "Investment Property" }];
    expect(propertyTypesForListing(types, "Buy")).toEqual(types);
    expect(propertyTypesForListing(types, "Rent")).toEqual([]);
  });
  it("uses exactly the Independent House field profile", () => {
    for (const field of Object.keys(PROPERTY_FIELD_RULES)) {
      for (const occupied of ["", "No", "Yes"]) {
        expect(visible(field, "investment_property", "Buy", occupied), field).toBe(visible(field, "individual_portion", "Buy", occupied));
      }
    }
  });
});

describe("PG / Service Apartment", () => {
  it("appears under Rent only without restoring the removed PG/co-living category", () => {
    const option = { value: "pg_service_apartment", label: "PG / Service Apartment" };
    expect(propertyTypesForListing([option], "Rent")).toEqual([option]);
    expect(propertyTypesForListing([option], "Buy")).toEqual([]);
    expect(propertyTypesForListing([{ value: "pg", label: "PG / Co living" }], "Rent")).toEqual([]);
  });
  it("uses exactly the Apartment rental field profile", () => {
    for (const field of Object.keys(PROPERTY_FIELD_RULES)) {
      expect(visible(field, "pg_service_apartment", "Rent"), field).toBe(visible(field, "apartment", "Rent"));
    }
  });
});
