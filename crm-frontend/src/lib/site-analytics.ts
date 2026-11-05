export type Dimension = {
  label: string;
  pageviews: number;
  visitors?: number;
  avg_engagement_ms?: number;
};
export type AnalyticsEvent = {
  kind: string;
  name: string;
  events: number;
  sessions: number;
  status_code?: number;
};
export type VitalName = "LCP" | "INP" | "CLS" | "FCP" | "TTFB";
export type Vital = {
  name: VitalName;
  samples: number;
  p75: number;
  p50: number;
  p95: number;
  good_samples: number;
  needs_improvement_samples?: number;
  poor_samples?: number;
};
export type RouteVitals = { route: string; samples?: number } & Partial<
  Record<VitalName, number>
>;
export interface SiteReport {
  from: string;
  to: string;
  timezone: string;
  overview: {
    pageviews: number;
    visitors: number;
    sessions: number;
    started_sessions: number;
    bounced_sessions: number;
    bounce_rate: number;
    avg_engagement_ms: number;
    engaged_ms: number;
  };
  timeseries: {
    day: string;
    pageviews: number;
    visitors: number;
    sessions?: number;
  }[];
  dimensions: Record<string, Dimension[]>;
  entries: { path: string; sessions: number }[];
  exits: { path: string; sessions: number }[];
  events: AnalyticsEvent[];
  performance: Vital[];
  performance_by_route?: RouteVitals[];
  realtime?: { visitors: number; pageviews: number } | null;
}
export type SiteStatus = {
  enabled: boolean;
  available?: boolean;
  ready?: boolean;
  reason?: string | null;
  events?: number;
  last_received_at?: string | null;
};
export type RangeSelection = {
  preset: "today" | "7" | "30" | "90" | "custom";
  from: string;
  to: string;
};
export const DEFAULT_RANGE: RangeSelection = { preset: "7", from: "", to: "" };
const DAY = 86400_000;
export const utcDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);
export function restoreRange(raw: unknown): RangeSelection | undefined {
  if (!raw || typeof raw !== "object") return;
  const r = raw as Partial<RangeSelection>;
  if (
    !["today", "7", "30", "90", "custom"].includes(r.preset ?? "") ||
    typeof r.from !== "string" ||
    typeof r.to !== "string"
  )
    return;
  return r as RangeSelection;
}
export function selectedRange(selection: RangeSelection, now = Date.now()) {
  const today = Date.parse(utcDate(now));
  if (selection.preset !== "custom") {
    const days = selection.preset === "today" ? 1 : Number(selection.preset);
    return {
      from: utcDate(today - (days - 1) * DAY),
      to: utcDate(today + DAY),
    };
  }
  const valid = (s: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(s) &&
    Number.isFinite(Date.parse(s)) &&
    utcDate(Date.parse(s)) === s;
  if (
    !valid(selection.from) ||
    !valid(selection.to) ||
    selection.from > selection.to ||
    Date.parse(selection.to) - Date.parse(selection.from) >= 93 * DAY
  )
    return null;
  return { from: selection.from, to: utcDate(Date.parse(selection.to) + DAY) };
}
export const number = (n: number) =>
  new Intl.NumberFormat("en-IN", { maximumFractionDigits: 1 }).format(
    Number.isFinite(n) ? n : 0,
  );
export const percent = (n: number) => `${number(n * 100)}%`;
export function duration(ms: number) {
  const seconds = Math.max(0, Math.round(ms / 1000));
  return seconds >= 60
    ? `${Math.floor(seconds / 60)}m ${seconds % 60}s`
    : `${seconds}s`;
}
export function change(
  current: number,
  previous: number | undefined,
): number | null {
  if (previous === undefined || (previous === 0 && current !== 0)) return null;
  return previous === 0 ? 0 : ((current - previous) / previous) * 100;
}
export const bounceRate = (r: SiteReport) =>
  r.overview.started_sessions > 0
    ? r.overview.bounced_sessions / r.overview.started_sessions
    : 0;
export const conversions = (r: SiteReport) =>
  r.events
    .filter((e) => e.kind === "conversion")
    .reduce((sum, e) => sum + e.events, 0);
export const THRESHOLDS: Record<VitalName, [number, number]> = {
  LCP: [2500, 4000],
  INP: [200, 500],
  CLS: [0.1, 0.25],
  FCP: [1800, 3000],
  TTFB: [800, 1800],
};
export const vitalRating = (name: VitalName, value: number) =>
  value <= THRESHOLDS[name][0]
    ? "good"
    : value <= THRESHOLDS[name][1]
      ? "needs-improvement"
      : "poor";
export const vitalValue = (name: VitalName, value: number | undefined) =>
  value === undefined
    ? "—"
    : name === "CLS"
      ? new Intl.NumberFormat("en-IN", { maximumFractionDigits: 3 }).format(
          value,
        )
      : value >= 1000
        ? `${number(value / 1000)} s`
        : `${number(value)} ms`;
export const unknown = (label: string) =>
  !label || ["(unknown)", "unknown"].includes(label.toLowerCase());
export function countryLabel(code: string) {
  if (unknown(code)) return "Unknown";
  if (!/^[A-Z]{2}$/.test(code)) return code;
  const flag = [...code]
    .map((c) => String.fromCodePoint(127397 + c.charCodeAt(0)))
    .join("");
  try {
    return `${flag} ${new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code}`;
  } catch {
    return `${flag} ${code}`;
  }
}
export function chartDays(
  current: SiteReport,
  previous: SiteReport | null,
  metric: "visitors" | "pageviews",
) {
  const length = Math.min(
    93,
    Math.round((Date.parse(current.to) - Date.parse(current.from)) / DAY),
  );
  const rows = new Map(current.timeseries.map((r) => [r.day, r[metric]]));
  const prior = new Map(
    previous?.timeseries.map((r) => [r.day, r[metric]]) ?? [],
  );
  return Array.from({ length }, (_, i) => ({
    day: utcDate(Date.parse(current.from) + i * DAY),
    value: rows.get(utcDate(Date.parse(current.from) + i * DAY)) ?? 0,
    previousDay: previous ? utcDate(Date.parse(previous.from) + i * DAY) : null,
    previous: previous
      ? (prior.get(utcDate(Date.parse(previous.from) + i * DAY)) ?? 0)
      : null,
  }));
}
export const EVENT_LABELS: Record<string, string> = {
  phone_click: "Phone clicks",
  email_click: "Email clicks",
  whatsapp_click: "WhatsApp clicks",
  outbound_click: "Outbound clicks",
  download_click: "Downloads",
  search: "Searches",
  wishlist_add: "Wishlist additions",
  wishlist_remove: "Wishlist removals",
  enquiry_submitted: "Enquiries",
  site_visit_requested: "Site visits",
  owner_submission: "Owner submissions",
  registration_completed: "Registrations",
  javascript_error: "JavaScript errors",
  unhandled_rejection: "Unhandled rejections",
  api_error: "API errors",
};
