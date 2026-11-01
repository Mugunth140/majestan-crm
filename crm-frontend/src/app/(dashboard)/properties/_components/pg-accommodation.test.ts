import { expect, it } from "vitest";
import {
  readPgArray,
  pgPayload,
  restorePgDetails,
  pgErrors,
  pgReadFields,
  pgFieldVisible,
} from "./pg-accommodation";
it("round trips zero counts, false facilities, rules and selected meals", () => {
  const original = {
    roomType: "Sharing",
    sharingCount: 3,
    totalCapacity: 12,
    availableCapacity: 2,
    attachedBathroom: false,
    foodAvailable: "Available",
    mealType: "Only Veg",
    weekdayMeals: ["Breakfast", "Dinner"],
    foodChargeType: "Included in rent",
    otherRules: "Quiet after 10 PM",
  };
  expect(pgPayload(restorePgDetails(original))).toMatchObject(original);
});
it("scopes private-room, no-food and no-deposit payloads without erasing dormant draft values", () => {
  const draft = restorePgDetails({
    roomType: "Private",
    sharingCount: 3,
    foodAvailable: "Not Available",
    mealType: "Only Veg",
    weekdayMeals: ["Lunch"],
    foodChargeType: "Fixed monthly amount",
    foodMonthlyCharge: 2000,
    depositType: "None",
    depositAmount: 30000,
  });
  const payload = pgPayload(draft);
  for (const key of [
    "sharingCount",
    "mealType",
    "weekdayMeals",
    "foodMonthlyCharge",
    "depositAmount",
  ])
    expect(payload).not.toHaveProperty(key);
  expect(draft.foodMonthlyCharge).toBe("2000");
});
it("parses Indian money, keeps monthly and per-meal pricing separate", () => {
  const draft = restorePgDetails({
    foodAvailable: "Available",
    foodChargeType: "Per meal basis",
    breakfastCharge: "50",
    lunchCharge: "100",
    foodMonthlyCharge: "3k",
    depositType: "Fixed",
    depositAmount: "1L",
  });
  expect(pgPayload(draft)).toMatchObject({
    breakfastCharge: 50,
    lunchCharge: 100,
    depositAmount: 100000,
  });
  expect(pgPayload(draft)).not.toHaveProperty("foodMonthlyCharge");
});
it("rejects inconsistent capacity, fractional counts and negative amounts", () => {
  expect(
    pgErrors(
      restorePgDetails({
        roomType: "Sharing",
        sharingCount: 1,
        totalCapacity: 2,
        availableCapacity: 3,
        coveredParking: 1.5,
        depositType: "Fixed",
        depositAmount: "-10",
      }),
    ).length,
  ).toBeGreaterThanOrEqual(4);
});
it("keeps unknown optional booleans unknown and clears arrays explicitly", () => {
  const payload = pgPayload(
    restorePgDetails({ suitableFor: [], attachedBalcony: false }),
  );
  expect(payload).not.toHaveProperty("attachedBathroom");
  expect(payload.attachedBalcony).toBe(false);
  expect(payload.suitableFor).toEqual([]);
});
it("renders room-based capacity and hides stale food values in read-only rows", () => {
  const rows = pgReadFields({
    roomType: "Private",
    totalCapacity: 4,
    availableCapacity: 0,
    foodAvailable: "Not Available",
    mealType: "Only Veg",
  });
  expect(rows).toContainEqual({ label: "Total rooms in PG", value: "4" });
  expect(rows).toContainEqual({ label: "Rooms available in PG", value: "0" });
  expect(rows.some((row) => row.label === "Meal type")).toBe(false);
});

it("recognizes legacy Furnished without treating Unfurnished as furnished", async () => {
  const { isPgFurnished } = await import("./pg-accommodation");
  for (const value of ["Furnished", "FULLY FURNISHED", "Semi Furnished"])
    expect(isPgFurnished(value)).toBe(true);
  for (const value of ["Unfurnished", "BARESHELL", null])
    expect(isPgFurnished(value)).toBe(false);
});

it("does not let hidden furnishing drafts block or contaminate an unfurnished save", () => {
  const draft = restorePgDetails({
    roomType: "Private",
    roomFurnishings: [{ item: "Beds", count: -1 }],
  });
  expect(pgErrors(draft, "UNFURNISHED")).toEqual([]);
  expect(pgPayload(draft, "UNFURNISHED")).not.toHaveProperty("roomFurnishings");
  expect(pgErrors(draft, "FULLY FURNISHED")).toContain(
    "Furnishing counts must be nonnegative whole numbers.",
  );
  expect(readPgArray(draft.roomFurnishings)).toEqual([
    { item: "Beds", count: -1 },
  ]);
});
