// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiJson } from "@/lib/api-fetch";
import { analyticsFixture } from "./test-fixtures";
import { useSiteAnalytics } from "./use-site-analytics";

vi.mock("@/lib/api-fetch", () => ({ apiJson: vi.fn() }));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});
describe("website analytics loading and live refresh", () => {
  it("polls every 30 seconds only when visible and retains historical data", async () => {
    const report = analyticsFixture();
    vi.mocked(apiJson).mockImplementation(async (input) => ({
      data: String(input).endsWith("/status")
        ? { enabled: true, available: true }
        : report,
    }));
    const timer = vi.spyOn(globalThis, "setInterval");
    const { result } = renderHook(() =>
      useSiteAnalytics({ from: report.from, to: report.to }),
    );
    await waitFor(() =>
      expect(result.current.report?.overview.visitors).toBe(114),
    );
    const poll = timer.mock.calls.find(
      ([, ms]) => ms === 30_000,
    )?.[0] as () => void;
    const before = vi.mocked(apiJson).mock.calls.length;
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    await act(async () => {
      poll();
    });
    expect(apiJson).toHaveBeenCalledTimes(before);
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
    const changed = {
      ...report,
      overview: { ...report.overview, visitors: 999 },
      realtime: { visitors: 8, pageviews: 12 },
    };
    vi.mocked(apiJson).mockResolvedValue({ data: changed });
    await act(async () => {
      poll();
    });
    expect(result.current.report?.realtime?.visitors).toBe(8);
    expect(result.current.report?.overview.visitors).toBe(114);
  });
  it("shows configured-unavailable status reasons without affecting other CRM modules", async () => {
    vi.mocked(apiJson).mockImplementation(async (input) => ({
      data: String(input).endsWith("/status")
        ? { enabled: true, available: false, reason: "Storage is locked" }
        : analyticsFixture(),
    }));
    const { result } = renderHook(() =>
      useSiteAnalytics({ from: "2026-11-01", to: "2026-11-08" }),
    );
    await waitFor(() => expect(result.current.error).toBe("Storage is locked"));
    expect(result.current.loading).toBe(false);
  });
  it("does not reuse an old error when changing the range", async () => {
    vi.mocked(apiJson).mockRejectedValue(new Error("Unavailable"));
    const { result, rerender } = renderHook(
      ({ from }) => useSiteAnalytics({ from, to: "2026-11-08" }),
      { initialProps: { from: "2026-11-01" } },
    );
    await waitFor(() => expect(result.current.error).toBe("Unavailable"));
    vi.mocked(apiJson).mockImplementation(() => new Promise(() => {}));
    rerender({ from: "2026-11-02" });
    expect(result.current.loading).toBe(true);
    expect(result.current.error).toBeNull();
  });
});
