import { describe, expect, it } from "vitest";
import { NAV_KEYS, defaultNavAccess, visibleNav } from "./nav-access";
import { canOpen } from "@/components/layout/nav-items";

const viewer = (role: string, department = "", navAccess: string[] | null = null) => ({ role, department, navAccess });

describe("sidebar access", () => {
  it("shows admins everything, whatever is saved", () => {
    expect(visibleNav(viewer("Admin", "", ["leads"])).size).toBe(NAV_KEYS.length);
  });

  it("gives managers everything by default", () => {
    expect(defaultNavAccess("Manager", "")).toEqual([...NAV_KEYS]);
  });

  it("keeps oversight modules from team leads by default", () => {
    const tl = defaultNavAccess("Team Lead", "Sales Department");
    expect(tl).toContain("leads");
    expect(tl).not.toContain("users");
    expect(tl).not.toContain("master");
  });

  it("gives staff their department's modules", () => {
    expect(defaultNavAccess("Staff", "Telecalling Department")).toEqual(["scheduler", "leads", "routing", "tasks"]);
    expect(defaultNavAccess("Staff", "HR Department")).toEqual(["asset-inventory", "hr", "scheduler", "tasks"].sort((a, b) => NAV_KEYS.indexOf(a as never) - NAV_KEYS.indexOf(b as never)));
    expect(defaultNavAccess("Staff", "Sourcing Department")).toContain("inbound");
    expect(defaultNavAccess("Staff", "Telecalling Department")).not.toContain("users");
  });

  it("keeps blog for staff who write it", () => {
    expect(defaultNavAccess("Staff", "Sales Department", true)).toContain("blog");
  });

  it("uses the admin's pick over the defaults", () => {
    expect([...visibleNav(viewer("Staff", "Sales Department", ["tasks"]))]).toEqual(["tasks"]);
  });

  it("guards pages by module, leaving the rest open", () => {
    const staff = viewer("Staff", "Telecalling Department");
    expect(canOpen("/leads/12", staff)).toBe(true);
    expect(canOpen("/users", staff)).toBe(false);
    expect(canOpen("/master/cities", staff)).toBe(false);
    expect(canOpen("/", staff)).toBe(true);
    expect(canOpen("/inbox", staff)).toBe(true);
  });
});
