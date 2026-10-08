import { describe, expect, it } from "vitest";
import {
  parseStoredDate,
  ROAD_ACCESS_OPTIONS,
  SALE_TYPE_OPTIONS,
  TRANSACTION_TYPE_OPTIONS,
} from "./PropertyForm";

describe("Basic Info dropdown options", () => {
  it("offers the six road access widths", () => {
    expect(ROAD_ACCESS_OPTIONS.map((o) => o.value)).toEqual([
      "23ft",
      "30ft",
      "40ft",
      "60ft",
      "80ft",
      "100ft",
    ]);
  });

  it("offers Full / Partial sale types", () => {
    expect(SALE_TYPE_OPTIONS.map((o) => o.value)).toEqual(["Full", "Partial"]);
  });

  it("offers the four transaction types", () => {
    expect(TRANSACTION_TYPE_OPTIONS.map((o) => o.value)).toEqual([
      "New",
      "Resale Unoccupied",
      "Resale Occupied",
      "Resale Tenant Occupied",
    ]);
  });
});

describe("parseStoredDate", () => {
  it("parses stored yyyy-MM-dd dates for the picker", () => {
    const d = parseStoredDate("2026-06-14");
    expect(d?.getFullYear()).toBe(2026);
    expect(d?.getMonth()).toBe(5);
    expect(d?.getDate()).toBe(14);
  });

  it("returns undefined for legacy free-text dates", () => {
    expect(parseStoredDate("Jan 2025")).toBeUndefined();
  });

  it("returns undefined for empty input", () => {
    expect(parseStoredDate("")).toBeUndefined();
    expect(parseStoredDate(undefined)).toBeUndefined();
  });
});
