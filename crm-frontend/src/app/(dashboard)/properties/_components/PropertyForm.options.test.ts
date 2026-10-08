import { describe, expect, it } from "vitest";
import {
  BOOKING_AMOUNT_OPTIONS,
  MODE_OF_PAYMENT_OPTIONS,
  LOCK_IN_PERIOD_OPTIONS,
  parseStoredDate,
  ROAD_ACCESS_OPTIONS,
  SALE_TYPE_OPTIONS,
  SECURITY_DEPOSIT_OPTIONS,
  TIME_FOR_REGISTRATION_OPTIONS,
  TRANSACTION_TYPE_OPTIONS,
  withLegacyOption,
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

describe("Pricing dropdown options", () => {
  it("offers booking amounts in lakhs", () => {
    expect(BOOKING_AMOUNT_OPTIONS.map((o) => o.value)).toEqual([
      "1 Lakh",
      "2 Lakhs",
      "5 Lakhs",
      "10 Lakhs",
    ]);
  });

  it("offers security deposits in months", () => {
    expect(SECURITY_DEPOSIT_OPTIONS.map((o) => o.value)).toEqual([
      "3 Months",
      "6 Months",
      "8 Months",
      "10 Months",
      "12 Months",
    ]);
  });

  it("offers lock-in periods in years", () => {
    expect(LOCK_IN_PERIOD_OPTIONS.map((o) => o.value)).toEqual([
      "1 Year",
      "3 Years",
      "5 Years",
      "8 Years",
      "10 Years",
    ]);
  });

  it("offers registration timelines in months", () => {
    expect(TIME_FOR_REGISTRATION_OPTIONS.map((o) => o.value)).toEqual([
      "1 Month",
      "3 Months",
      "6 Months",
      "8 Months",
    ]);
  });
});

describe("withLegacyOption", () => {
  it("appends the stored value when it is not among the options", () => {
    const options = withLegacyOption(BOOKING_AMOUNT_OPTIONS, "50k");
    expect(options).toHaveLength(BOOKING_AMOUNT_OPTIONS.length + 1);
    expect(options[options.length - 1]).toEqual({ value: "50k", label: "50k" });
  });

  it("leaves options untouched for listed and empty values", () => {
    expect(withLegacyOption(BOOKING_AMOUNT_OPTIONS, "1 Lakh")).toHaveLength(
      BOOKING_AMOUNT_OPTIONS.length
    );
    expect(withLegacyOption(BOOKING_AMOUNT_OPTIONS, "")).toHaveLength(
      BOOKING_AMOUNT_OPTIONS.length
    );
  });
});

describe("Mode of Payment options", () => {
  it("offers guideline value and full account", () => {
    expect(MODE_OF_PAYMENT_OPTIONS.map((o) => o.value)).toEqual([
      "Only Guideline Value",
      "Full Account",
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
