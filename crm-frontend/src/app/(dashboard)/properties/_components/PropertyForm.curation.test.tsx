import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ calls: 0, contacts: false }));
vi.mock("react", async (original) => {
  const react = await original<typeof import("react")>();
  return {
    ...react,
    // SSR skips effects. Render the loaded form rather than its initial loader
    // by resolving its second state hook (form-data loading) for this test.
    useState: (initial: unknown) => react.useState(state.calls++ === 1 ? false : initial),
  };
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/components/layout/mobile-header", () => ({ MobileHeader: () => null }));
vi.mock("@/lib/permissions", () => ({ canViewPropertyContacts: () => state.contacts }));

import { PropertyForm } from "./PropertyForm";

function render(propertyType: string, listingType = "Sell", extras = {}) {
  state.calls = 0;
  return renderToStaticMarkup(createElement(PropertyForm, {
    mode: "edit",
    initialData: { id: 7, title: "Property", propertyType, listingType, price: 100000, propertyDetails: {}, ...extras },
  }));
}

beforeEach(() => { state.calls = 0; state.contacts = false; });

describe("Rendered property type forms", () => {
  it.each(["apartment", "villa", "individual_portion", "plot", "farmland", "commercial", "coworking", "industrial"])("renders the existing fields for %s", (type) => {
    const markup = render(type, type === "coworking" ? "Rent" : "Sell");
    expect(markup).toContain(type === "coworking" ? "Monthly rent *" : "Sale price *");
    expect(markup).toContain(type === "coworking" ? "Rent per Seat" : "Documents");
    expect(markup).not.toContain("Loading property");
  });

  it("keeps an older rental deposit visible after removing the duplicate input", () => {
    const markup = render("apartment", "Rent", { bookingAmount: "2 Lakhs" });
    expect(markup).toContain("2 Lakhs");
    expect(markup).not.toContain('name="bookingAmount"');
  });

  it("keeps commercial washrooms and offices without home bedrooms", () => {
    const markup = render("commercial");
    expect(markup).toContain("Shared Washrooms");
    expect(markup).toContain("Private Cabins");
    expect(markup).not.toContain(">Bedrooms</label>");
    expect(markup).not.toContain(">Bathrooms</label>");
    expect(markup).not.toContain(">Room Dimensions</h3>");
  });

  it("shows villa land area without apartment inventory fields", () => {
    const markup = render("villa");
    expect(markup).toContain("Villa details");
    expect(markup).toContain(">Plot Area</label>");
    expect(markup).toContain(">Bedrooms</label>");
    expect(markup).not.toContain("Number of Flats");
    expect(markup).not.toContain("UDS Area");
  });

  it("keeps plot projects with ground plans and without agricultural inputs", () => {
    const markup = render("plot");
    expect(markup).toContain(">Project Name</label>");
    expect(markup).not.toContain(">Topography</label>");
    expect(markup).not.toContain(">Soil Type</label>");
    expect(markup).not.toContain(">Irrigation Facilities</label>");
    expect(markup).not.toContain("Add floor plans");
    expect(markup).toContain("Add ground plans");
    expect(markup).toContain("Ground plans");
  });

  it("shows one rental deposit and rent field without sale pricing", () => {
    const markup = render("apartment", "Rent");
    expect(markup).toContain("Monthly rent *");
    expect(markup.match(/>Security Deposit<\/label>/g)).toHaveLength(1);
    expect(markup).not.toContain(">Monthly Rent</label>");
    expect(markup).not.toContain(">Booking Amount</label>");
    expect(markup).not.toContain(">Expected Sale Price</label>");
    expect(markup).not.toContain(">Registration Charge</label>");
    expect(markup).toContain("Rental Agreement Draft");
    expect(markup).toContain("Property type is fixed for an existing listing.");
  });
});

describe("Rental-only form content", () => {
  it.each(["coworking", "commercial", "industrial", "apartment", "villa", "individual_portion", "plot"])("keeps sale-only fields out of %s rentals", (type) => {
    const markup = render(type, "Rent", { hypothecation: "Yes", modeOfPayment: "Full Account" });
    for (const label of ["Mode of Payment", "Ownership Type", "Handover Date", "Hypothecation", "Finance", "Sale Type (Full/Partial)", "Transaction Type", "Booking Amount", "Expected Sale Price", "Registration Charge", "Time for Registration"]) {
      expect(markup).not.toContain(`>${label}</label>`);
    }
    expect(markup).toContain("Security Deposit");
    if (type === "coworking") expect(markup).toContain("Rent per Seat");
  });
  it.each(["plot", "farmland"])("uses ground plan labels for %s", (type) => {
    const markup = render(type);
    expect(markup).toContain("Ground plans");
    expect(markup).toContain("Choose ground plan files");
    expect(markup).not.toContain("Floor plans");
  });
});

describe("Investment Property form", () => {
  it("renders the Independent House fields with its own section title", () => {
    const independent = render("individual_portion");
    const investment = render("investment_property");
    const fieldLabels = (markup: string) => markup.match(/<label[^>]*>[\s\S]*?<\/label>/g);
    expect(fieldLabels(investment)).toEqual(fieldLabels(independent));
    expect(investment).toContain("Investment Property details");
    expect(investment).toContain("Available Portion");
    expect(investment).toContain("Plot Area");
    expect(investment).toContain("Sale price *");
  });
});

describe("PG / Service Apartment form", () => {
  it("renders the Apartment rental fields with the new category name", () => {
    const apartment = render("apartment", "Rent");
    const pg = render("pg_service_apartment", "Rent");
    const fieldLabels = (markup: string) => markup.match(/<label[^>]*>[\s\S]*?<\/label>/g);
    expect(fieldLabels(pg)).toEqual(fieldLabels(apartment)?.filter((label) => !/Builder Name|Project Name/.test(label)));
    expect(pg).toContain("PG / Service Apartment details");
    expect(pg).toContain("Monthly rent *");
    expect(pg).toContain("Security Deposit");
    expect(pg).not.toContain("Sale price *");
    expect(pg).not.toContain("Expected Sale Price");
  });
});

describe("Commercial and industrial pricing and specifications", () => {
  it.each(["commercial", "industrial"])("uses Sqft Price on %s sales without residential fields or rental terms", (type) => {
    const markup = render(type, "Sell", {
      pricePerSqft: "6500.50", expectedSalePrice: "8000000", securityDeposit: "3 Months", lockInPeriod: "3 Years",
      propertyDetails: { bedrooms: 2, bathrooms: 2, furnished: true, furnishingStatus: "FULLY FURNISHED" },
    });
    expect(markup).toContain(">Sqft Price</label>");
    expect(Number(markup.match(/id="pf-pricePerSqft"[\s\S]*?<input[^>]*value="([^"]+)"/)?.[1])).toBe(6500.5);
    expect(markup).not.toContain(">Expected Sale Price</label>");
    expect(markup).not.toContain(">Bedrooms</label>");
    expect(markup).not.toContain(">Bathrooms</label>");
    expect(markup).not.toContain(">Security Deposit</label>");
    expect(markup).not.toContain(">Lock In Period</label>");
    if (type === "industrial") {
      expect(markup).not.toContain("Furnishing Status");
      expect(markup).not.toContain("Furnishing Items");
      expect(markup).not.toContain("Fully Furnished");
    }
  });
});


describe("Rental form fields", () => {
  it.each(["apartment", "villa", "individual_portion", "plot", "commercial", "coworking", "industrial", "pg_service_apartment"])("renders the requested fields for %s", (type) => {
    const markup = render(type, "Rent", { price: 30000, reraNumber: "Old RERA", builderName: "Builder", projectName: "Project", propertyDetails: { areaSqft: 1200 } });
    expect(markup).not.toContain("RERA Number");
    expect(markup.includes(">Builder Name</label>")).toBe(["apartment", "villa"].includes(type));
    expect(markup.includes(">Project Name</label>")).toBe(["apartment", "villa"].includes(type));
    if (type === "coworking") {
      expect(markup).toContain("Rent per Seat");
      expect(markup).not.toContain("Rent per sqft");
    } else {
      expect(markup).toContain("Rent per sqft");
      expect(markup).toContain('value="25.00"');
      expect(markup).toContain('readOnly=""');
    }
  });
});

describe("Calculated rental area units", () => {
  it("calculates from formatted monthly rent and converts square metres to square feet", () => {
    const markup = render("apartment", "Rent", { price: "30k", propertyDetails: { areaSqft: 111.483648, areaUnit: "Sq M" } });
    expect(markup.includes('value="25.00"')).toBe(true);
    expect(markup.includes('readOnly=""')).toBe(true);
  });
});

describe("Fine-grained property requirements", () => {
  it("merges apartment rental specifications and plans without removed fields", () => {
    const markup = render("apartment", "Rent");
    for (const label of ["Area", "Possession Status", "Super Built Up Area"]) expect(markup.includes(`>${label}</label>`)).toBe(false);
    expect(markup.includes(">No of Lifts</label>")).toBe(true);
    expect(markup.includes(">No of Parking</label>")).toBe(true);
    expect(markup.includes(">Details</h3>")).toBe(false);
    expect(markup.includes("Floor plans &amp; room dimensions")).toBe(true);
    expect(markup.includes('name="builtUpAreaUnit"')).toBe(true);
  });
  it("calculates Villa sale rate from built-up area, not plot area", () => {
    const markup = render("villa", "Sell", { price: 12000000, propertyDetails: { builtUpArea: 2000, plotArea: 5000 } });
    expect(markup.includes('value="6000.00"')).toBe(true);
    expect(markup.includes(">Expected Sale Price</label>")).toBe(false);
    expect(markup.includes(">Area</label>")).toBe(false);
    expect(markup.includes('name="plotAreaUnit"')).toBe(true);
    expect(markup.includes(">Plot Facing</label>")).toBe(true);
    expect(markup.includes("Includes ground floor")).toBe(true);
  });
  it("includes independent house portions", () => {
    expect(render("individual_portion").includes(">No of Portions</label>")).toBe(true);
  });
  it("shows commercial measurements and expected income without furnishing items or occupied floors", () => {
    const markup = render("commercial", "Sell");
    for (const field of ["plotArea", "builtUpArea", "carpetArea", "udsArea"]) expect(markup.includes(`name="${field}Unit"`)).toBe(true);
    expect(markup.includes("Expected Monthly Rent")).toBe(true);
    expect(markup.includes("Available Floor Number")).toBe(true);
    expect(markup.includes("Floors Occupied")).toBe(false);
    expect(markup.includes("Furnishing Items")).toBe(false);
  });
  it.each(["Buy", "Rent"])("shows tenant occupied only on Rent: %s", (listing) => {
    expect(render("apartment", listing === "Buy" ? "Sell" : "Rent").includes(">Tenant Occupied</label>")).toBe(listing === "Rent");
  });
  it("uses verification selects and conditional funding information", () => {
    const markup = render("villa", "Sell", { hypothecation: "Yes", financeFacing: "100000", propertyDetails: { fundedBy: "Bank" } });
    expect(markup.includes('name="ownershipTitleVerified"')).toBe(true);
    expect(markup.includes("Select approvals")).toBe(true);
    expect(markup.includes('name="fundedBy"')).toBe(true);
    expect(markup.includes("One Lakh") || markup.toLowerCase().includes("one lakh")).toBe(true);
    expect(render("villa", "Sell").includes('name="fundedBy"')).toBe(false);
  });
});

describe("Owner alternatives", () => {
  it("places all alternative contact fields with the owner", () => {
    state.contacts = true;
    const markup = render("industrial");
    const owner = markup.slice(markup.indexOf(">Owner</h3>"), markup.indexOf(">Agent</h3>"));
    for (const label of ["Alternative Name", "Alternative Phone", "Alternative Email"]) expect(owner.includes(label)).toBe(true);
  });
});

describe("Industrial, plot and farm requirements", () => {
  it("provides industrial measurements, dropdowns and new operational counts", () => {
    const markup = render("industrial", "Sell", { propertyDetails: { buildingType: "PEB / Steel Shed", propertyUse: "Logistics & Distribution, Cold Storage / Food Processing", floorType: "VDF (Vacuum Dewatered Concrete)", pollutionClearance: "Red", containerAccess: "40 ft", laborRooms: 3, toilets: 4 } });
    for (const field of ["plotArea", "builtUpArea", "carpetArea", "openArea"]) expect(markup.includes(`name="${field}Unit"`)).toBe(true);
    for (const label of ["Container Access", "No of Labor Rooms", "No of Toilets", "General Warehousing", "TNPCB CTO (Consent to Operate)"]) expect(markup.includes(label)).toBe(true);
    expect(markup.includes('name="buildingType"')).toBe(true);
    expect(markup.includes('name="floorType"')).toBe(true);
    expect(markup.includes('name="pollutionClearance"')).toBe(true);
    expect(markup.includes("Blueprint / Layout")).toBe(false);
    expect(markup.includes("Available Visit Time")).toBe(false);
  });
  it("renders four live plot boundaries and editable rate units", () => {
    const markup = render("plot", "Sell", { pricePerSqft: 100, propertyDetails: { measurementUnits: { pricePerSqft: "Grounds" }, plotBoundaries: [{ direction: "North East", length: 40, unit: "ft" }, { direction: "East", length: 50, unit: "ft" }, { direction: "South", length: 45, unit: "ft" }, { direction: "West", length: 60, unit: "ft" }] } });
    for (const label of ["Total Project Area", "No of Plots", "Plot boundaries", "Plot boundary preview", "North East", "Price per ground", "Amenities"]) expect(markup.includes(label)).toBe(true);
    expect(markup.includes('value="240000"')).toBe(true);
    for (const label of ["Open Sides", "Topography", "Fencing", "Plot Length", "Plot Width"]) expect(markup.includes(`>${label}</label>`)).toBe(false);
    expect(markup.includes('name="pricePerSqftUnit"')).toBe(true);
    expect((markup.match(/aria-label="Boundary [1-4] length"/g) || []).length).toBe(4);
  });
  it("curates farmland crops and only shows borewell count when checked", () => {
    const markup = render("farmland", "Sell", { propertyDetails: { boreWell: true, boreWellCount: 2, cropSuitability: "Coconut", existingPlantation: "Coconut Plantation" } });
    expect(markup.includes("No of Borewells")).toBe(true);
    expect(markup.includes('name="cropSuitability"')).toBe(true);
    expect(markup.includes('name="existingPlantation"')).toBe(true);
    expect(markup.includes(">Plot Size</label>")).toBe(false);
    expect(markup.includes(">Zoning / Usage</label>")).toBe(false);
    expect(render("farmland").includes("No of Borewells")).toBe(false);
  });
  it("combines home and agricultural fields for Farm House", () => {
    const markup = render("farm_house", "Sell");
    for (const label of ["Farm House details", "Bedrooms", "No of Portions", "Crop Suitability", "Existing Plantation", "Bore Well", "Room dimensions"]) expect(markup.includes(label)).toBe(true);
  });
  it.each(["FULLY FURNISHED", "SEMI FURNISHED", "UNFURNISHED", "BARESHELL", ""])("curates furnishing items for status %s", (status) => {
    const markup = render("apartment", "Sell", { propertyDetails: { furnishingStatus: status } });
    expect(markup.includes("Furnishing Items")).toBe(["FULLY FURNISHED", "SEMI FURNISHED"].includes(status));
    expect(render("industrial", "Sell", { propertyDetails: { furnishingStatus: status } }).includes("Furnishing Items")).toBe(false);
    expect(render("commercial", "Sell", { propertyDetails: { furnishingStatus: status } }).includes("Furnishing Items")).toBe(false);
  });
});

describe("Commercial Rent and Co-Working refinements", () => {
  it("offers commercial rental uses, special purpose and accessibility", () => {
    const markup = render("commercial", "Rent", { propertyDetails: { propertyUse: "Corporate Office", specialPurpose: "Gym / Fitness Center", accessibility: "On Road", constructionDate: "2022", documentRequire: "Old note" } });
    for (const name of ["propertyUse", "specialPurpose", "accessibility"]) expect(markup.includes(`name="${name}"`)).toBe(true);
    for (const label of ["Special Purpose", "Property Accessibility", "Corporate Office", "Gym / Fitness Center"]) expect(markup.includes(label)).toBe(true);
    expect(markup.includes("Construction Date")).toBe(false);
    expect(markup.includes("Documents Required")).toBe(false);
  });
  it.each(["FULLY FURNISHED", "SEMI FURNISHED", "UNFURNISHED", "BARESHELL", ""])("shows office counts only for furnished commercial rentals: %s", (status) => {
    const markup = render("commercial", "Rent", { propertyDetails: { furnishingStatus: status, conferenceRoom: 2, privateCabins: 3, seater: 10 } });
    for (const label of ["No of Conference Hall", "No of Cabins", "No of Seaters"]) expect(markup.includes(label)).toBe(["FULLY FURNISHED", "SEMI FURNISHED"].includes(status));
  });
  it("leaves commercial Buy controls available", () => {
    const markup = render("commercial", "Sell");
    expect(markup.includes("Construction Date")).toBe(true);
    expect(markup.includes("Documents Required")).toBe(true);
    expect(markup.includes("Special Purpose")).toBe(false);
    expect(markup.includes("Property Accessibility")).toBe(false);
  });
  it("hides coworking documents, verification and possession fields", () => {
    const markup = render("coworking", "Rent", { availableFrom: "2026-12-01", handoverDate: "2026-12-01", ownershipTitleVerified: "Yes", propertyDetails: { areaSqft: 1000, openSides: 3, possessionStatus: "Ready To Move" } });
    for (const label of ["Area", "Open Sides", "Possession Status", "Available From", "Handover Date"]) expect(markup.includes(`>${label}</label>`)).toBe(false);
    expect(markup.includes("Documents &amp; Verification")).toBe(false);
    expect(markup.includes(">Documents</h3>")).toBe(false);
    expect(markup.includes("Built Up Area")).toBe(true);
    expect(markup.includes("Floor plans")).toBe(true);
    expect(markup.includes("Rent per Seat")).toBe(true);
  });
});
