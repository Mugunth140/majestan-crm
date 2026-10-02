import { describe, expect, it } from "vitest";
import { lightboxStep } from "./image-lightbox";

describe("lightboxStep", () => {
  it("steps forward and back inside the gallery", () => {
    expect(lightboxStep(0, 5, 1)).toBe(1);
    expect(lightboxStep(3, 5, -1)).toBe(2);
  });

  it("wraps around both ends", () => {
    expect(lightboxStep(4, 5, 1)).toBe(0);
    expect(lightboxStep(0, 5, -1)).toBe(4);
  });

  it("stays at zero for a single or empty gallery", () => {
    expect(lightboxStep(0, 1, 1)).toBe(0);
    expect(lightboxStep(0, 1, -1)).toBe(0);
    expect(lightboxStep(0, 0, 1)).toBe(0);
  });
});
