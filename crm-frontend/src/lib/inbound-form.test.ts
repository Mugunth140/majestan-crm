import { describe, expect, it } from "vitest";
import { EMPTY_INBOUND, checkInbound, inboundPayload, normalizeCategoryAndType, type InboundForm } from "./inbound-form";

const form = (patch: Partial<InboundForm>): InboundForm => ({ ...EMPTY_INBOUND, ...patch });

describe("inbound quick capture (phone)", () => {
  it("needs a category, type and a 10-15 digit mobile", () => {
    expect(Object.keys(checkInbound("capture", form({})))).toEqual(["category", "type", "mobile"]);
    expect(checkInbound("capture", form({ category: "commercial", type: "office", mobile: "+91 98765 43210" }))).toEqual({});
    expect(checkInbound("capture", form({ category: "commercial", type: "office", mobile: "98765" })).mobile).toBeTruthy();
  });

  it("sends only what the phone asks for", () => {
    const body = inboundPayload(form({ category: "residential", type: "villa", mobile: " 9876543210 ", inbound_status: "available", alternate_contact: "9000000000", owner_name: "ignored" }), true);
    expect(body).toEqual({
      quick_capture: true, property_category: "residential", property_type: "villa", mobile_number: "9876543210",
      inbound_status: "available", alternate_contact: "9000000000", alternative_contact: null,
    });
  });
});

describe("inbound full form", () => {
  it("asks each step for its own required fields", () => {
    expect(Object.keys(checkInbound("property", form({})))).toEqual(["category", "type", "property_title", "purpose"]);
    expect(Object.keys(checkInbound("location", form({})))).toEqual(["city", "locality"]);
    expect(Object.keys(checkInbound("owner", form({})))).toEqual(["owner_name", "mobile"]);
    expect(Object.keys(checkInbound("access", form({})))).toEqual(["primary_contact", "key_with"]);
    expect(Object.keys(checkInbound("brokerage", form({})))).toEqual(["brokerage_accepted"]);
    expect(checkInbound("pricing", form({}))).toEqual({});
  });

  it("sends coordinates as numbers and drops terms that don't apply", () => {
    const body = inboundPayload(form({
      category: "residential", type: "apartment", bhk: "3", purpose: "Sale", sale_price: "85 Lakhs", advance: "5 Lakhs",
      total_rent: "15000", latitude: "11.0168", longitude: "76.9558", brokerage_accepted: "No", brokerage_type: "Fixed", fixed_amount: "50000",
      primary_contact: "Owner", primary_contact_name: "stale",
    }));
    expect(body).toMatchObject({ latitude: 11.0168, longitude: 76.9558, bhk: "3", sale_price: 8500000, advance: 500000 });
    expect(body).toMatchObject({ total_rent: null, brokerage_type: null, fixed_amount: null, primary_contact_name: null });
    expect(body).not.toHaveProperty("google_map_location");
  });

  it("sends rent terms, months of advance and floor rows for a rented shop", () => {
    const body = inboundPayload(form({
      category: "commercial", type: "shop", purpose: "Rent", total_rent: "40000", advance: "6", special: ["Gym"],
      units: [{ floor_label: "Ground", area: "800 sq ft", price: "40000", notes: "" }, { floor_label: " ", area: "", price: "", notes: "" }],
    }));
    expect(body).toMatchObject({ total_rent: 40000, advance: "6", special_purpose: "Gym", sale_price: null });
    expect(body.units).toEqual([{ floor_label: "Ground", area: "800 sq ft", price: 40000, notes: null }]);
  });
});

it("maps old display values to the form's keys", () => {
  expect(normalizeCategoryAndType("Commercial", "Office Space")).toEqual({ category: "commercial", type: "office" });
  expect(normalizeCategoryAndType("residential", "Warehouse")).toEqual({ category: "commercial", type: "warehouse" });
  expect(normalizeCategoryAndType(null, null)).toEqual({ category: null, type: null });
});
