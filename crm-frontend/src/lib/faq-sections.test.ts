// crm/crm-frontend/src/lib/faq-sections.test.ts
import { describe, expect, it } from "vitest";
import {
  FAQ_SECTIONS,
  displaySectionOf,
  hasFaqSections,
  sectionOf,
} from "./faq-sections";

describe("FAQ_SECTIONS", () => {
  it("uses exactly the site sub-page slugs, so stored sections render", () => {
    // Contract: these ids must equal the site's section keys
    // (overview/amenities/floor-plan/locality/photos). A typo here would
    // silently file FAQs under a tab the site never reads.
    expect(FAQ_SECTIONS.map((s) => s.id)).toEqual([
      "overview",
      "amenities",
      "floor-plan",
      "locality",
      "photos",
    ]);
  });
});

describe("hasFaqSections", () => {
  it("is true only for the multi-page property types", () => {
    for (const t of ["apartment", "villa", "individual_portion"]) {
      expect(hasFaqSections(t)).toBe(true);
    }
  });

  it("is false for single-page types and missing values", () => {
    for (const t of [
      "plot",
      "farmland",
      "commercial",
      "coworking",
      "industrial",
      "other",
      "",
      null,
      undefined,
    ]) {
      expect(hasFaqSections(t)).toBe(false);
    }
  });
});

describe("sectionOf / displaySectionOf", () => {
  it("defaults missing sections to overview", () => {
    expect(sectionOf(null)).toBe("overview");
    expect(sectionOf({})).toBe("overview");
    expect(sectionOf({ section: "" })).toBe("overview");
    expect(sectionOf({ section: "amenities" })).toBe("amenities");
  });

  it("files unknown sections under overview for display without rewriting them", () => {
    expect(displaySectionOf({ section: "general" })).toBe("overview");
    expect(displaySectionOf({ section: "amenities" })).toBe("amenities");
  });
});
