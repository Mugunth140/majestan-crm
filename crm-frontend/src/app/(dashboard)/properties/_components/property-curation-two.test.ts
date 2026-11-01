import { expect, it } from "vitest";
import {
  bathroomTotal,
  curationPayload,
  curationErrors,
  restoreCurationDetails,
} from "./property-curation-two";
import {
  isPropertyFieldVisible,
  propertyTypesForListing,
} from "./property-form-fields";
it("preserves old bathroom totals as unclassified until a split is entered", () => {
  const d = restoreCurationDetails(null);
  expect(bathroomTotal(d, "4")).toBe(4);
  expect(d.individualBathrooms).toBe("");
  expect(
    bathroomTotal(
      { ...d, individualBathrooms: "2", attachedBathrooms: "1" },
      "4",
    ),
  ).toBe(3);
});
it("does not clear unknown legacy parking counts on an ordinary edit or draft restore", () => {
  const d = restoreCurationDetails(null);
  expect(curationPayload(d, () => true)).not.toHaveProperty("parkingSpaces");
  expect(
    curationPayload(restoreCurationDetails(d), () => true),
  ).not.toHaveProperty("parkingSpaces");
  expect(
    curationPayload({ ...d, parkingRecorded: true }, () => true).parkingSpaces,
  ).toEqual([]);
});
it("validates portion totals and duplicate parking combinations", () => {
  const d = restoreCurationDetails({
    portions: [
      { bhk: "3 BHK", count: 2 },
      { bhk: "2 BHK", count: 1 },
    ],
    parkingSpaces: [{ vehicle: "Car", type: "Covered", count: 1 }],
  });
  expect(curationErrors(d, () => true, "3")).toEqual([]);
  expect(curationErrors(d, () => true, "4").join(" ")).toContain("must equal");
  expect(
    curationErrors(
      { ...d, parkingSpaces: [...d.parkingSpaces, ...d.parkingSpaces] },
      () => true,
      "3",
    ).join(" "),
  ).toContain("combination once");
});
it("parses formatted income and omits data hidden by the property profile", () => {
  const d = restoreCurationDetails({
    totalRentPerMonth: "1L",
    hasCanteen: true,
    propertyUses: ["Corporate Office", "Retail Showroom"],
  });
  const payload = curationPayload(d, (field) =>
    isPropertyFieldVisible(field, "investment_property", "Buy"),
  );
  expect(payload.totalRentPerMonth).toBe(100000);
  expect(payload).not.toHaveProperty("propertyUses");
  expect(payload).not.toHaveProperty("hasCanteen");
});
it("keeps only the canonical Farm House option when the master contains its duplicate label", () => {
  expect(
    propertyTypesForListing(
      [
        { value: "farm_house", label: "Farmhouse" },
        { value: "farm_house", label: "Farm House" },
      ],
      "Buy",
    ),
  ).toEqual([{ value: "farm_house", label: "Farm House" }]);
});

it("keeps untouched new facility flags unknown, including after a draft restore", () => {
  const unknown = restoreCurationDetails(null);
  expect(curationPayload(unknown, () => true)).not.toHaveProperty("hasCanteen");
  expect(
    curationPayload(restoreCurationDetails(unknown), () => true),
  ).not.toHaveProperty("hasFreeRefreshment");
  expect(
    curationPayload(restoreCurationDetails({ hasCanteen: false }), () => true)
      .hasCanteen,
  ).toBe(false);
});
