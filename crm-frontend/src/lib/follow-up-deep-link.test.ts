import { describe, expect, it } from "vitest";
import { FOLLOW_UP_TAB, shouldAutoOpenFollowUps, wantsFollowUps } from "./follow-up-deep-link";

describe("wantsFollowUps", () => {
  it("recognises the tab value the leads table links to", () => {
    expect(FOLLOW_UP_TAB).toBe("followups");
    expect(wantsFollowUps(FOLLOW_UP_TAB)).toBe(true);
  });

  it("is false for an absent tab", () => {
    expect(wantsFollowUps(null)).toBe(false);
    expect(wantsFollowUps(undefined)).toBe(false);
    expect(wantsFollowUps("")).toBe(false);
  });

  it("is false for any other tab", () => {
    expect(wantsFollowUps("notes")).toBe(false);
    expect(wantsFollowUps("follow-up")).toBe(false);
  });

  it("matches exactly, so a near miss cannot hijack the sheet", () => {
    expect(wantsFollowUps("Followups")).toBe(false);
    expect(wantsFollowUps("followups ")).toBe(false);
  });
});

describe("shouldAutoOpenFollowUps", () => {
  const loaded = {
    wantsFollowUps: true,
    isLoading: false,
    hasLead: true,
    alreadyOpened: false,
  };

  it("opens the timeline on a deep link to a loaded lead", () => {
    expect(shouldAutoOpenFollowUps(loaded)).toBe(true);
  });

  it("waits while the lead is still loading", () => {
    // Opening first would let the fetch win the race and leave the sheet empty.
    expect(shouldAutoOpenFollowUps({ ...loaded, isLoading: true })).toBe(false);
  });

  it("waits until a lead is in hand", () => {
    expect(shouldAutoOpenFollowUps({ ...loaded, hasLead: false })).toBe(false);
  });

  it("stays shut on a plain visit with no tab param", () => {
    expect(shouldAutoOpenFollowUps({ ...loaded, wantsFollowUps: false })).toBe(false);
  });

  it("does not reopen after the user closes the sheet", () => {
    expect(shouldAutoOpenFollowUps({ ...loaded, alreadyOpened: true })).toBe(false);
  });
});