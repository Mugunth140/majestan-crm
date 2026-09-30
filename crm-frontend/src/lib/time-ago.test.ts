import { describe, expect, it } from "vitest";
import { timeAgo } from "./time-ago";

const at = (ms: number) => new Date(Date.now() - ms).toISOString();
const S = 1000, M = 60 * S, H = 60 * M, D = 24 * H;

describe("timeAgo", () => {
  it("returns an empty string for missing input", () => {
    expect(timeAgo(undefined)).toBe("");
    expect(timeAgo(null)).toBe("");
    expect(timeAgo("")).toBe("");
  });

  it("returns an empty string for an unparseable date", () => {
    // Without the guard these fall through every comparison and render "NaNd ago".
    expect(timeAgo("not-a-date")).toBe("");
    expect(timeAgo("2026-13-45")).toBe("");
  });

  it("reads 'just now' under a minute", () => {
    expect(timeAgo(at(0))).toBe("just now");
    expect(timeAgo(at(59 * S))).toBe("just now");
  });

  it("steps through minutes, hours and days", () => {
    expect(timeAgo(at(60 * S))).toBe("1m ago");
    expect(timeAgo(at(59 * M))).toBe("59m ago");
    expect(timeAgo(at(60 * M))).toBe("1h ago");
    expect(timeAgo(at(23 * H))).toBe("23h ago");
    expect(timeAgo(at(24 * H))).toBe("1d ago");
    expect(timeAgo(at(30 * D))).toBe("30d ago");
  });

  it("caps at 90d+ so very stale leads stay readable", () => {
    expect(timeAgo(at(89 * D))).toBe("89d ago");
    expect(timeAgo(at(90 * D))).toBe("90d+");
    expect(timeAgo(at(400 * D))).toBe("90d+");
  });
});
