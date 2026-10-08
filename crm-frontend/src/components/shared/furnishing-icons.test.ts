import { describe, expect, it } from "vitest";
import { FURNISHING_ICONS, getFurnishingIcon } from "./furnishing-icons";
import { Sparkles } from "lucide-react";

describe("FURNISHING_ICONS registry", () => {
  it("has unique names with a defined component each", () => {
    const names = FURNISHING_ICONS.map((i) => i.name);
    expect(new Set(names).size).toBe(names.length);
    for (const entry of FURNISHING_ICONS) {
      expect(entry.Icon).toBeDefined();
      expect(entry.label.trim()).not.toBe("");
    }
  });

  it("covers everyday furnishing items", () => {
    const names = FURNISHING_ICONS.map((i) => i.name);
    for (const must of ["Sofa", "Tv", "Refrigerator", "WashingMachine", "BedDouble"]) {
      expect(names).toContain(must);
    }
  });
});

describe("getFurnishingIcon", () => {
  it("resolves a known icon name", () => {
    const Icon = getFurnishingIcon("Sofa");
    expect(Icon).toBeDefined();
    expect(Icon).not.toBe(Sparkles);
  });

  it("falls back for unknown or missing names", () => {
    expect(getFurnishingIcon("Nope")).toBe(Sparkles);
    expect(getFurnishingIcon(null)).toBe(Sparkles);
    expect(getFurnishingIcon(undefined)).toBe(Sparkles);
  });
});
