import { describe, expect, it } from "vitest";
import { periodLabel, shareOfFirst } from "./journey";
import type { JourneyStage } from "./types";

const st = (key: string, value: number): JourneyStage => ({ key, label: key, detail: "", say: ["", ""], value, prev: 0 });

describe("status journey", () => {
  it("shows each step as a share of what came in", () => {
    const stages = [st("new", 40), st("contacted", 30), st("shared", 50), st("visit", 0)];
    expect(stages.map((_, i) => shareOfFirst(stages, i))).toEqual([100, 75, 125, 0]);
    expect(shareOfFirst([st("new", 0), st("contacted", 3)], 1)).toBeNull();
  });
  it("labels the picked period, or a single day", () => {
    expect(periodLabel("2026-10-26", "2026-11-24")).toBe("26 Oct – 24 Nov");
    expect(periodLabel("2026-11-24", "2026-11-24")).toBe("24 Nov");
  });
});
