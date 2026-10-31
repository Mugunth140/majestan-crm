import { describe, expect, it } from "vitest";
import {
  COMMERCIAL_RENT_USES,
  COMMERCIAL_SPECIAL_PURPOSES,
  PROPERTY_ACCESSIBILITY,
} from "./property-type-options";
import { preserveNonPlanDocuments } from "./property-form-documents";

describe("Commercial rental choices and hidden attachments", () => {
  it("includes every supplied classification and accessibility option", () => {
    expect(COMMERCIAL_RENT_USES).toHaveLength(16);
    expect(COMMERCIAL_RENT_USES).toContain("Back Office / IT-BPO Center");
    expect(COMMERCIAL_RENT_USES).toContain("Clinic / Diagnostic Center");
    expect(COMMERCIAL_SPECIAL_PURPOSES).toHaveLength(15);
    expect(COMMERCIAL_SPECIAL_PURPOSES).toContain("Bank Branch / ATM Hub");
    expect(PROPERTY_ACCESSIBILITY).toEqual([
      "On Road",
      "Cut Road",
      "Inside Colony",
    ]);
  });
  it("retains multiple same-type and legacy documents while plans are edited separately", () => {
    const docs = preserveNonPlanDocuments([
      {
        fileKey: "legal-1.pdf",
        fileName: "Legal one",
        documentType: "legal_document",
      },
      {
        fileKey: "legal-2.pdf",
        fileName: "Legal two",
        documentType: "legal_document",
      },
      {
        fileKey: "legacy.pdf",
        fileName: "Legacy file",
        documentType: "legacy_type",
        title: "Old file",
      },
      {
        fileKey: "plan.pdf",
        fileName: "Ground floor",
        documentType: "floor_plan",
      },
    ]);
    expect(docs.map((doc) => doc.fileKey)).toEqual([
      "legal-1.pdf",
      "legal-2.pdf",
      "legacy.pdf",
    ]);
    expect(docs[2].documentType).toBe("legacy_type");
    expect(docs[2].title).toBe("Old file");
  });
});
