import { describe, expect, it, vi } from "vitest";
import { archiveProjectDraft, canRestoreProjectDraft, projectDraftKey, readProjectDraft } from "./project-form-draft";

const saved = { v: 2, baseRevision: 4, data: { units: [{ unitCode: "A-101" }] } };

describe("project draft safety", () => {
  it("does not restore an old unit snapshot after another device saves", () => {
    expect(canRestoreProjectDraft(saved, "edit", 4)).toBe(true);
    expect(canRestoreProjectDraft(saved, "edit", 5)).toBe(false);
    expect(canRestoreProjectDraft({ ...saved, baseRevision: undefined }, "edit", 4)).toBe(false);
    expect(canRestoreProjectDraft({ ...saved, v: 1 }, "edit", 4)).toBe(false);
    expect(canRestoreProjectDraft(saved, "edit", undefined)).toBe(false);
  });
  it("isolates drafts across staff, projects, and create/edit forms", () => {
    const keys = [projectDraftKey("edit", 1, 10), projectDraftKey("edit", 1, 11), projectDraftKey("edit", 2, 10), projectDraftKey("create", undefined, 10)];
    expect(new Set(keys).size).toBe(4);
    expect(canRestoreProjectDraft({ v: 2, data: {} }, "create")).toBe(true);
  });
  it("keeps recovery durable before removing a stale active draft", () => {
    const order: string[] = [];
    const storage = { setItem: vi.fn(() => { order.push("backup"); }), removeItem: vi.fn(() => { order.push("remove"); }) };
    const key = archiveProjectDraft(storage, "draft", saved);
    expect(key).toContain("draft:recovery:");
    expect(storage.setItem).toHaveBeenCalledWith(key, JSON.stringify(saved));
    expect(order).toEqual(["backup", "remove"]);
    storage.setItem.mockImplementation(() => { throw new Error("Storage full"); });
    storage.removeItem.mockClear();
    expect(archiveProjectDraft(storage, "draft", saved)).toBeNull();
    expect(storage.removeItem).not.toHaveBeenCalled();
  });
  it("retains legacy draft data for recovery and rejects malformed storage", () => {
    expect(readProjectDraft(JSON.stringify({ ...saved, v: 1 }))?.data).toEqual(saved.data);
    expect(readProjectDraft("invalid")).toBeNull();
    expect(readProjectDraft('{"v":2,"data":[]}')).toBeNull();
  });
});

import { changedUnitCodes, draftIsPristine, editRequestBody, rebaseDraft } from "./project-form-draft";

describe("sending only what changed", () => {
  const base = { name: "Emerald", city: "Coimbatore", projectType: "apartment", units: [{ unitCode: "A", price: 1 }, { unitCode: "B", price: 2 }] };

  it("sends changed fields, clears with null, and always names the type", () => {
    const body = editRequestBody(base, { ...base, name: "Emerald Heights", city: undefined });
    expect(body.changedFields).toEqual(["name", "city"]);
    expect(body).toMatchObject({ name: "Emerald Heights", city: null, projectType: "apartment" });
    expect(body).not.toHaveProperty("units");
  });

  it("names the units a save touched", () => {
    const mine = { ...base, units: [{ unitCode: "A", price: 1 }, { unitCode: "B", price: 3 }, { unitCode: "C", price: 4 }] };
    expect(editRequestBody(base, mine).changedUnitCodes).toEqual(["B", "C"]);
    expect(changedUnitCodes([{ unitCode: "A" }, { unitCode: "A" }], [])).toBeUndefined();
  });
});

describe("rebasing a draft onto newer server data", () => {
  const base = { name: "Emerald", description: "Old", units: [{ unitCode: "A", price: 1 }] };

  it("keeps my edits and their edits when they touch different things", () => {
    const draft = { v: 3, base, data: { ...base, description: "Mine", units: [...base.units, { unitCode: "B", price: 2 }] } };
    const latest = { ...base, name: "Theirs", units: [{ unitCode: "A", price: 5 }] };
    const { merged, conflicts } = rebaseDraft(draft, latest);
    expect(conflicts).toEqual([]);
    expect(merged).toEqual({ name: "Theirs", description: "Mine", units: [{ unitCode: "A", price: 5 }, { unitCode: "B", price: 2 }] });
  });

  it("keeps the server value where both changed the same thing", () => {
    const draft = { v: 3, base, data: { ...base, name: "Mine", units: [{ unitCode: "A", price: 9 }] } };
    const latest = { ...base, name: "Theirs", units: [{ unitCode: "A", price: 5 }] };
    const { merged, conflicts } = rebaseDraft(draft, latest);
    expect(conflicts).toEqual(["name", "unit A"]);
    expect(merged.name).toBe("Theirs");
  });

  it("recognises a draft with no edits", () => {
    expect(draftIsPristine({ v: 3, base, data: { ...base } })).toBe(true);
  });
});
