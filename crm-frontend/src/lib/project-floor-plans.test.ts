import { describe, expect, it } from "vitest";
import {
  duplicateFloorNameIndex,
  floorPlanFileError,
  floorPlanRowError,
  floorPlansFromUnit,
  floorPlansPayload,
  legacyFloorPlanPayload,
} from "./project-floor-plans";

describe("project unit floor plans", () => {
  it("keeps legacy single-image plans available for staff to rename", () => {
    expect(floorPlansFromUnit({ floorPlanImageUrl: "https://cdn.test/plan.png" }, () => "row-1")).toEqual([
      { id: "row-1", floorName: "Existing plan", imageKey: "https://cdn.test/plan.png", imageUrl: "https://cdn.test/plan.png" },
    ]);
  });

  it("compares floor names after trimming and case folding", () => {
    expect(duplicateFloorNameIndex([
      { floorName: " Ground " },
      { floorName: "basement" },
      { floorName: "gRoUnD" },
    ])).toBe(2);
    expect(duplicateFloorNameIndex([{ floorName: " " }, { floorName: "First" }])).toBe(-1);
    expect(duplicateFloorNameIndex([
      { floorName: "Ground Floor" },
      { floorName: " ground   floor " },
    ])).toBe(1);
  });

  it("requires both the name and uploaded image", () => {
    expect(floorPlanRowError({ floorName: " ", imageKey: "" })).toMatch(/name/i);
    expect(floorPlanRowError({ floorName: "First", imageKey: "" })).toMatch(/image/i);
    expect(floorPlanRowError({ floorName: " First ", imageKey: " key " })).toBeNull();
  });

  it("builds the API shape without client identity or blob preview metadata", () => {
    const draft = [{
      id: "local-id",
      floorName: " Ground ",
      imageKey: "floor/ground.png",
      imageUrl: "https://cdn.test/ground.png",
    }];
    const payload = floorPlansPayload(draft);
    expect(payload).toEqual([{
      floorName: "Ground",
      imageKey: "floor/ground.png",
      imageUrl: "https://cdn.test/ground.png",
    }]);
    expect(JSON.stringify({ floorPlans: draft })).not.toContain("blob:");
    expect(payload[0]).not.toHaveProperty("id");
  });

  it("accepts JPEG, PNG, and WebP up to 15 MB", () => {
    expect(floorPlanFileError({ type: "image/jpeg", size: 15 * 1024 * 1024 } as File)).toBeNull();
    expect(floorPlanFileError({ type: "image/gif", size: 1 } as File)).toMatch(/JPEG, PNG, or WebP/);
    expect(floorPlanFileError({ type: "image/png", size: 15 * 1024 * 1024 + 1 } as File)).toMatch(/15 MB/);
    expect(floorPlanFileError({ type: "image/png", size: 0 } as File)).toMatch(/empty/i);
  });

  it("keeps plot layout fields in plot payloads and sends explicit clears", () => {
    expect(legacyFloorPlanPayload(" layout-url ", " layout-key ", true)).toEqual({
      floorPlanImageUrl: "layout-url",
      floorPlanImageKey: "layout-key",
    });
    expect(legacyFloorPlanPayload("", "", true)).toEqual({
      floorPlanImageUrl: "",
      floorPlanImageKey: "",
    });
  });
});
