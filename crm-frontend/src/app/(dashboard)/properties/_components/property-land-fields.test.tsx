import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { convertRate, areaInSqft } from "./property-measurements";
import { parseMultiValue, PropertyMultiSelect } from "./PropertyMultiSelect";
import {
  PropertyPlotBoundaries,
  convertBoundaryLength,
  restorePlotBoundaries,
} from "./PropertyPlotBoundaries";
import {
  INDUSTRIAL_CERTIFICATES,
  INDUSTRIAL_USES,
  CROP_SUITABILITY,
  EXISTING_PLANTATIONS,
} from "./property-type-options";

describe("Land rates and boundaries", () => {
  it("converts boundary lengths without changing physical size", () => {
    expect(convertBoundaryLength("40", "ft", "m")).toBe("12.192");
    expect(convertBoundaryLength("12.192", "m", "ft")).toBe("40");
  });
  it.each(["Sq Ft", "Sq M", "Cents", "Acres", "Grounds"])(
    "round-trips a price entered per %s",
    (unit) => {
      const canonical = convertRate(1500000, unit, "Sq Ft");
      expect(canonical).toBeDefined();
      expect(convertRate(canonical!, "Sq Ft", unit)).toBeCloseTo(1500000, 4);
    },
  );
  it("converts Tamil Nadu grounds into square feet", () => {
    expect(areaInSqft(1, "Grounds")).toBe(2400);
    expect(convertRate(240000, "Grounds", "Sq Ft")).toBe(100);
  });
  it("restores existing rectangular dimensions as four editable boundaries", () => {
    expect(
      restorePlotBoundaries(null, 40, 60).map((side) => side.length),
    ).toEqual(["40", "60", "40", "60"]);
  });
  it("updates the preview's selected directions and individual lengths", () => {
    const sides = restorePlotBoundaries(null, 40, 60);
    sides[0] = { direction: "North East", length: "43.5", unit: "m" };
    const markup = renderToStaticMarkup(
      createElement(PropertyPlotBoundaries, { value: sides }),
    );
    expect(markup.includes("North East")).toBe(true);
    expect(markup.includes("43.5 m")).toBe(true);
    expect(markup.includes("layout not to scale")).toBe(true);
    expect(
      (markup.match(/aria-label="Boundary [1-4] length"/g) || []).length,
    ).toBe(4);
  });
});

describe("Industrial and agricultural choices", () => {
  it("retains legacy selections alongside all specified industrial choices", () => {
    const markup = renderToStaticMarkup(
      createElement(PropertyMultiSelect, {
        name: "Certificates",
        value: "Legacy clearance",
        options: INDUSTRIAL_CERTIFICATES,
        onChange: () => undefined,
      }),
    );
    expect(markup.includes("Legacy clearance")).toBe(true);
    expect(markup.includes("PESO License")).toBe(true);
    expect(
      parseMultiValue(INDUSTRIAL_USES.join(", "), INDUSTRIAL_USES),
    ).toEqual(INDUSTRIAL_USES);
    expect(
      parseMultiValue(
        JSON.stringify(INDUSTRIAL_CERTIFICATES),
        INDUSTRIAL_CERTIFICATES,
      ),
    ).toEqual(INDUSTRIAL_CERTIFICATES);
    expect(INDUSTRIAL_CERTIFICATES).toHaveLength(16);
    expect(CROP_SUITABILITY).toHaveLength(18);
    expect(EXISTING_PLANTATIONS).toHaveLength(13);
  });
});
