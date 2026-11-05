import type { SiteReport } from "@/lib/site-analytics";
/** Test-only fixture. Production UI never substitutes sample data for a report. */
export function analyticsFixture(): SiteReport {
  return {
    from: "2026-11-01",
    to: "2026-11-08",
    timezone: "UTC",
    overview: {
      pageviews: 230,
      visitors: 114,
      sessions: 80,
      started_sessions: 60,
      bounced_sessions: 15,
      bounce_rate: 0.25,
      avg_engagement_ms: 72000,
      engaged_ms: 4320000,
    },
    timeseries: [
      { day: "2026-11-01", pageviews: 30, visitors: 12 },
      { day: "2026-11-02", pageviews: 41, visitors: 25 },
    ],
    dimensions: {
      path: Array.from({ length: 12 }, (_, i) => ({
        label: `/property-${i + 1}`,
        pageviews: 20 - i,
      })),
      route: [{ label: "/:inventory", pageviews: 162 }],
      hostname: [{ label: "www.majestanrealty.com", pageviews: 230 }],
      referrer: [{ label: "google.com", pageviews: 130 }],
      country: [
        { label: "(unknown)", pageviews: 100 },
        { label: "IN", pageviews: 90 },
        { label: "US", pageviews: 40 },
      ],
      device: [
        { label: "mobile", pageviews: 142 },
        { label: "desktop", pageviews: 88 },
      ],
      browser: [{ label: "Chrome", pageviews: 162 }],
      os: [{ label: "Android", pageviews: 142 }],
      language: [{ label: "en-IN", pageviews: 120 }],
      timezone: [{ label: "Asia/Kolkata", pageviews: 130 }],
    },
    entries: [{ path: "/projects", sessions: 48 }],
    exits: [{ path: "/projects", sessions: 32 }],
    events: [
      { kind: "conversion", name: "enquiry_submitted", events: 9, sessions: 7 },
      { kind: "interaction", name: "phone_click", events: 17, sessions: 14 },
      { kind: "error", name: "api_error", events: 2, sessions: 2 },
    ],
    performance: [
      {
        name: "LCP",
        samples: 47,
        p75: 2300,
        p50: 1700,
        p95: 4100,
        good_samples: 36,
      },
      {
        name: "INP",
        samples: 32,
        p75: 310,
        p50: 120,
        p95: 610,
        good_samples: 19,
      },
      {
        name: "CLS",
        samples: 41,
        p75: 0.12,
        p50: 0.04,
        p95: 0.28,
        good_samples: 29,
      },
    ],
    realtime: { visitors: 3, pageviews: 5 },
  };
}
