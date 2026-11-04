import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ calls: 0 }));
vi.mock("react", async (original) => {
  const r = await original<typeof import("react")>();
  return {
    ...r,
    useState: (initial: unknown) =>
      r.useState(state.calls++ === 1 ? false : initial),
  };
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
// The form's full-screen modal renders through a portal; render its body inline.
vi.mock("@/components/shared/focus-modal", async (original) => {
  const actual = await original<typeof import("@/components/shared/focus-modal")>();
  const { createElement: h } = await import("react");
  return { ...actual, FocusModal: ({ title, children, footer }: { title: unknown; children: unknown; footer: unknown }) => h("div", null, h("h1", null, title as never), children as never, footer as never) };
});
vi.mock("@/components/layout/mobile-header", () => ({
  MobileHeader: () => null,
}));
vi.mock("@/lib/permissions", () => ({ canViewPropertyContacts: () => true }));
import { PropertyForm } from "./PropertyForm";
function form(
  propertyType: string,
  listingType = "Sell",
  propertyDetails = {},
) {
  state.calls = 0;
  return renderToStaticMarkup(
    createElement(PropertyForm, {
      mode: "edit",
      initialData: {
        id: 7,
        title: "Synthetic property",
        propertyType,
        listingType,
        price: 5000000,
        propertyDetails,
      },
    }),
  );
}
function labels(markup: string) {
  return [...markup.matchAll(/<label[^>]*>([\s\S]*?)<\/label>/g)].map((m) =>
    m[1].replace(/<[^>]*>/g, "").trim(),
  );
}
beforeEach(() => {
  state.calls = 0;
});
describe("Property curation 2", () => {
  it.each([
    "apartment",
    "villa",
    "individual_portion",
    "investment_property",
    "farm_house",
    "plot",
    "farmland",
    "commercial",
    "industrial",
    "coworking",
    "pg_service_apartment",
  ])("removes the normal Area input for %s", (type) => {
    const markup = form(
      type,
      ["coworking", "pg_service_apartment"].includes(type) ? "Rent" : "Sell",
    );
    expect(labels(markup)).not.toContain("Area");
    expect(markup).not.toContain('name="areaSqft"');
  });
  it.each([
    "apartment",
    "villa",
    "individual_portion",
    "investment_property",
    "pg_service_apartment",
  ])("hides verification for residential Rent: %s", (type) => {
    const markup = form(type, "Rent");
    expect(markup).not.toContain("Documents &amp; Verification");
    if (type === "pg_service_apartment") expect(labels(markup)).not.toContain("Approvals");
    else expect(labels(markup)).toContain("Approvals");
  });
  it("retains Buy verification and puts apartment funding in general details", () => {
    const markup = form("apartment", "Sell");
    expect(markup).toContain("Documents &amp; Verification");
    const general = markup.slice(
      markup.indexOf("Apartment details"),
      markup.indexOf("Documents &amp; Verification"),
    );
    expect(general).toContain("Approvals");
    expect(general).toContain("Has Finance / Hypothecation");
    expect(labels(form("apartment"))).toContain("No of Lifts");
  });
  it("splits bathrooms without guessing how a saved total was composed", () => {
    const markup = form("apartment", "Sell", { bathrooms: 3 });
    expect(labels(markup)).toContain("Individual bathrooms");
    expect(labels(markup)).toContain("Attached bathrooms");
    expect(markup).toContain("split not yet recorded");
  });
  it.each([
    "apartment",
    "villa",
    "individual_portion",
    "investment_property",
    "farm_house",
    "commercial",
    "industrial",
    "plot",
    "farmland",
  ])("offers an automatic sale rate for %s", (type) => {
    const markup = form(type);
    expect(markup).toContain('aria-label="Calculated price per area"');
    expect(markup).not.toContain(">Expected Sale Price</label>");
  });
  it.each([
    "villa",
    "individual_portion",
    "investment_property",
    "farm_house",
    "farmland",
    "plot",
  ])("offers boundaries and facing for %s", (type) => {
    const markup = form(type, "Sell", { plotFacing: "East" });
    expect(markup).toContain("Plot boundary preview");
    expect(markup).toContain("Plot facing:");
    expect(labels(markup)).toContain("Plot Facing");
  });
  it("curates apartment rentals", () => {
    const names = labels(form("apartment", "Rent"));
    expect(names).not.toContain("UDS Area");
    expect(names).not.toContain("Outdoor Spaces");
  });
  it("curates commercial Buy without document requirements or scalar parking", () => {
    const names = labels(form("commercial"));
    for (const name of ["Expected Monthly Sqft Price", "No of Portions"])
      expect(names).toContain(name);
    for (const name of ["Documents Required", "Car Parking", "Bike Parking"])
      expect(names).not.toContain(name);
    expect(form("commercial")).toContain("Parking spaces");
  });
  it("curates commercial Rent and retains its verification section", () => {
    const markup = form("commercial", "Rent", {
      furnishingStatus: "BARESHELL",
    });
    const names = labels(markup);
    for (const name of [
      "Plot Area",
      "UDS Area",
      "Tenant Mix",
      "Lift Facility",
      "Fully Furnished",
      "No of Lifts",
      "Private Cabins",
      "Conference Room",
      "Seaters",
    ])
      expect(names).not.toContain(name);
    for (const name of [
      "Passenger Lifts",
      "Service Lifts",
      "Property Use",
      "Special Purpose",
      "Utilities Provided",
    ])
      expect(names).toContain(name);
    expect(markup).toContain("Documents &amp; Verification");
    expect(markup).toContain("40 × 60 ft");
  });
  it("removes the specified farmhouse fields and keeps its ground-floor control", () => {
    const markup = form("farm_house");
    const names = labels(markup);
    for (const name of [
      "Plot Area",
      "Floor Number",
      "Unit Number",
      "Available Portion",
      "RERA Number",
    ])
      expect(names).not.toContain(name);
    expect(markup).toContain("Includes ground floor");
  });
  it("curates farmland verification and agriculture fields", () => {
    const names = labels(form("farmland"));
    for (const name of [
      "RERA Number",
      "Expected Sale Price",
      "Boundary Wall",
      "Ownership Title Verified",
      "Encumbrance Certificate",
      "Hypothecation",
    ])
      expect(names).not.toContain(name);
    for (const name of [
      "Tax Receipt",
      "Approvals",
      "Agriculture EB",
      "Road Approach",
      "Storage Tank Capacity",
    ])
      expect(names).toContain(name);
  });
  it("curates Plot Rent and places zoning near property type", () => {
    const markup = form("plot", "Rent");
    const names = labels(markup);
    for (const name of ["No of Plots", "SF Number", "Total Project Area"])
      expect(names).not.toContain(name);
    expect(names).toContain("Suitable For");
    expect(names).toContain("Land Area");
    expect(markup.indexOf("Zoning / Usage")).toBeLessThan(
      markup.indexOf("Pricing"),
    );
  });
  it("adds investment income and parking combinations", () => {
    const markup = form("investment_property");
    const names = labels(markup);
    expect(markup).toContain("Parking spaces");
    expect(names).toContain("Total Rent per Month (all portions)");
    expect(names).toContain("Expected Rent per Month");
  });
  it("curates industrial logistics and power controls", () => {
    const markup = form("industrial");
    const names = labels(markup);
    for (const name of [
      "Heavy Vehicle Access",
      "Truck/Trailer Count",
      "Truck/Trailer Access",
      "Truck / Trailer Access",
      "Ownership Proof Verified",
      "Other Legal Clearance",
      "Power Supply (HP)",
    ])
      expect(names).not.toContain(name);
    expect(names).toContain("Power Supply");
    expect(markup).toContain("Has Canteen");
  });
  it("makes coworking per-seat only, furnished by default, with conditional restroom counts", () => {
    const markup = form("coworking", "Rent");
    const names = labels(markup);
    for (const name of [
      "Built Up Area",
      "Carpet Area",
      "Lease Term",
      "Monthly Rent",
      "Incremental Rent Clause",
      "Electricity Charges",
    ])
      expect(names).not.toContain(name);
    expect(markup).not.toContain("Monthly rent *");
    expect(names).toContain("Rent per Seat");
    expect(markup).toContain("Has Free Refreshment");
    expect(names).not.toContain("No of Rest Rooms");
    expect(labels(form("coworking", "Rent", { hasRestroom: true }))).toContain(
      "No of Rest Rooms",
    );
  });
  it("has exactly two role-based owner alternatives and one agent alternative", () => {
    const markup = form("villa");
    for (const name of [
      "Alternative owner contact 1",
      "Alternative owner contact 2",
      "Alternative agent contact",
    ])
      expect(markup).toContain(name);
    expect(markup).not.toContain("Alternative owner contact 3");
    expect(labels(markup)).toContain("Agent Phone");
    expect(labels(markup)).toContain("Agent Email");
  });
});

it.each([ ["apartment", "Sell"], ["apartment", "Rent"], ["villa", "Sell"], ["villa", "Rent"] ])("uses parking combinations for %s %s and restores saved rows", (type, listing) => {
  const markup = form(type, listing, { curationDetails: { parkingSpaces: [
    { vehicle: "Car", type: "Open", count: 2 },
    { vehicle: "Bike", type: "Covered", count: 1 },
  ] } });
  expect(markup).toContain("Parking spaces");
  expect(markup).toContain("Remove parking 1");
  expect(markup).toContain("Remove parking 2");
  expect(markup).toContain("Add parking combination");
  for (const oldLabel of ["No of Parking", "Parking Type", "Car Parking", "Bike Parking"]) expect(labels(markup)).not.toContain(oldLabel);
  const legacy = form(type, listing, { parking: 3, parkingType: "Covered" });
  expect(legacy).toContain("3 spaces");
  expect(legacy).toContain("Breakdown not yet recorded");
});

it.each(["Sell", "Rent"])("shows saved commercial general area as a reference for %s without guessing dedicated measurements", listing => {
  const markup = form("commercial", listing, { areaSqft: "1900", areaUnit: "Sq Ft", builtUpArea: null, carpetArea: null });
  expect(markup).toContain("Previously recorded area: 1900 Sq Ft");
  expect(markup).toContain("Built-up and carpet area are separate measurements");
  expect(markup).not.toContain('name="areaSqft"');
  expect(markup).toContain('name="builtUpArea"');
  expect(markup).toContain('name="carpetArea"');
  expect(markup).not.toContain('value="1900"');
});

it("shows plot boundaries on Commercial Buy only", () => {
  const sides = [ {direction:"North",length:40,unit:"ft"}, {direction:"South",length:40,unit:"ft"}, {direction:"East",length:60,unit:"ft"}, {direction:"West",length:60,unit:"ft"} ];
  const markup = form("commercial", "Sell", {plotBoundaries:sides, propertyFacing:"East"});
  expect(markup).toContain("Plot boundaries");
  expect(markup).toContain("Plot facing: East");
  expect(form("commercial", "Rent", {plotBoundaries:sides})).not.toContain("Plot boundaries");
});
