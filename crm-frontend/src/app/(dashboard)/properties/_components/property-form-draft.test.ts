import { describe, expect, it } from "vitest";
import { fieldLabel, fieldList, isDraftOutdated, propertyDraftKey, readPropertyDraft, reviewDraft } from "./property-form-draft";

describe("isDraftOutdated", () => {
  const v1 = "2026-10-01T07:06:47.000Z";
  const v2 = "2026-10-15T10:00:00.000Z";

  it("is current when the record hasn't been saved since the draft started", () => {
    expect(isDraftOutdated({ v: 2, baseVersion: v1, data: {} }, v1)).toBe(false);
  });

  it("is outdated once someone else saves a newer version", () => {
    expect(isDraftOutdated({ v: 2, baseVersion: v1, data: {} }, v2)).toBe(true);
  });

  it("falls back to the draft's save time when it has no version", () => {
    expect(isDraftOutdated({ v: 1, savedAt: Date.parse(v1), data: {} }, v2)).toBe(true);
    expect(isDraftOutdated({ v: 1, savedAt: Date.parse(v2) + 1000, data: {} }, v2)).toBe(false);
  });

  it("never discards drafts of a new (unsaved) record", () => {
    expect(isDraftOutdated({ v: 2, data: {} }, null)).toBe(false);
  });
});

describe("reviewDraft", () => {
  const base = { title: "Villa", price: "50,00,000", description: "Old" };

  it("offers nothing for a draft without edits", () => {
    expect(reviewDraft({ v: 2, base, data: { ...base } }, { ...base })).toBeNull();
  });

  it("restores my edits and keeps someone else's unrelated save", () => {
    const current = { ...base, description: "Updated by a colleague" };
    const review = reviewDraft({ v: 2, base, data: { ...base, price: "55,00,000" } }, current);
    expect(review).toMatchObject({
      merged: { title: "Villa", price: "55,00,000", description: "Updated by a colleague" },
      changed: ["price"],
      serverChanged: true,
      conflicts: [],
    });
  });

  it("keeps the saved value where someone else saved the same field", () => {
    const current = { ...base, price: "60,00,000" };
    const review = reviewDraft({ v: 2, base, data: { ...base, price: "55,00,000", title: "Villa 2" } }, current);
    expect(review?.conflicts).toEqual(["price"]);
    expect(review?.merged.price).toBe("60,00,000");
    expect(review?.merged.title).toBe("Villa 2");
    expect(review?.changed).toEqual(["title"]);
  });

  it("offers nothing when my edits are already saved", () => {
    const current = { ...base, price: "55,00,000" };
    expect(reviewDraft({ v: 2, base, data: { ...base, price: "55,00,000" } }, current)).toBeNull();
  });

  it("treats a legacy draft (no base) as edits wherever it differs", () => {
    const review = reviewDraft({ v: 1, data: { ...base, title: "Villa 2" } }, { ...base });
    expect(review?.changed).toEqual(["title"]);
    expect(review?.serverChanged).toBe(false);
  });
});

describe("readPropertyDraft", () => {
  it("rejects corrupt, unknown-version and expired drafts", () => {
    expect(readPropertyDraft("{bad")).toBeNull();
    expect(readPropertyDraft(JSON.stringify({ v: 9, data: {} }))).toBeNull();
    expect(readPropertyDraft(JSON.stringify({ v: 2, savedAt: 0, data: {} }), 8 * 24 * 3600 * 1000)).toBeNull();
    expect(readPropertyDraft(JSON.stringify({ v: 2, savedAt: 1, data: { a: 1 } }), 2)).toMatchObject({ data: { a: 1 } });
  });
});

describe("labels and keys", () => {
  it("humanises field keys", () => {
    expect(fieldLabel("monthlyRent")).toBe("Monthly rent");
    expect(fieldLabel("sublocationId")).toBe("Locality");
    expect(fieldList(["a", "b", "c"], 2)).toBe("A, B and 1 more");
  });

  it("scopes drafts per user", () => {
    expect(propertyDraftKey("edit", 5, 1)).not.toBe(propertyDraftKey("edit", 5, 2));
  });
});
