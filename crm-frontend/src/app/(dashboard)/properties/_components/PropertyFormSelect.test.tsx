import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { propertyOptionLabel, PropertyFormSelect } from "./PropertyFormSelect";

describe("Property dropdown labels", () => {
  it.each([
    ["FARM LAND", "Farm Land"],
    ["MODERATELY SLOPED LAND", "Moderately Sloped Land"],
    ["ALLUVIAL SOIL(MOST FERTILE)", "Alluvial Soil(Most Fertile)"],
    ["SEMI FURNISHED", "Semi Furnished"],
    ["CORPORATION WATER", "Corporation Water"],
    ["CMDA/DTCP APPROVED", "CMDA/DTCP Approved"],
    ["18% GST", "18% GST"],
    ["3BHK", "3BHK"],
    ["N/A", "N/A"],
    ["24/7", "24/7"],
    ["PG / Service Apartment", "PG / Service Apartment"],
    ["McDonald ROAD", "McDonald Road"],
  ])("formats %s without changing codes", (raw, label) => {
    expect(propertyOptionLabel(raw)).toBe(label);
  });

  it("displays the readable selected label while retaining its stored value", () => {
    const markup = renderToStaticMarkup(createElement(PropertyFormSelect, {
      name: "landType", placeholder: "Select land type", value: "FARM LAND",
      options: [{ value: "FARM LAND", label: "FARM LAND" }],
    }));
    expect(markup).toContain("Farm Land");
    expect(markup).toContain('value="FARM LAND"');
  });

  it("formats a saved legacy value missing from the master options", () => {
    const markup = renderToStaticMarkup(createElement(PropertyFormSelect, {
      name: "soilType", placeholder: "Select soil type", value: "OLD RED SOIL", options: [],
    }));
    expect(markup).toContain("Old Red Soil");
    expect(markup).toContain('value="OLD RED SOIL"');
  });
});
