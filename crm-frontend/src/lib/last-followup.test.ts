import { afterEach, describe, expect, it, vi } from "vitest";
import { followUpTimestamp, lastFollowupView } from "./last-followup";

// Fixed clock so the timeAgo label is asserted exactly rather than against a
// moving "now" that could tick across a day boundary mid-assertion. Anchored in
// local terms because that is how followUpTimestamp reads the stored date, so
// the assertions below hold in any timezone.
const NOW = new Date(2026, 8, 30, 12, 0, 0);

const row = (over: Partial<Parameters<typeof lastFollowupView>[0]> = {}) => ({
  rawId: 42,
  lastFollowedUpDate: "2026-09-25",
  ...over,
});

// Narrows the union for the property assertions, and fails with a readable
// message when a row that should render a follow-up silently falls back.
const ready = (over: Parameters<typeof row>[0] = {}) => {
  const view = lastFollowupView(row(over));
  if (view.state !== "ready") throw new Error("expected a ready view, got none");
  return view;
};

afterEach(() => {
  vi.useRealTimers();
});

describe("followUpTimestamp", () => {
  it("returns null for a missing or empty date", () => {
    expect(followUpTimestamp(null, "10:30")).toBeNull();
    expect(followUpTimestamp(undefined, "10:30")).toBeNull();
    expect(followUpTimestamp("", "10:30")).toBeNull();
  });

  it("returns null for a date it cannot read", () => {
    expect(followUpTimestamp("not-a-date", null)).toBeNull();
    expect(followUpTimestamp("2026-13-45", null)).toBeNull();
    // Day 31 of a 30-day month has no calendar meaning; the Date constructor
    // would silently roll it into the next month instead of failing.
    expect(followUpTimestamp("2026-02-31", null)).toBeNull();
  });

  it("reads the calendar date in local time, not UTC midnight", () => {
    // new Date("2026-09-25") is UTC midnight, which is the 24th west of
    // Greenwich. The column has to show the day the follow-up was logged.
    const at = followUpTimestamp("2026-09-25", null);
    expect(at).not.toBeNull();
    expect(at!.getFullYear()).toBe(2026);
    expect(at!.getMonth()).toBe(8);
    expect(at!.getDate()).toBe(25);
    expect(at!.getHours()).toBe(0);
  });

  it("applies the stored time to the date", () => {
    const at = followUpTimestamp("2026-09-25", "10:30:00");
    expect(at!.getHours()).toBe(10);
    expect(at!.getMinutes()).toBe(30);
    expect(at!.getSeconds()).toBe(0);
    // The whole point of applying the hour: a 10:30 follow-up is not midnight.
    expect(at!.getTime()).not.toBe(followUpTimestamp("2026-09-25", null)!.getTime());
  });

  it("ignores the seconds in a stored time", () => {
    expect(followUpTimestamp("2026-09-25", "14:45:59")!.getMinutes()).toBe(45);
  });

  it("falls back to midnight for an unusable time", () => {
    expect(followUpTimestamp("2026-09-25", "not-a-time")!.getHours()).toBe(0);
    expect(followUpTimestamp("2026-09-25", "25:00")!.getHours()).toBe(0);
    expect(followUpTimestamp("2026-09-25", "10:99")!.getHours()).toBe(0);
  });

  it("accepts a Date instance as the stored date", () => {
    // The value arrives from a raw SQL query, so mysql2 may hand back a Date
    // rather than a string. String() on one yields "Fri Sep 25", which parses
    // to NaN — the column would read as "no follow-up" for every lead.
    const at = followUpTimestamp(new Date(2026, 8, 25, 10, 30), null);
    expect(at).not.toBeNull();
    expect(at!.getFullYear()).toBe(2026);
    expect(at!.getMonth()).toBe(8);
    expect(at!.getDate()).toBe(25);
  });

  it("applies the stored time onto a Date instance", () => {
    const at = followUpTimestamp(new Date(2026, 8, 25, 10, 30), "14:45:00");
    expect(at!.getHours()).toBe(14);
    expect(at!.getMinutes()).toBe(45);
  });

  it("returns null for an invalid Date instance", () => {
    expect(followUpTimestamp(new Date("nonsense"), null)).toBeNull();
  });
});

describe("lastFollowupView", () => {
  it("has no view when there is no follow-up date", () => {
    expect(lastFollowupView(row({ lastFollowedUpDate: null }))).toEqual({ state: "none" });
    expect(lastFollowupView(row({ lastFollowedUpDate: "" }))).toEqual({ state: "none" });
    expect(lastFollowupView(row({ lastFollowedUpDate: "not-a-date" }))).toEqual({ state: "none" });
  });

  it("has no view when the date is absent from the row", () => {
    expect(lastFollowupView({ rawId: 1, lastFollowedUpDate: null })).toEqual({ state: "none" });
  });

  it("has a view for a date with a time that resolves", () => {
    const view = lastFollowupView(
      row({ lastFollowedUpDate: "2026-09-25", lastFollowedUpTime: "10:30:00" }),
    );
    expect(view.state).toBe("ready");
  });

  it("labels the follow-up with the shared relative-time wording", () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);

    expect(ready({ lastFollowedUpDate: "2026-09-30", lastFollowedUpTime: "12:00" }).label).toBe(
      "just now",
    );
    expect(ready({ lastFollowedUpDate: "2026-09-27" }).label).toBe("3d ago");
    // The stored hour still reaches timeAgo, so a follow-up logged this morning
    // reads as hours rather than as yesterday.
    expect(ready({ lastFollowedUpDate: "2026-09-30", lastFollowedUpTime: "09:00:00" }).label).toBe(
      "3h ago",
    );
  });

  it("carries an absolute timestamp for the cell title", () => {
    expect(ready({ lastFollowedUpDate: "2026-09-25", lastFollowedUpTime: "14:30:00" }).absolute).toBe(
      "25 Sept 2026 · 2:30 PM",
    );
  });

  it("keeps the title on the stored day whatever the timezone", () => {
    // Re-reading the raw "YYYY-MM-DD" would resolve as UTC midnight and print
    // the 24th anywhere west of Greenwich, contradicting the relative label.
    for (const tz of ["UTC", "America/Los_Angeles", "Asia/Kolkata", "Pacific/Kiritimati"]) {
      const previous = process.env.TZ;
      process.env.TZ = tz;
      try {
        const view = ready({ lastFollowedUpDate: "2026-09-25", lastFollowedUpTime: "14:30:00" });
        expect(view.absolute, tz).toBe("25 Sept 2026 · 2:30 PM");
      } finally {
        process.env.TZ = previous;
      }
    }
  });

  it("trims the notes", () => {
    expect(
      ready({ lastFollowedUpDate: "2026-09-25", lastFollowedUpNotes: "  Owner wants a viewing.  " })
        .notes,
    ).toBe("Owner wants a viewing.");
  });

  it("reports no notes when they are missing or blank", () => {
    expect(ready({ lastFollowedUpDate: "2026-09-25" }).notes).toBeNull();
    expect(ready({ lastFollowedUpDate: "2026-09-25", lastFollowedUpNotes: null }).notes).toBeNull();
    expect(ready({ lastFollowedUpDate: "2026-09-25", lastFollowedUpNotes: "   " }).notes).toBeNull();
  });

  it("links to the lead's follow-up tab", () => {
    expect(ready().href).toBe("/leads/42?tab=followups");
    expect(ready({ rawId: "import-7" }).href).toBe("/leads/import-7?tab=followups");
  });

  it("still builds a full view when the date arrives as a Date", () => {
    // The failure this guards is total and silent: every follow-up cell would
    // render as "—" while the tooltip, the title and the link all disappeared.
    const view = ready({
      lastFollowedUpDate: new Date(2026, 8, 25),
      lastFollowedUpTime: "14:30:00",
      lastFollowedUpNotes: "Owner wants a viewing.",
    });
    expect(view.state).toBe("ready");
    expect(view).toMatchObject({
      absolute: "25 Sept 2026 · 2:30 PM",
      notes: "Owner wants a viewing.",
      href: "/leads/42?tab=followups",
    });
  });
});
