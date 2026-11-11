import { describe, expect, it } from "vitest";
import { NAV_KEYS, defaultNavAccess, visibleNav } from "./nav-access";
import { canOpen } from "@/components/layout/nav-items";

const viewer = (role: string, department = "", navAccess: string[] | null = null) => ({ role, department, navAccess });
const sorted = (keys: string[]) => [...keys].sort();

describe("sidebar access", () => {
  it("shows admins everything, whatever is saved", () => {
    expect(visibleNav(viewer("Admin", "", ["leads"])).size).toBe(NAV_KEYS.length);
  });

  it("gives managers everything by default", () => {
    expect(defaultNavAccess("Manager", "")).toEqual([...NAV_KEYS]);
  });

  it("gives team leads the logger but not users, tasks or activity logs", () => {
    const tl = defaultNavAccess("Team Lead", "Sales Department");
    expect(tl).toContain("leads");
    expect(tl).toContain("logger");
    for (const k of ["users", "tasks", "activity-logs", "master"]) expect(tl).not.toContain(k);
  });

  it("gives staff their department's modules", () => {
    const inventory = ["agent-network", "builders", "projects", "properties", "asset-inventory"];
    expect(sorted(defaultNavAccess("Staff", "Telecalling Department"))).toEqual(sorted(["scheduler", "leads", "routing", "website-users", ...inventory]));
    expect(sorted(defaultNavAccess("Staff", "Sales Department"))).toEqual(sorted(["scheduler", "leads", "routing", "website-users", "inbound", ...inventory]));
    expect(sorted(defaultNavAccess("Staff", "Sourcing Department"))).toEqual(sorted(["scheduler", "inbound", "routing", "agent-network", "projects", "properties", "asset-inventory"]));
    expect(sorted(defaultNavAccess("Staff", "Collection Department"))).toEqual(sorted(["scheduler", "leads", "projects", "properties", "agent-network", "asset-inventory"]));
    expect(sorted(defaultNavAccess("Staff", "Designing Department"))).toEqual(sorted(["scheduler", "ads", "showcases", "blog"]));
    expect(sorted(defaultNavAccess("Staff", "Digital Department"))).toEqual(sorted(["scheduler", "blog"]));
    expect(sorted(defaultNavAccess("Staff", "HR Department"))).toEqual(sorted(["scheduler", "hr"]));
  });

  it("keeps blog for staff who write it", () => {
    expect(defaultNavAccess("Staff", "Sales Department", true)).toContain("blog");
  });

  it("uses the admin's pick over the defaults", () => {
    expect([...visibleNav(viewer("Staff", "Sales Department", ["hr"]))]).toEqual(["hr"]);
  });

  it("never gives staff or team leads the management modules, even if ticked", () => {
    const ticked = ["leads", "users", "tasks", "activity-logs", "logger"];
    expect([...visibleNav(viewer("Staff", "Sales Department", ticked))]).toEqual(["leads"]);
    expect([...visibleNav(viewer("Team Lead", "Sales Department", ticked))]).toEqual(["leads", "logger"]);
    expect(visibleNav(viewer("Manager", "", ticked)).has("users")).toBe(true);
  });

  it("guards pages by module, leaving the rest open", () => {
    const staff = viewer("Staff", "Telecalling Department");
    expect(canOpen("/leads/12", staff)).toBe(true);
    expect(canOpen("/tasks", staff)).toBe(false);
    expect(canOpen("/analytics", staff)).toBe(false);
    expect(canOpen("/analytics", viewer("Team Lead", "Sales Department", ["analytics"]))).toBe(false);
    expect(canOpen("/analytics", viewer("Manager"))).toBe(true);
    expect(canOpen("/users", staff)).toBe(false);
    expect(canOpen("/master/cities", staff)).toBe(false);
    expect(canOpen("/", staff)).toBe(true);
    expect(canOpen("/inbox", staff)).toBe(true);
  });
});
