import { describe, expect, it } from "vitest";
import { canSee, NAVIGATION } from "@/components/layout/nav-items";
import { nice, toBlocks } from "./inventory-blocks";
import type { InventoryReport } from "./inventory-data";

const report = (charts: InventoryReport["charts"]) => ({ metrics: [], charts, issues: [] }) as unknown as InventoryReport;

describe("property insights blocks", () => {
  it("turns short lists into rings and long ones into ranked bars", () => {
    const { blocks } = toBlocks(report([
      { key: "intent", title: "Sale and rent", type: "bar", rows: [{ label: "rent", value: 5 }, { label: "sale", value: 2 }] },
      { key: "types", title: "Types", type: "bar", rows: ["a", "b", "c", "d", "e", "f"].map((label, i) => ({ label, value: i })) },
    ]), "overview");
    expect(blocks.find((b) => b.id === "intent")?.kind).toBe("donut");
    const bars = blocks.find((b) => b.id === "types");
    expect(bars?.kind === "bars" && bars.bars[0].label).toBe("F");
  });

  it("merges labels that only differ in case and drops empty or bookkeeping charts", () => {
    const { blocks } = toBlocks(report([
      { key: "furnishing", title: "Furnishing", type: "bar", rows: ["Fully furnished", "Fully Furnished", "a", "b", "c", "d", "e"].map((label) => ({ label, value: 1 })) },
      { key: "attention", title: "Attention", type: "bar", rows: [{ label: "x", value: 3 }] },
      { key: "empty", title: "Empty", type: "bar", rows: [{ label: "x", value: 0 }, { label: "y", value: 0 }] },
    ]), "overview");
    const f = blocks.find((b) => b.id === "furnishing");
    expect(f?.kind === "bars" && f.bars.find((b) => b.label === "Fully furnished")?.value).toBe(2);
    expect(blocks.map((b) => b.id)).toEqual(["furnishing"]);
  });

  it("gives every drillable mark a target", () => {
    const { blocks, drills } = toBlocks(report([
      { key: "city", title: "City", type: "bar", rows: ["A", "B", "C", "D", "E", "F"].map((label) => ({ label, value: 1, match: { city: label } })) },
    ]), "overview");
    const b = blocks[0];
    const id = b.kind === "bars" ? b.bars[0].personId! : 0;
    expect(drills[id - 1].match).toEqual({ city: "A" });
  });

  it("reads raw labels", () => {
    expect(nice("under_construction")).toBe("Under construction");
    expect(nice("BARESHELL")).toBe("Bareshell");
    expect(nice("3 bhk")).toBe("3 BHK");
  });
});

describe("Reports in the sidebar", () => {
  const reports = NAVIGATION.find((n) => n.href === "/reports")!;
  it("shows only to admins, whatever their access list says", () => {
    expect(canSee(reports, { role: "Admin", department: "", navAccess: null })).toBe(true);
    expect(canSee(reports, { role: "Manager", department: "", navAccess: null })).toBe(false);
    expect(canSee(reports, { role: "Staff", department: "Sales", navAccess: ["leads"] })).toBe(false);
  });
});
