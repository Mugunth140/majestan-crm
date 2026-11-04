import { describe, expect, it } from "vitest";
import { feedDay, feedTime } from "./feed-time";

const now = new Date(2026, 10, 4, 18, 0);

describe("feedTime", () => {
  it("counts minutes within the hour, then shows the clock time", () => {
    expect(feedTime(new Date(2026, 10, 4, 17, 59, 40), now)).toBe("Just now");
    expect(feedTime(new Date(2026, 10, 4, 17, 59), now)).toBe("1 min ago");
    expect(feedTime(new Date(2026, 10, 4, 17, 20), now)).toBe("40 mins ago");
    expect(feedTime(new Date(2026, 10, 4, 16, 50), now)).toBe("4:50 PM");
    expect(feedTime(new Date(2026, 9, 26, 9, 5), now)).toBe("9:05 AM");
  });
});

describe("feedDay", () => {
  it("names today and yesterday, then the date", () => {
    expect(feedDay(new Date(2026, 10, 4, 0, 5), now)).toBe("Today");
    expect(feedDay(new Date(2026, 10, 3, 23, 55), now)).toBe("Yesterday");
    expect(feedDay(new Date(2026, 9, 26, 12), now)).toBe("26th Oct");
    expect(feedDay(new Date(2025, 9, 26, 12), now)).toBe("26th Oct 2025");
  });
});
