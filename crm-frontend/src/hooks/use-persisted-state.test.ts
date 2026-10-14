import { describe, expect, it } from "vitest";
import { persistedStateKey, reviveValue } from "./use-persisted-state";

describe("reviveValue", () => {
  it("falls back to the initial value when nothing is stored", () => {
    expect(reviveValue(undefined, "All")).toBe("All");
  });

  it("keeps primitives only when the type matches", () => {
    expect(reviveValue("Inactive", "Active")).toBe("Inactive");
    expect(reviveValue(3, "Active")).toBe("Active");
    expect(reviveValue(4, 1)).toBe(4);
  });

  it("restricts to the allowed list", () => {
    const tabs = ["Active", "Inactive"] as const;
    expect(reviveValue<string>("Inactive", "Active", { allowed: tabs })).toBe("Inactive");
    expect(reviveValue<string>("Removed", "Active", { allowed: tabs })).toBe("Active");
  });

  it("merges objects key by key, dropping unknown and mistyped fields", () => {
    const initial = { status: "", bhk: [] as number[], pageIndex: 0 };
    expect(reviveValue({ status: "Hot", bhk: [2, 3], pageIndex: "x", extra: 1 }, initial)).toEqual({
      status: "Hot",
      bhk: [2, 3],
      pageIndex: 0,
    });
    expect(reviveValue("garbage", initial)).toBe(initial);
  });

  it("uses a custom deserializer (e.g. dates)", () => {
    const toDate = (v: unknown) => (typeof v === "string" ? new Date(v) : undefined);
    const d = reviveValue<Date | undefined>("2026-10-14T00:00:00.000Z", undefined, { deserialize: toDate });
    expect(d?.toISOString()).toBe("2026-10-14T00:00:00.000Z");
    expect(reviveValue<Date | undefined>(null, undefined, { deserialize: toDate })).toBeUndefined();
  });
});

describe("persistedStateKey", () => {
  it("scopes keys per user", () => {
    expect(persistedStateKey("leads:tab", "7")).not.toBe(persistedStateKey("leads:tab", "8"));
  });
});
