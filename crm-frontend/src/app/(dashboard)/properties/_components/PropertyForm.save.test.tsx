import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, it, expect, vi } from "vitest";
const probe = vi.hoisted(() => ({
  calls: 0,
  submit: undefined as any,
  update: vi.fn(async (_id: number, _payload: Record<string, unknown>) => ({
    success: true,
  })),
  markup: "",
}));
vi.mock("react", async (original) => {
  const r = await original<typeof import("react")>();
  return {
    ...r,
    default: {
      ...r,
      createElement: (type: any, props: any, ...children: any[]) => {
        if (type === "form") probe.submit = props.onSubmit;
        return r.createElement(type, props, ...children);
      },
    },
    useState: (initial: unknown) =>
      r.useState(probe.calls++ === 1 ? false : initial),
    createElement: (type: any, props: any, ...children: any[]) => {
      if (type === "form") probe.submit = props.onSubmit;
      return r.createElement(type, props, ...children);
    },
  };
});
vi.mock("react/jsx-runtime", async (original) => {
  const r = await original<any>();
  return {
    ...r,
    jsx: (type: any, props: any, ...args: any[]) => {
      if (type === "form") probe.submit = props.onSubmit;
      return r.jsx(type, props, ...args);
    },
    jsxs: (type: any, props: any, ...args: any[]) => {
      if (type === "form") probe.submit = props.onSubmit;
      return r.jsxs(type, props, ...args);
    },
  };
});
vi.mock("react/jsx-dev-runtime", async (original) => {
  const r = await original<any>();
  return {
    ...r,
    jsxDEV: (type: any, props: any, ...args: any[]) => {
      if (type === "form") probe.submit = props.onSubmit;
      return r.jsxDEV(type, props, ...args);
    },
  };
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/components/layout/mobile-header", () => ({
  MobileHeader: () => null,
}));
vi.mock("@/lib/permissions", () => ({ canViewPropertyContacts: () => true }));
vi.mock("@/lib/properties-api", () => ({
  propertiesApi: { update: probe.update },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
import { PropertyForm } from "./PropertyForm";
const base = {
  id: 7,
  title: "Audit synthetic",
  propertyType: "apartment",
  listingType: "Sell",
  price: 100000,
  cityId: 1,
  sublocationId: 2,
  propertyDetails: {},
  updatedAt: "2026-10-31T00:00:00.000Z",
};
beforeEach(() => {
  probe.calls = 0;
  probe.submit = undefined;
  probe.update.mockClear();
});
async function save(extra: any = {}) {
  probe.markup = renderToStaticMarkup(
    createElement(PropertyForm, {
      mode: "edit",
      initialData: { ...base, ...extra },
      onSuccess: vi.fn(),
    }),
  );
  expect(probe.submit).toBeTypeOf("function");
  probe.submit({ preventDefault: () => {} });
  await vi.waitFor(() => expect(probe.update).toHaveBeenCalledOnce());
  return probe.update.mock.calls[0][1] as any;
}
it.each([
  "apartment",
  "villa",
  "individual_portion",
  "plot",
  "farmland",
  "commercial",
  "industrial",
  "coworking",
  "investment_property",
  "pg_service_apartment",
  "farm_house",
])("submits existing %s with version protection", async (type) => {
  const p = await save({
    propertyType: type,
    propertyDetails: type === "coworking" ? { rentPerSeat: 8000 } : {},
    listingType: ["coworking", "pg_service_apartment"].includes(type)
      ? "Rent"
      : "Sell",
  });
  expect(p.expectedUpdatedAt).toBe(base.updatedAt);
  expect(p.propertyType).toBe(type);
});
it("preserves unsupported and duplicate attachments by omitting unrelated replacements", async () => {
  const documents = [
    {
      fileKey: "audit/one.pdf",
      fileName: "One",
      documentType: "legal_document",
    },
    {
      fileKey: "audit/two.pdf",
      fileName: "Two",
      documentType: "legal_document",
    },
    { fileKey: "audit/other.pdf", fileName: "Other", documentType: "other" },
  ];
  const p = await save({ documents });
  expect(p).not.toHaveProperty("documents");
});
it("keeps every coworking attachment untouched on an ordinary edit", async () => {
  const p = await save({
    propertyType: "coworking",
    listingType: "Rent",
    propertyDetails: { rentPerSeat: 8000 },
    documents: [
      { fileKey: "audit/other.pdf", fileName: "Other", documentType: "other" },
    ],
  });
  expect(p).not.toHaveProperty("documents");
});
it("submits canonical square feet and selected units separately", async () => {
  const p = await save({
    propertyType: "industrial",
    propertyDetails: {
      plotArea: "43560",
      builtUpArea: "1076.39104167",
      measurementUnits: { plotArea: "Acres", builtUpArea: "Sq M" },
      laborRooms: 0,
      toilets: 4,
      containerAccess: "60 ft",
    },
  });
  expect(Number(p.plotArea)).toBeCloseTo(43560, 3);
  expect(p.builtUpArea).toBeCloseTo(1076.39104167, 3);
  expect(p.measurementUnits).toMatchObject({
    plotArea: "Acres",
    builtUpArea: "Sq M",
  });
  expect(p.laborRooms).toBe(0);
  expect(p.toilets).toBe(4);
});
it("derives Villa rate from built-up area, independent of plot size", async () => {
  const p = await save({
    propertyType: "villa",
    price: 10000000,
    propertyDetails: { builtUpArea: "2000", plotArea: "6000" },
  });
  expect(p.pricePerSqft).toBe(5000);
  expect(p.areaSqft).toBe(2000);
});

it("persists explicit clearing and the unchecked finance state", async () => {
  const p = await save({
    propertyType: "industrial",
    hypothecation: "No",
    approvals: "",
    propertyDetails: { propertyUse: "", buildingApprovalCert: "" },
  });
  expect(p.hypothecation).toBe("No");
  expect(p.approvals).toBe("");
  expect(p.propertyUse).toBe("");
  expect(p.buildingApprovalCert).toBe("");
});

it("marks the default named area basis even when its unit selector was untouched", async () => {
  const p = await save({
    propertyType: "commercial",
    propertyDetails: { areaSqft: "1", areaUnit: "Sq Ft", plotArea: "43560" },
  });
  expect(p.measurementUnits.plotArea).toBe("Sq Ft");
  expect(Number(p.plotArea)).toBe(43560);
});

it("preserves the physical size of legacy Plot Area stored in the general unit", async () => {
  const p = await save({
    propertyType: "commercial",
    propertyDetails: { areaSqft: "1", areaUnit: "Acres", plotArea: "1" },
  });
  expect(Number(p.plotArea)).toBe(43560);
  expect(p.measurementUnits.plotArea).toBe("Acres");
});

it("saves split bathrooms as a total, and calculates apartment rates from built-up area", async () => {
 const p = await save({ price: 5000000, propertyDetails: { builtUpArea: 1000, bathrooms: 9, curationDetails: { individualBathrooms: 2, attachedBathrooms: 1 } } });
 expect(p.bathrooms).toBe(3); expect(p.pricePerSqft).toBe(5000); expect(p.curationDetails).toMatchObject({ individualBathrooms: 2, attachedBathrooms: 1 });
});
it("retains land display units separately from searchable sqft and computes the canonical rate", async () => {
 const p = await save({ propertyType: "farmland", price: 4356000, propertyDetails: { areaSqft: 43560, areaUnit: "Sq Ft", measurementUnits: { landArea: "Acres", pricePerSqft: "Acres" } } });
 expect(p.areaSqft).toBe(43560); expect(p.areaUnit).toBe("Sq Ft"); expect(p.measurementUnits).toMatchObject({ landArea: "Acres", pricePerSqft: "Acres" }); expect(p.pricePerSqft).toBe(100);
});
it("stores coworking price per seat and its fully furnished default without a monthly total", async () => {
 const p = await save({ propertyType: "coworking", listingType: "Rent", price: 80000, propertyDetails: { rentPerSeat: 8000, minSeats: 10, furnishingStatus: "FULLY FURNISHED" } });
 expect(p.price).toBe(8000); expect(p.rentPerSeat).toBe(8000); expect(p).not.toHaveProperty("monthlyRent"); expect(p.furnished).toBe(true); expect(p.furnishingStatus).toBe("FULLY FURNISHED");
});
it("saves two owner alternatives and the agent contacts without flattening the second contact", async () => {
 const contactDetails = { ownerAlternatives: [{ role: "Care Taker", name: "Synthetic one", phone: "synthetic-1", email: "one@example.invalid" }, { role: "Security", name: "Synthetic two", phone: "synthetic-2", email: "two@example.invalid" }], agentPhone: "synthetic-agent", agentEmail: "agent@example.invalid", agentAlternative: { name: "Synthetic alternate", phone: "synthetic-3", email: "alt@example.invalid", role: "" } };
 const p = await save({ contactDetails }); expect(p.contactDetails).toEqual(contactDetails); expect(p.alternateName).toBe("Synthetic one");
});

it.each([['SEMI FURNISHED', true], ['FULLY FURNISHED', true], ['BARESHELL', false], ['UNFURNISHED', false]])('saves commercial rental furnishing status %s without depending on the removed checkbox', async (furnishingStatus, furnished) => {
 const p = await save({ propertyType: 'commercial', listingType: 'Rent', propertyDetails: { furnishingStatus, furnished: !furnished } });
 expect(p.furnished).toBe(furnished);
});
it('preserves unparseable legacy room measurements on an unrelated edit', async () => {
 const p = await save({ propertyDetails: { roomDimensions: [{ name: 'Living', dimensions: '12 × 10 m' }] } });
 expect(p.roomDimensions).toEqual([{ name: 'Living', dimensions: '12 × 10 m' }]);
});

it('does not overwrite an existing coworking furnishing choice with the new-form default', async () => {
 const p = await save({ propertyType: 'coworking', listingType: 'Rent', propertyDetails: { rentPerSeat: 8000, furnishingStatus: 'UNFURNISHED', furnished: false } });
 expect(p.furnishingStatus).toBe('UNFURNISHED'); expect(p.furnished).toBe(false);
});
