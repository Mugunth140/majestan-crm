"use client";
import { useCallback, useEffect, useState } from "react";
import { apiJson } from "@/lib/api-fetch";
import type { SiteReport, SiteStatus } from "@/lib/site-analytics";

const API = "/api/v1/site-analytics";
export function useSiteAnalytics(range: { from: string; to: string } | null) {
  const [state, setState] = useState<{
    report: SiteReport | null;
    previous: SiteReport | null;
    error: string | null;
    comparisonError: string | null;
    loading: boolean;
    liveError: boolean;
    key: string;
  }>({
    report: null,
    previous: null,
    error: null,
    comparisonError: null,
    loading: true,
    liveError: false,
    key: "",
  });
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => {
    setState((s) => ({ ...s, loading: true, error: null }));
    setVersion((n) => n + 1);
  }, []);
  const from = range?.from,
    to = range?.to;
  useEffect(() => {
    if (!from || !to) return;
    const controller = new AbortController();
    const params = `?from=${from}&to=${to}`;
    const key = `${from}:${to}`;
    // Defer state updates to the async request, keeping effect lifecycle pure.
    async function load() {
      const current = apiJson<{ data: SiteReport }>(`${API}/report${params}`, {
        signal: controller.signal,
      });
      const comparison = apiJson<{ data: SiteReport }>(
        `${API}/compare${params}`,
        { signal: controller.signal },
      );
      const status = apiJson<{ data: SiteStatus }>(`${API}/status`, {
        signal: controller.signal,
      });
      const [r, p, s] = await Promise.allSettled([current, comparison, status]);
      if (controller.signal.aborted) return;
      if (
        s.status === "fulfilled" &&
        (!s.value.data.enabled ||
          s.value.data.available === false ||
          s.value.data.ready === false)
      ) {
        setState({
          report: null,
          previous: null,
          error:
            s.value.data.reason ||
            "Website analytics is disabled or unavailable on the site backend.",
          comparisonError: null,
          loading: false,
          liveError: true,
          key,
        });
        return;
      }
      if (r.status === "rejected") {
        setState({
          report: null,
          previous: null,
          error:
            r.reason instanceof Error
              ? r.reason.message
              : "Website analytics is unavailable.",
          comparisonError: null,
          loading: false,
          liveError: true,
          key,
        });
        return;
      }
      setState({
        report: r.value.data,
        previous: p.status === "fulfilled" ? p.value.data : null,
        error: null,
        comparisonError:
          p.status === "rejected"
            ? "The previous period could not be loaded. Changes are unavailable."
            : null,
        loading: false,
        liveError: false,
        key,
      });
    }
    void load();
    return () => controller.abort();
  }, [from, to, version]);
  useEffect(() => {
    if (!from || !to) return;
    let busy = false;
    const controller = new AbortController();
    async function poll() {
      if (document.hidden || busy) return;
      busy = true;
      try {
        const response = await apiJson<{ data: SiteReport }>(
          `${API}/report?from=${from}&to=${to}`,
          { signal: controller.signal },
        );
        if (!controller.signal.aborted)
          setState((s) => ({
            ...s,
            report: s.report
              ? { ...s.report, realtime: response.data.realtime }
              : null,
            liveError: false,
          }));
      } catch {
        if (!controller.signal.aborted)
          setState((s) => ({ ...s, liveError: true }));
      } finally {
        busy = false;
      }
    }
    const timer = setInterval(() => {
      void poll();
    }, 30_000);
    const visible = () => {
      if (!document.hidden) void poll();
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      controller.abort();
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [from, to]);
  // On range changes the old data is not shown while its replacement loads.
  const current = state.key === `${from}:${to}`;
  const matches =
    current && state.report?.from === from && state.report?.to === to;
  return {
    ...state,
    error: current ? state.error : null,
    loading: range !== null && (state.loading || !current),
    report: matches ? state.report : null,
    previous: matches ? state.previous : null,
    refresh,
  };
}
