import { describe, expect, it } from "vitest";
import { builderScoreFields, completeness, completenessLabel, isFilled, leadScoreFields, propertyScoreFields } from "./record-score";

describe("record completeness", () => {
  it("counts filled fields; blanks, empty lists and objects don't count but 0 and false do", () => {
    expect([null, undefined, "", "  ", [], {}].map(isFilled)).toEqual([false, false, false, false, false, false]);
    expect([0, false, "x", [1], { a: 1 }].map(isFilled)).toEqual([true, true, true, true, true]);
    expect(completeness([["A", "x"], ["B", ""], ["C", 3], ["D", null]])).toEqual({ score: 50, missing: ["B", "D"] });
  });

  it("names what's missing in the hover text", () => {
    expect(completenessLabel({ score: 100, missing: [] })).toBe("100% complete");
    expect(completenessLabel({ score: 40, missing: ["Email", "Website"] })).toBe("40% complete · Missing: Email, Website");
  });

  it("scores a lead on its contact details and requirements", () => {
    const { score, missing } = completeness(leadScoreFields({ name: "Pam", mobile_number: "98", inquiries: [] }));
    expect(score).toBe(22);
    expect(missing).toContain("Requirement");
  });

  it("scores a builder with every field filled as complete", () => {
    const builder = { name: "B", logoUrl: "l", website: "w", phone: "p", email: "e", experienceYears: 5, completedProjects: 0, ongoingProjects: 1, description: "d" };
    expect(completeness(builderScoreFields(builder)).score).toBe(100);
  });

  it("scores a property only on the fields its type can have", () => {
    const plot = propertyScoreFields({ propertyType: "plot", title: "Plot" }, (f) => f !== "bedrooms" && f !== "amenityIds");
    expect(plot.map(([label]) => label)).not.toContain("Bedrooms");
    expect(plot.map(([label]) => label)).not.toContain("Amenities");
  });
});
