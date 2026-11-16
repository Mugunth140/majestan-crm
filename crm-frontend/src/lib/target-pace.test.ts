import { describe, expect, it } from "vitest";
import { dayElapsed, dayPace, paceBand, paceOf, weekElapsed, weekPace } from "./target-pace";

// UTC instants; IST = UTC+5:30. 16 Nov 2026 is a Monday.
const at = (iso: string) => new Date(iso);

describe("paceBand", () => {
  it("splits at 40, 60 and 80 percent of pace", () => {
    expect(paceBand(39.9)).toBe("red");
    expect(paceBand(40)).toBe("orange");
    expect(paceBand(60)).toBe("yellow");
    expect(paceBand(79.9)).toBe("yellow");
    expect(paceBand(80)).toBe("green");
    expect(paceBand(140)).toBe("green");
  });
});

describe("dayElapsed", () => {
  it("runs from 9:00 to 18:30 IST", () => {
    expect(dayElapsed(at("2026-11-16T03:00:00Z"))).toBe(0); // 8:30
    expect(dayElapsed(at("2026-11-16T08:15:00Z"))).toBeCloseTo(0.5, 5); // 13:45
    expect(dayElapsed(at("2026-11-16T14:00:00Z"))).toBe(1); // 19:30
  });
  it("is 0 on Sunday", () => {
    expect(dayElapsed(at("2026-11-15T08:00:00Z"))).toBe(0);
  });
});

describe("dayPace", () => {
  it("does not mark a person red at lunch for half a day's calls", () => {
    // 13:45 IST, half the day gone: 50 of 120 calls is 83% of pace.
    expect(dayPace(50, 120, at("2026-11-16T08:15:00Z"))?.band).toBe("green");
    expect(dayPace(20, 120, at("2026-11-16T08:15:00Z"))?.band).toBe("red");
  });
  it("judges the plain result once the day is over", () => {
    expect(dayPace(90, 120, at("2026-11-16T14:00:00Z"))).toEqual({ band: "yellow", pct: 75 });
  });
  it("stays neutral before work starts with nothing done", () => {
    expect(dayPace(0, 120, at("2026-11-16T02:00:00Z"))).toBeNull();
    expect(dayPace(3, 120, at("2026-11-16T02:00:00Z"))?.band).toBe("green");
  });
});

describe("weekElapsed", () => {
  it("counts working days of the task week", () => {
    // Week 3 of Nov 2026 is days 15–21; the 15th is a Sunday, so 6 working days.
    // Monday 16th at 18:30 IST: one full day of six.
    expect(weekElapsed(at("2026-11-16T13:00:00Z"))).toBeCloseTo(1 / 6, 5);
    expect(weekPace(20, 120, at("2026-11-16T13:00:00Z"))?.band).toBe("green");
  });
});

describe("paceOf", () => {
  it("is null when nothing is expected yet and nothing done", () => {
    expect(paceOf(0, 0)).toBeNull();
  });
});
