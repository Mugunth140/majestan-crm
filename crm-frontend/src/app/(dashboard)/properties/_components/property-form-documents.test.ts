import { describe, expect, it } from "vitest";
import { getFloorPlans, restoreLegacyFloorPlans, toPropertyDocumentPayload } from "./property-form-documents";

describe("property form floor plans", () => {
  it("loads every floor plan into the separate section", () => {
    const documents = [
      { id: 1, fileKey: "plan-1", documentType: "floor_plan" },
      { id: 2, fileKey: "plan-2", fileName: "Level 2", mimeType: "application/pdf", documentType: "floor_plan" },
      { id: 3, fileKey: "deed", documentType: "legal_document" },
      { id: 4, fileKey: "plan-3", fileName: "Level 3", documentType: "floor_plan" },
    ];

    expect(getFloorPlans(documents).map(({ fileKey }) => fileKey)).toEqual(["plan-1", "plan-2", "plan-3"]);
    expect(toPropertyDocumentPayload(documents[1])).toEqual({
      fileKey: "plan-2",
      fileName: "Level 2",
      mimeType: "application/pdf",
      fileSize: undefined,
      documentType: "floor_plan",
      title: "Level 2",
    });
  });

  it("keeps older draft edits to the first plan while retaining the other plans", () => {
    const initial = [{ fileKey: "plan-1" }, { fileKey: "plan-2" }];
    expect(restoreLegacyFloorPlans({ floor_plan: { fileKey: "replacement" } }, initial).map((p) => p.fileKey)).toEqual(["replacement", "plan-2"]);
    expect(restoreLegacyFloorPlans({ floor_plan: null }, initial).map((p) => p.fileKey)).toEqual(["plan-2"]);
    expect(getFloorPlans([])).toEqual([]);
  });

  it("submits all retained plans with their document type and metadata", () => {
    const plans = [{ fileKey: "plan-1", fileName: "First.pdf" }, { fileKey: "plan-2", fileName: "Second.png", mimeType: "image/png", fileSize: 1200 }];
    expect(plans.map(toPropertyDocumentPayload)).toMatchObject([
      { fileKey: "plan-1", documentType: "floor_plan" },
      { fileKey: "plan-2", documentType: "floor_plan", mimeType: "image/png", fileSize: 1200 },
    ]);
  });
});
