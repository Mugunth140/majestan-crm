import { describe, expect, it } from "vitest";
import { extraColumns, formatExtra } from "./extra-columns";

describe("formatExtra", () => {
  it("treats blanks and placeholders as empty", () => {
    for (const v of [null, undefined, "", "—", " ", []]) expect(formatExtra(v)).toBeNull();
  });
  it("formats each kind", () => {
    expect(formatExtra("2026-11-11", "date")).toBe("11 Nov 2026");
    expect(formatExtra(4500000, "money")).toBe("₹45 L");
    expect(formatExtra(0, "money")).toBeNull();
    expect(formatExtra(1, "yesno")).toBe("Yes");
    expect(formatExtra(false, "yesno")).toBe("No");
    expect(formatExtra("ready_to_move", "label")).toBe("Ready To Move");
    expect(formatExtra(["Saravanampatti", "Peelamedu"])).toBe("Saravanampatti, Peelamedu");
    expect(formatExtra(12500, "number")).toBe("12,500");
  });
});

describe("extraColumns", () => {
  it("starts every column hidden and named for the Columns menu", () => {
    const [col] = extraColumns([{ id: "city", label: "City", value: (r: { city: string }) => r.city }]);
    expect(col.id).toBe("city");
    expect(col.meta).toEqual({ label: "City", defaultHidden: true });
    expect(col.enableSorting).toBe(false);
  });
});
