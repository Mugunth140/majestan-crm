import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ calls: 0 }));
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
vi.mock("@/lib/permissions", () => ({ canViewPropertyContacts: () => false }));

import { PropertyForm } from "./PropertyForm";

function render(propertyType: string, listingType = "Sell", extras = {}) {
  state.calls = 0;
  return renderToStaticMarkup(createElement(PropertyForm, {
    mode: "edit",
    initialData: { id: 7, title: "Property", propertyType, listingType, price: 100000, propertyDetails: {}, ...extras },
  }));
}

beforeEach(() => { state.calls = 0; });

describe("Rendered property type forms", () => {
  it.each(["apartment", "villa", "individual_portion", "plot", "farmland", "commercial", "coworking", "industrial"])("renders the existing fields for %s", (type) => {
    const markup = render(type);
    expect(markup).toContain(type === "coworking" ? "Monthly rent *" : "Sale price *");
    expect(markup).toContain("Documents");
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
    expect(markup).toContain(">Topography</label>");
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
    expect(fieldLabels(pg)).toEqual(fieldLabels(apartment));
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
    expect(markup.includes('value="6500.50"')).toBe(true);
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
