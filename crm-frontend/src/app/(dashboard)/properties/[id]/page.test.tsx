import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ calls: 0, property: {} as Record<string, unknown> }));
vi.mock("react", async (original) => {
  const react = await original<typeof import("react")>();
  return { ...react, useState: (initial: unknown) => {
    const index = state.calls++;
    return react.useState(index === 0 ? state.property : index === 1 ? false : initial);
  } };
});
vi.mock("next/navigation", () => ({ useParams: () => ({ id: "7" }), useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/components/layout/mobile-header", () => ({ MobileHeader: () => null }));
vi.mock("@/lib/permissions", () => ({ canViewPropertyContacts: () => false }));
import PropertyViewPage from "./page";

function render(propertyType: string, listingType: string, extras = {}) {
  state.calls = 0;
  state.property = {
    id: 7, title: "Property", propertyType, listingType, price: 8000000,
    expectedSalePrice: 9000000, pricePerSqft: 6500, securityDeposit: "3 Months", lockInPeriod: "3 Years",
    propertyDetails: { bedrooms: 2, bathrooms: 2, furnished: true, furnishingStatus: "FULLY FURNISHED" },
    ...extras,
  };
  return renderToStaticMarkup(createElement(PropertyViewPage));
}

describe("Commercial and industrial property details", () => {
  it.each(["commercial", "industrial"])("hides home specs and shows the sale rate for %s", (type) => {
    const markup = render(type, "Sell");
    expect(markup).toContain("Sqft Price");
    expect(markup).toContain("6,500");
    for (const label of ["Expected Sale Price", "Bedrooms", "Bathrooms", "Security Deposit", "Lock-in Period"]) {
      expect(markup).not.toContain(`>${label}</span>`);
    }
    if (type === "industrial") {
      expect(markup).not.toContain(">Furnished</span>");
      expect(markup).not.toContain(">Furnishing Status</span>");
    }
  });
  it.each(["commercial", "industrial"])("keeps rental terms on %s rentals without home specs", (type) => {
    const markup = render(type, "Rent");
    expect(markup).toContain(">Security Deposit</span>");
    expect(markup).toContain(">Lock-in Period</span>");
    expect(markup).not.toContain(">Bedrooms</span>");
    expect(markup).not.toContain(">Bathrooms</span>");
    expect(markup).not.toContain(">Sqft Price</span>");
  });
});


describe("Rental property details", () => {
  it.each(["apartment", "villa", "individual_portion", "commercial", "industrial", "coworking", "pg_service_apartment"])("hides irrelevant legacy fields for %s", (type) => {
    const markup = render(type, "Rent", { price: 30000, reraNumber: "Legacy RERA", builderName: "Builder", projectName: "Project", propertyDetails: { areaSqft: 1200, rentPerSeat: 5000 } });
    expect(markup).not.toContain("RERA Number");
    expect(markup.includes(">Builder Name</span>")).toBe(["apartment", "villa"].includes(type));
    expect(markup.includes(">Project Name</span>")).toBe(["apartment", "villa"].includes(type));
    if (type === "coworking") {
      expect(markup).not.toContain("Rent per sqft");
      expect(markup).toContain("Rent / Seat");
    } else {
      expect(markup).toContain("Rent per sqft");
      expect(markup).toContain("₹25.00 / sqft / month");
    }
  });
  it("keeps RERA and project information on sales", () => {
    const markup = render("commercial", "Sell", { reraNumber: "Registered", builderName: "Builder", projectName: "Project" });
    expect(markup).toContain("RERA Number");
    expect(markup).toContain("Builder Name");
    expect(markup).toContain("Project Name");
    expect(markup).not.toContain("Rent per sqft");
  });
});

describe("Updated industrial and land details", () => {
  it("displays the selected Plot price unit and boundaries without removed fields", () => {
    const markup = render("plot", "Sell", { pricePerSqft: 100, propertyDetails: { areaSqft: 4800, plotNos: 2, zoning: "Residential Plot", topography: "Old value", fencing: "Old value", openSides: 3, plotLength: 40, plotWidth: 60, measurementUnits: { pricePerSqft: "Grounds" } } });
    expect(markup.includes("Price per ground")).toBe(true);
    expect(markup.includes("2.40 L")).toBe(true);
    expect(markup.includes("Total Project Area")).toBe(true);
    expect(markup.includes("No of Plots")).toBe(true);
    expect(markup.includes("Plot boundary preview")).toBe(true);
    for (const label of ["Open Sides", "Topography", "Fencing", "Plot Length", "Plot Width"]) expect(markup.includes(`>${label}</span>`)).toBe(false);
  });
  it("shows Industrial additions and omits obsolete visit/layout fields", () => {
    const markup = render("industrial", "Sell", { availableVisitTime: "Morning", propertyDetails: { containerAccess: "40 ft", laborRooms: 3, toilets: 5, plotArea: 4800, measurementUnits: { plotArea: "Grounds" }, blueprintLayout: "Available" } });
    for (const label of ["Container Access", "No of Labor Rooms", "No of Toilets", "2 Grounds"]) expect(markup.includes(label)).toBe(true);
    expect(markup.includes("Available Visit Time")).toBe(false);
    expect(markup.includes("Blueprint / Layout")).toBe(false);
  });
  it("shows Farm House home and agricultural values together", () => {
    const markup = render("farm_house", "Sell", { propertyDetails: { bedrooms: 3, cropSuitability: "Coffee", existingPlantation: "Coffee Plantation (Robusta / Arabica)", boreWell: true, boreWellCount: 2, plotArea: 43560, measurementUnits: { plotArea: "Acres" } } });
    for (const label of ["Bedrooms", "Coffee Plantation", "No of Borewells", "1 Acres"]) expect(markup.includes(label)).toBe(true);
  });
});

describe("Commercial rental and coworking details", () => {
  it("uses furnished status for commercial rental counts", () => {
    const extras = { propertyDetails: { furnishingStatus: "UNFURNISHED", conferenceRoom: 2, privateCabins: 3, seater: 10, specialPurpose: "Gym / Fitness Center", accessibility: "Inside Colony", constructionDate: "2020", documentRequire: "Available" } };
    const markup = render("commercial", "Rent", extras);
    for (const label of ["No of Conference Hall", "No of Cabins", "No of Seaters", "Construction Date", "Documents Required"]) expect(markup.includes(`>${label}</span>`)).toBe(false);
    expect(markup.includes("Gym / Fitness Center")).toBe(true);
    expect(markup.includes("Inside Colony")).toBe(true);
    expect(render("commercial", "Rent", { propertyDetails: { ...extras.propertyDetails, furnishingStatus: "FULLY FURNISHED" } }).includes("No of Conference Hall")).toBe(true);
  });
  it("hides coworking verification and general documents without hiding plans", () => {
    const markup = render("coworking", "Rent", { availableFrom: "2026-12-01", documents: [{ fileKey: "legal.pdf", documentType: "legal_document", fileName: "Legal file" }], propertyDetails: { areaSqft: 1200, openSides: 3, possessionStatus: "Ready" } });
    for (const label of ["Area", "Open Sides", "Possession Status", "Available From"]) expect(markup.includes(`>${label}</span>`)).toBe(false);
    expect(markup.includes("Documents &amp; Verification")).toBe(false);
    expect(markup.includes(">Verification<")).toBe(false);
    expect(markup.includes("Legal file")).toBe(false);
  });
});

it.each(["apartment", "villa", "individual_portion", "commercial", "industrial", "coworking", "pg_service_apartment"])("hides preserved sale-only values on %s rental details", (type) => {
  const markup = render(type, "Rent", { bookingAmount: "100000", monthlyRent: 25000, hypothecation: "Yes", deviation: "Legacy note", tslrFmb: "Available", pattaChitta: "Available" });
  for (const label of ["Booking Amount", "Monthly Rent", "Hypothecation", "Deviation", "TSLR / FMB", "Patta / Chitta"]) {
    expect(markup).not.toContain(`>${label}</span>`);
  }
});
