import { describe, expect, it } from "vitest";
import { SITE_FIELDS, siteFieldValue, siteFieldsFor, siteFieldsTitle } from "./requirement-site-fields";

const field = (key: string) => SITE_FIELDS.find((f) => f.key === key)!;

describe("siteFieldsFor", () => {
  it("asks commercial buyers about ceiling, road, containers, lifts and trucks", () => {
    const keys = siteFieldsFor("commercial").map((f) => f.key);
    for (const k of ["ceilingHeightFt", "roadAccess", "containerSize", "lift", "truckParking", "frontageFt", "washroom"]) expect(keys).toContain(k);
  });

  it("asks industrial buyers the warehouse questions but not shop ones", () => {
    const keys = siteFieldsFor("industrial").map((f) => f.key);
    expect(keys).toContain("containerSize");
    expect(keys).not.toContain("frontageFt");
  });

  it("asks residential or uncategorised requirements nothing", () => {
    expect(siteFieldsFor("residential")).toEqual([]);
    expect(siteFieldsFor(null)).toEqual([]);
  });

  it("titles the section by category", () => {
    expect(siteFieldsTitle("commercial")).toBe("Commercial needs");
    expect(siteFieldsTitle("agricultural")).toBe("Site needs");
  });
});

describe("siteFieldValue", () => {
  it("stores numbers as numbers and drops blanks or zero", () => {
    expect(siteFieldValue(field("ceilingHeightFt"), "18")).toBe(18);
    expect(siteFieldValue(field("ceilingHeightFt"), "")).toBeNull();
    expect(siteFieldValue(field("ceilingHeightFt"), "0")).toBeNull();
    expect(siteFieldValue(field("ceilingHeightFt"), "abc")).toBeNull();
  });

  it("keeps text and select values trimmed", () => {
    expect(siteFieldValue(field("powerLoad"), " 50 kVA ")).toBe("50 kVA");
    expect(siteFieldValue(field("containerSize"), "40ft")).toBe("40ft");
  });

  it("stores a ticked check as true and an unticked one as cleared", () => {
    expect(siteFieldValue(field("loadingBay"), true)).toBe(true);
    expect(siteFieldValue(field("loadingBay"), false)).toBeNull();
  });
});
