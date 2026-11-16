import { describe, expect, it } from "vitest";
import { formatWait, waitTone, workMinutesBetween } from "./first-contact";

// UTC times; 03:30Z is 9:00 IST and 13:00Z is 18:30 IST.
describe("workMinutesBetween", () => {
  it("counts working time inside a day", () => {
    expect(workMinutesBetween("2026-11-10T04:30:00Z", "2026-11-10T05:15:00Z")).toBe(45);
  });
  it("skips nights and Sundays", () => {
    expect(workMinutesBetween("2026-11-10T12:30:00Z", "2026-11-11T04:30:00Z")).toBe(90);
    expect(workMinutesBetween("2026-11-14T12:30:00Z", "2026-11-16T04:00:00Z")).toBe(60);
  });
  it("gives 0 for bad or reversed times", () => {
    expect(workMinutesBetween("nope", "2026-11-10T05:15:00Z")).toBe(0);
    expect(workMinutesBetween("2026-11-11T05:00:00Z", "2026-11-10T05:00:00Z")).toBe(0);
  });
});

describe("waitTone", () => {
  it("turns amber at 15 working minutes and red at the hour", () => {
    expect(waitTone(14)).toBe("fresh");
    expect(waitTone(15)).toBe("due");
    expect(waitTone(59)).toBe("due");
    expect(waitTone(60)).toBe("late");
  });
});

describe("formatWait", () => {
  it("reads as minutes, hours or working days", () => {
    expect(formatWait(12)).toBe("12m");
    expect(formatWait(60)).toBe("1h");
    expect(formatWait(130)).toBe("2h 10m");
    expect(formatWait(570 * 3 + 20)).toBe("3d");
  });
});
