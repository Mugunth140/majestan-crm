import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { framing } from "./shot-stage";
import { SHOT_H, SHOT_W, SLIDES } from "./tour-data";
import { whatsNewSteps } from "./steps";

describe("tour framing", () => {
  it("shows the whole page when nothing is in focus", () => {
    expect(framing()).toEqual({ scale: 1, x: 0, y: 0 });
  });

  it("never pans the screenshot off the stage", () => {
    for (const focus of [[0, 0, 100, 40], [1340, 860, 100, 40], [700, 400, 40, 20]] as const) {
      const f = framing([...focus]);
      expect(f.scale).toBeGreaterThan(1);
      expect(f.scale).toBeLessThanOrEqual(2.2);
      expect(f.x).toBeLessThanOrEqual(0);
      expect(f.x).toBeGreaterThanOrEqual((1 - f.scale) * 100 - 1e-9);
      expect(f.y).toBeLessThanOrEqual(0);
      expect(f.y).toBeGreaterThanOrEqual((1 - f.scale) * 100 - 1e-9);
    }
  });
});

describe("tour content", () => {
  it("has a screenshot for every beat, and every region inside it", () => {
    for (const s of SLIDES) for (const b of s.beats) {
      expect(existsSync(join(process.cwd(), "public/onboarding", `${b.shot}.webp`)), b.shot).toBe(true);
      if (!b.focus) continue;
      const [x, y, w, h] = b.focus;
      expect(x >= 0 && y >= 0 && x + w <= SHOT_W && y + h <= SHOT_H, `${s.id}: ${b.text}`).toBe(true);
    }
  });
});

describe("what's new", () => {
  const release = (changes: { kind: "new" | "improved" | "fixed"; text: string; slide?: string }[]) => ({ version: "9.0.0", date: "2026-11-08", title: "t", changes });

  it("leaves out bug fixes", () => {
    expect(whatsNewSteps([release([{ kind: "fixed", text: "A fix" }])])).toEqual([]);
  });

  it("adds one slide per feature that has one, without repeats", () => {
    const steps = whatsNewSteps([release([
      { kind: "new", text: "Views", slide: "views" },
      { kind: "improved", text: "More views", slide: "views" },
      { kind: "new", text: "Search", slide: "search" },
      { kind: "fixed", text: "A fix", slide: "leads" },
    ])]);
    expect(steps.map((s) => s.id)).toEqual(["whats-new", "views", "search"]);
  });
});

describe("2.3.0", () => {
  it("opens What's new with the WhatsApp integration slide", async () => {
    const { RELEASES, releasesSince } = await import("@/lib/release");
    expect(RELEASES[0].version).toBe("2.3.0");
    const steps = whatsNewSteps(releasesSince("2.2.0", RELEASES), "Staff");
    expect(steps.map((s) => s.id).slice(0, 2)).toEqual(["whats-new", "whatsapp"]);
    expect(SLIDES.find((s) => s.id === "whatsapp")?.title).toBe("Introducing WhatsApp Integration");
  });
});
