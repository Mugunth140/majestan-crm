import { describe, expect, it } from "vitest";
import { reconcilePropertyDocuments } from "./property-form-documents";
const docs = [
  {
    fileKey: "one.pdf",
    fileName: "One",
    documentType: "legal_document",
    isPublic: false,
    mimeType: "application/pdf",
    fileSize: 123,
  },
  {
    fileKey: "two.pdf",
    fileName: "Two",
    documentType: "legal_document",
    isPublic: false,
  },
  {
    fileKey: "other.pdf",
    fileName: "Other",
    documentType: "other",
    isPublic: false,
  },
];
const initial = { legal_document: docs[0] };
describe("attachment reconciliation", () => {
  it("omits the document replacement on unrelated saves", () => {
    expect(
      reconcilePropertyDocuments(docs, initial, initial, [], []),
    ).toBeUndefined();
  });
  it("removes only the document represented by an explicitly cleared slot", () => {
    expect(
      reconcilePropertyDocuments(
        docs,
        initial,
        { legal_document: null },
        [],
        [],
      )?.map((d) => d.fileKey),
    ).toEqual(["two.pdf", "other.pdf"]);
  });
  it("keeps hidden files and privacy when adding or renaming a floor plan", () => {
    const result = reconcilePropertyDocuments(
      docs,
      initial,
      initial,
      [],
      [{ fileKey: "plan.pdf", fileName: "Plan", title: "Ground" }],
      false,
    )!;
    expect(result.slice(0, 3)).toEqual(
      docs.map((d) => ({ ...d, fileSize: d.fileSize, mimeType: d.mimeType })),
    );
    expect(result[3]).toMatchObject({
      documentType: "floor_plan",
      title: "Ground",
    });
  });
  it("preserves duplicates when a visible slot is replaced", () => {
    const result = reconcilePropertyDocuments(
      docs,
      initial,
      { legal_document: { fileKey: "new.pdf", fileName: "New" } },
      [],
      [],
    )!;
    expect(result.map((d) => d.fileKey)).toEqual([
      "two.pdf",
      "other.pdf",
      "new.pdf",
    ]);
  });
});
