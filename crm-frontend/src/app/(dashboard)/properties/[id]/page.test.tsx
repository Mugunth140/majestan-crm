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

function render(propertyType: string, listingType: string) {
  state.calls = 0;
  state.property = {
    id: 7, title: "Property", propertyType, listingType, price: 8000000,
    expectedSalePrice: 9000000, pricePerSqft: 6500, securityDeposit: "3 Months", lockInPeriod: "3 Years",
    propertyDetails: { bedrooms: 2, bathrooms: 2, furnished: true, furnishingStatus: "FULLY FURNISHED" },
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
