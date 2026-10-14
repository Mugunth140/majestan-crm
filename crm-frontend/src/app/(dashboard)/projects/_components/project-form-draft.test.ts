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
