import { describe, expect, it } from "vitest";
import { INBOUND_CALL_TRACKING, MANAGE_BLOG } from "./permissions";
import { keysForRole, needsDepartment, withPermission } from "./user-access";

describe("user access", () => {
  it("asks for a department only for Team Leads and Staff", () => {
    expect(needsDepartment("3")).toBe(true);
    expect(needsDepartment(4)).toBe(true);
    expect(needsDepartment("1")).toBe(false);
    expect(needsDepartment("")).toBe(false);
  });

  it("switches one permission without touching the others", () => {
    expect(withPermission(["other.key"], MANAGE_BLOG, true)).toEqual(["other.key", MANAGE_BLOG]);
    expect(withPermission(["other.key", MANAGE_BLOG], MANAGE_BLOG, true)).toEqual(["other.key", MANAGE_BLOG]);
    expect(withPermission(["other.key", MANAGE_BLOG], MANAGE_BLOG, false)).toEqual(["other.key"]);
  });

  it("drops inbound tracking when the role has it built in", () => {
    expect(keysForRole([INBOUND_CALL_TRACKING, MANAGE_BLOG], "2")).toEqual([MANAGE_BLOG]);
    expect(keysForRole([INBOUND_CALL_TRACKING], "4")).toEqual([INBOUND_CALL_TRACKING]);
  });
});
