import { describe, expect, it } from "vitest";
import {
  areaInSqft,
  convertArea,
  initialArea,
  AREA_UNIT_OPTIONS,
} from "./property-measurements";
import { parseApprovals, APPROVAL_OPTIONS } from "./PropertyApprovalsSelect";

describe("Property area measurements", () => {
  it("offers all requested units including grounds", () => {
    expect(AREA_UNIT_OPTIONS.map((unit) => unit.value)).toEqual([
      "Sq Ft",
      "Sq M",
      "Cents",
      "Acres",
      "Grounds",
    ]);
  });
  it.each(["Sq Ft", "Sq M", "Cents", "Acres", "Grounds"])(
    "preserves the physical area when switching through %s",
    (unit) => {
      const value = convertArea("43560", "Sq Ft", unit);
      expect(areaInSqft(value, unit)).toBeCloseTo(43560, 3);
      expect(
        Number(initialArea(43560, "plotArea", { plotArea: unit })),
      ).toBeCloseTo(Number(value), 6);
    },
  );
  it("restores legacy cents and defaults old square-foot measurements", () => {
    expect(initialArea(10, "plotSizeCents", {}, "Cents")).toBe("10");
    expect(initialArea(1200, "builtUpArea", {})).toBe("1200");
    expect(areaInSqft("", "Acres")).toBeUndefined();
    expect(areaInSqft("not an area", "Sq Ft")).toBeUndefined();
  });
  it("keeps multiple approvals and unknown legacy approvals", () => {
    expect(parseApprovals("CMDA, DTCP, Legacy clearance, CMDA")).toEqual([
      "CMDA",
      "DTCP",
      "Legacy clearance",
    ]);
    expect(APPROVAL_OPTIONS).toEqual([
      "CMDA",
      "LPA",
      "DTCP",
      "Corporation Approved",
      "Village Panchayat",
    ]);
  });
});
