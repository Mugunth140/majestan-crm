import { describe, expect, it } from "vitest";
import { groupStaff } from "./inbound-assignment-dialog";

const staff = [
  { id: 22, name: "Meena", department: "Sourcing Department", open: 10 },
  { id: 10, name: "Karthi", department: "Sales Department", open: 31 },
  { id: 16, name: "Durga", department: "Sales Department", open: 12 },
];

describe("inbound assign list", () => {
  it("groups Sales before Sourcing, names in order", () => {
    expect(groupStaff(staff, "").map(g => `${g.name}: ${g.people.map(p => p.name).join(", ")}`)).toEqual(["Sales: Durga, Karthi", "Sourcing: Meena"]);
  });
  it("searches by name or team", () => {
    expect(groupStaff(staff, "kar").flatMap(g => g.people.map(p => p.name))).toEqual(["Karthi"]);
    expect(groupStaff(staff, "sourc").map(g => g.name)).toEqual(["Sourcing"]);
    expect(groupStaff(staff, "zz")).toEqual([]);
  });
});
