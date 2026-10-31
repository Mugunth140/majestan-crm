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
