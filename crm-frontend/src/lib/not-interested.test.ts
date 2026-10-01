import { describe, expect, it, vi } from "vitest";
import { recordNotInterested } from "./not-interested";

const okJson = (extra: Record<string, unknown> = {}) => ({
  json: async () => ({ success: true, ...extra }),
});

describe("recordNotInterested", () => {
  it("records the follow-up first, then sets the status", async () => {
    const calls: Array<{ url: string; body: unknown }> = [];
    const fetchFn = vi.fn(async (url: string, init: { body: string }) => {
      calls.push({ url, body: JSON.parse(init.body) });
      return okJson();
    });

    await recordNotInterested(fetchFn as never, "/api/v1", 42, "  Already bought elsewhere ", "2026-09-30");

    expect(calls).toHaveLength(2);
    // Follow-up first so a failed record never strands a status change.
    expect(calls[0]).toEqual({
      url: "/api/v1/leads/42/follow-ups",
      body: {
        followUpDate: "2026-09-30",
        outcome: "Not Interested",
        notes: "Already bought elsewhere",
      },
    });
    expect(calls[1]).toEqual({
      url: "/api/v1/leads/42/status",
      body: { status_name: "Not Interested" },
    });
  });

  it("refuses an empty reason without calling anything", async () => {
    const fetchFn = vi.fn(async () => okJson());

    await expect(
      recordNotInterested(fetchFn as never, "/api/v1", 42, "   ", "2026-09-30"),
    ).rejects.toThrow("Reason is required");
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("aborts the status change when the follow-up record fails", async () => {
    const calls: string[] = [];
    const fetchFn = vi.fn(async (url: string) => {
      calls.push(url);
      if (url.endsWith("/follow-ups")) return { json: async () => ({ success: false }) };
      return okJson();
    });

    await expect(
      recordNotInterested(fetchFn as never, "/api/v1", 42, "Busy", "2026-09-30"),
    ).rejects.toThrow();
    expect(calls).toEqual(["/api/v1/leads/42/follow-ups"]);
  });
});
