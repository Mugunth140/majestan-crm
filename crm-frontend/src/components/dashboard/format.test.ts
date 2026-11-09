import { describe, expect, it } from "vitest";
import { bucketLabel, delta, formatTick, formatValue, inr, syncedAgo } from "./format";

describe("dashboard format", () => {
  it("formats each metric kind the way staff read it", () => {
    expect(formatValue("n", 12345)).toBe("12,345");
    expect(formatValue("pct", 70.6)).toBe("71%");
    expect(formatValue("min", 45)).toBe("45 min");
    expect(formatValue("min", 160)).toBe("2.7 h");
    expect(formatValue("dur", 8280)).toBe("2.3 h");
    expect(formatValue("dur", 240)).toBe("4 min");
    expect(formatValue("hrs", 60)).toBe("2.5 d");
    expect(formatValue("n", null)).toBe("—");
  });

  it("writes rupees in lakh and crore", () => {
    expect(inr(4_50_000)).toBe("₹4.5 L");
    expect(inr(2_30_00_000)).toBe("₹2.3 Cr");
    expect(inr(9500)).toBe("₹9,500");
    expect(formatTick("n", 1500)).toBe("1.5k");
  });

  it("judges a change by the metric's better direction", () => {
    expect(delta(12, 10, "n", "up")).toEqual({ text: "+20%", direction: "up", verdict: "good" });
    expect(delta(12, 10, "min", "down")).toMatchObject({ verdict: "bad" });
    expect(delta(40, 44, "pct", "up")).toEqual({ text: "-4 pts", direction: "down", verdict: "bad" });
    expect(delta(3, 0, "n", "up")?.text).toBe("new");
    expect(delta(5, 5, "n", "up")?.verdict).toBe("neutral");
    expect(delta(null, 5, "n", "up")).toBeNull();
  });

  it("labels hour, day and week buckets", () => {
    expect(bucketLabel("9", "hour")).toBe("9a");
    expect(bucketLabel("15", "hour", true)).toBe("3 PM");
    expect(bucketLabel("2026-10-08", "day")).toBe("8 Oct");
    expect(bucketLabel("2026-10-08", "week", true)).toBe("Week of 8 Oct");
  });

  it("says how fresh the data is", () => {
    const now = Date.parse("2026-11-06T12:10:00Z");
    expect(syncedAgo("2026-11-06T12:09:30Z", now)).toBe("just now");
    expect(syncedAgo("2026-11-06T12:05:00Z", now)).toBe("5 min ago");
    expect(syncedAgo(null, now)).toBeNull();
  });
});
