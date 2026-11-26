import { describe, expect, it } from "vitest";
import { SITE_FIELDS, requirementShows, siteFieldValue, siteFieldsFor, siteFieldsTitle } from "./requirement-site-fields";

const field = (key: string) => SITE_FIELDS.find((f) => f.key === key)!;

describe("siteFieldsFor", () => {
  it("asks commercial buyers about the unit, never the warehouse questions", () => {
    const keys = siteFieldsFor("commercial").map((f) => f.key);
    for (const k of ["floorNumber", "frontageFt", "lift", "washroom"]) expect(keys).toContain(k);
    for (const k of ["ceilingHeightFt", "containerSize", "truckParking", "powerLoad", "loadingBay"]) expect(keys).not.toContain(k);
  });

  it("follows the property type once one is picked", () => {
    const office = siteFieldsFor("commercial", "office").map((f) => f.key);
    expect(office).toEqual(expect.arrayContaining(["floorNumber", "lift", "washroom"]));
    expect(office).not.toContain("containerSize");
    expect(office).not.toContain("frontageFt");
    const warehouse = siteFieldsFor("commercial", "warehouse").map((f) => f.key);
    expect(warehouse).toEqual(expect.arrayContaining(["ceilingHeightFt", "containerSize", "truckParking", "loadingBay"]));
    expect(warehouse).not.toContain("washroom");
  });

  it("asks industrial buyers the warehouse questions but not shop ones", () => {
    const keys = siteFieldsFor("industrial").map((f) => f.key);
    expect(keys).toContain("containerSize");
    expect(keys).not.toContain("frontageFt");
    expect(siteFieldsFor("industrial", "industrial_land").map((f) => f.key)).not.toContain("ceilingHeightFt");
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

describe("requirementShows", () => {
  it("offers furnishing on offices and shops but not warehouses", () => {
    expect(requirementShows("commercial", "office").furnishing).toBe(true);
    expect(requirementShows("commercial", "shop").furnishing).toBe(true);
    expect(requirementShows("commercial", "warehouse").furnishing).toBe(false);
    expect(requirementShows("industrial", "factory").furnishing).toBe(false);
  });

  it("asks homes about rooms, and plots only about area and facing", () => {
    expect(requirementShows("residential", "apartment")).toMatchObject({ rooms: true, furnishing: true, area: false });
    expect(requirementShows("residential", "plot")).toMatchObject({ rooms: false, furnishing: false, facing: true, area: true });
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
