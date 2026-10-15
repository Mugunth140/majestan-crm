import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import PropertyFloorPlansSection, {
  MAX_FLOOR_PLAN_FILE_SIZE,
  MAX_FLOOR_PLANS,
  isCrossOriginLocalPdf,
  nextFloorPlanIndex,
  removeFloorPlan,
  validateFloorPlanFile,
  type PropertyFloorPlan,
} from "./PropertyFloorPlansSection";

const plans: PropertyFloorPlan[] = Array.from({ length: 5 }, (_, index) => ({
  fileKey: `plan-${index + 1}`,
  fileName: `level-${index + 1}.pdf`,
  fileUrl: `https://files.example.test/level-${index + 1}.pdf`,
  mimeType: "application/pdf",
  fileSize: 120_000,
}));

describe("PropertyFloorPlansSection", () => {
  it("provides a separate floor-name field for each uploaded file", () => {
    const markup = renderToStaticMarkup(createElement(PropertyFloorPlansSection, {
      plans: [{ ...plans[0], title: "Ground floor" }, { ...plans[1], title: "First floor" }],
      onChange: () => undefined,
    }));
    expect(markup).toContain('value="Ground floor"');
    expect(markup).toContain('value="First floor"');
    expect(markup).toContain('name="floorPlanName-0"');
    expect(markup).toContain('name="floorPlanName-1"');
    expect(markup).toContain("level-1.pdf");
    expect(markup).toContain("level-2.pdf");
  });
  it("renders every supplied plan with an in-app preview button and the current count", () => {
    const markup = renderToStaticMarkup(
      createElement(PropertyFloorPlansSection, { plans, onChange: () => undefined }),
    );

    for (const plan of plans) {
      expect(markup).toContain(plan.fileName);
      expect(markup).toContain(`aria-label="Preview ${plan.fileName}"`);
    }
    expect(markup).toContain("5 of 5");
    expect((markup.match(/>Preview<\/button>/g) ?? [])).toHaveLength(5);
    expect(markup).not.toContain('target="_blank"');
    expect(markup).not.toContain('role="dialog"');
  });

  it("disables adding plans when all five slots are in use", () => {
    const markup = renderToStaticMarkup(
      createElement(PropertyFloorPlansSection, { plans, onChange: () => undefined }),
    );

    expect(MAX_FLOOR_PLANS).toBe(5);
    expect(markup).toMatch(/<button[^>]*disabled=""[^>]*>[\s\S]*Add floor plans/);
  });

  it("removes only the selected row from the supplied list", () => {
    expect(removeFloorPlan(plans, 2).map((plan) => plan.fileKey)).toEqual([
      "plan-1", "plan-2", "plan-4", "plan-5",
    ]);
  });

  it("wraps previous and next navigation around the plan list", () => {
    expect(nextFloorPlanIndex(0, -1, 5)).toBe(4);
    expect(nextFloorPlanIndex(4, 1, 5)).toBe(0);
    expect(nextFloorPlanIndex(0, 1, 0)).toBe(-1);
  });

  it("detects only cross-origin local PDF routes for blob-backed preview", () => {
    expect(isCrossOriginLocalPdf("https://site.example.test/local/properties/plan.pdf", "https://crm.example.test")).toBe(true);
    expect(isCrossOriginLocalPdf("https://crm.example.test/local/properties/plan.pdf", "https://crm.example.test")).toBe(false);
    expect(isCrossOriginLocalPdf("https://site.example.test/uploads/plan.pdf", "https://crm.example.test")).toBe(false);
  });

  it("accepts supported formats under 15 MB and rejects unsupported or oversized files", () => {
    expect(validateFloorPlanFile({ name: "layout.webp", type: "image/webp", size: 500 })).toBeNull();
    expect(validateFloorPlanFile({ name: "layout.PDF", type: "", size: MAX_FLOOR_PLAN_FILE_SIZE })).toBeNull();
    expect(validateFloorPlanFile({ name: "layout.doc", type: "application/msword", size: 500 })).toContain("PDF, JPG, PNG, or WebP");
    expect(validateFloorPlanFile({ name: "large.png", type: "image/png", size: MAX_FLOOR_PLAN_FILE_SIZE + 1 })).toContain("15 MB");
  });
});
