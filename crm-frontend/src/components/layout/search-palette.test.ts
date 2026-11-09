import { describe, expect, it } from "vitest";
import { scopesMatching } from "./search-palette";

const all = ["leads", "inbound", "partners", "properties", "projects", "builders", "hr", "assets", "users"];

describe("scopesMatching", () => {
  it("offers a module from the first letters of its name", () => {
    expect(scopesMatching("inb", all).map((s) => s.key)).toEqual(["inbound"]);
    expect(scopesMatching("pro", all).map((s) => s.key)).toEqual(["properties", "projects"]);
    expect(scopesMatching("inbound:", all).map((s) => s.key)).toEqual(["inbound"]);
  });

  it("knows other words for a module", () => {
    expect(scopesMatching("partner", all).map((s) => s.key)).toEqual(["partners"]);
    expect(scopesMatching("staff", all).map((s) => s.key)).toEqual(["users"]);
    expect(scopesMatching("cand", all).map((s) => s.key)).toEqual(["hr"]);
  });

  it("never offers a module the user can't open", () => {
    expect(scopesMatching("inb", ["leads"])).toEqual([]);
    expect(scopesMatching("", all)).toEqual([]);
  });
});
