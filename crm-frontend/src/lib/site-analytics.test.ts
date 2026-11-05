import { describe, expect, it } from "vitest";
import {
  bounceRate,
  chartDays,
  change,
  conversions,
  DEFAULT_RANGE,
  duration,
  selectedRange,
  vitalRating,
  countryLabel,
  restoreRange,
} from "./site-analytics";
import { analyticsFixture } from "@/components/site-analytics/test-fixtures";
import { NAVIGATION, canSee } from "@/components/layout/nav-items";
import { lockedFor } from "./nav-access";
describe("website analytics presentation rules", () => {
  it("uses UTC days across local midnight and remembers relative presets", () => {
    expect(
      selectedRange(DEFAULT_RANGE, Date.parse("2026-11-06T00:15:00+05:30")),
    ).toEqual({ from: "2026-10-30", to: "2026-11-06" });
    expect(
      selectedRange(
        { preset: "today", from: "", to: "" },
        Date.parse("2026-11-06T22:00:00Z"),
      ),
    ).toEqual({ from: "2026-11-06", to: "2026-11-07" });
    expect(
      restoreRange({ preset: "unbounded", from: "", to: "" }),
    ).toBeUndefined();
  });
  it("handles inclusive custom dates with a strict 93-day limit and rejects rollover dates", () => {
    expect(
      selectedRange({ preset: "custom", from: "2026-01-01", to: "2026-04-03" }),
    ).toEqual({ from: "2026-01-01", to: "2026-04-04" });
    expect(
      selectedRange({ preset: "custom", from: "2026-01-01", to: "2026-04-04" }),
    ).toBeNull();
    expect(
      selectedRange({ preset: "custom", from: "2026-02-30", to: "2026-03-04" }),
    ).toBeNull();
  });
  it("uses started sessions for bounce rate, and counts only conversion events", () => {
    const report = analyticsFixture();
    expect(bounceRate(report)).toBe(0.25);
    expect(conversions(report)).toBe(9);
    expect(duration(72000)).toBe("1m 12s");
    expect(change(12, 0)).toBeNull();
    expect(change(0, 0)).toBe(0);
    expect(change(9, 6)).toBe(50);
  });
  it("fills missing UTC chart days and aligns the previous period by ordinal day", () => {
    const current = analyticsFixture(),
      previous = analyticsFixture();
    previous.from = "2026-10-25";
    previous.to = "2026-11-01";
    previous.timeseries = [{ day: "2026-10-25", visitors: 7, pageviews: 9 }];
    const rows = chartDays(current, previous, "visitors");
    expect(rows).toHaveLength(7);
    expect(rows[0]).toMatchObject({ value: 12, previous: 7 });
    expect(rows[2]).toMatchObject({ value: 0, previous: 0 });
  });
  it("uses the supplied metric thresholds at their boundaries", () => {
    expect(vitalRating("LCP", 2500)).toBe("good");
    expect(vitalRating("LCP", 4000)).toBe("needs-improvement");
    expect(vitalRating("LCP", 4001)).toBe("poor");
    expect(vitalRating("INP", 500)).toBe("needs-improvement");
    expect(vitalRating("CLS", 0.25)).toBe("needs-improvement");
    expect(countryLabel("IN")).toContain("India");
  });
  it("keeps Analytics after Dashboard, blocked for Staff and Team Leads even if picked", () => {
    const item = NAVIGATION[1];
    expect(item).toMatchObject({
      key: "analytics",
      href: "/analytics",
      name: "Analytics",
    });
    for (const role of ["Staff", "Team Lead"]) {
      expect(lockedFor(role)).toContain("analytics");
      expect(
        canSee(item, { role, department: "Sales", navAccess: ["analytics"] }),
      ).toBe(false);
    }
    for (const role of ["Admin", "Super Admin", "Manager"])
      expect(canSee(item, { role, department: "", navAccess: null })).toBe(
        true,
      );
  });
});
