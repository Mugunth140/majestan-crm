import type { Better, Fmt, MetricOut, RangeKey } from "./types";

const int = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
const one = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 1 });

export const RANGES: { value: RangeKey; label: string; short: string }[] = [
  { value: "today", label: "Today", short: "Today" },
  { value: "7d", label: "Last 7 days", short: "7 days" },
  { value: "30d", label: "Last 30 days", short: "30 days" },
  { value: "6m", label: "Last 6 months", short: "6 months" },
];

/** Rupees in lakh and crore, the way the business reads them. */
export function inr(v: number) {
  const a = Math.abs(v);
  if (a >= 1e7) return `₹${one.format(v / 1e7)} Cr`;
  if (a >= 1e5) return `₹${one.format(v / 1e5)} L`;
  return `₹${int.format(v)}`;
}

/** A metric value as people read it; null means there was nothing to measure. */
export function formatValue(fmt: Fmt, v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  switch (fmt) {
    case "pct": return `${Math.round(v)}%`;
    case "avg": return one.format(v);
    case "score": return int.format(v);
    case "inr": return inr(v);
    case "min": return v >= 90 ? `${one.format(v / 60)} h` : `${int.format(v)} min`;
    case "hrs": return v >= 48 ? `${one.format(v / 24)} d` : `${one.format(v)} h`;
    case "days": return `${one.format(v)} d`;
    case "dur": {
      if (v >= 3600) return `${one.format(v / 3600)} h`;
      if (v >= 60) return `${int.format(v / 60)} min`;
      return `${int.format(v)} s`;
    }
    default: return int.format(v);
  }
}

/** Short axis ticks: 1.2k, 4.5L. */
export function formatTick(fmt: Fmt, v: number) {
  if (fmt === "pct") return `${Math.round(v)}%`;
  if (fmt === "inr") return inr(v).replace(" ", "");
  if (fmt !== "n" && fmt !== "score") return formatValue(fmt, v);
  if (Math.abs(v) >= 1e5) return `${one.format(v / 1e5)}L`;
  if (Math.abs(v) >= 1e3) return `${one.format(v / 1e3)}k`;
  return int.format(v);
}

export type Delta = { text: string; direction: "up" | "down" | "flat"; verdict: "good" | "bad" | "neutral" };

/**
 * Change against the previous period. Percentages move in points, everything
 * else in relative percent; a start from zero reads "new" instead of +∞%.
 */
export function delta(value: number | null, prev: number | null, fmt: Fmt, better: Better): Delta | null {
  if (value === null || prev === null) return null;
  const diff = value - prev;
  const direction = Math.abs(diff) < 1e-9 ? "flat" : diff > 0 ? "up" : "down";
  const verdict = direction === "flat" || better === "none" ? "neutral" : (direction === "up") === (better === "up") ? "good" : "bad";
  if (fmt === "pct") return { text: `${diff > 0 ? "+" : ""}${Math.round(diff)} pts`, direction, verdict };
  if (prev === 0) return value === 0 ? { text: "0%", direction, verdict } : { text: "new", direction, verdict };
  const rel = (diff / Math.abs(prev)) * 100;
  return { text: `${rel > 0 ? "+" : ""}${Math.abs(rel) >= 10 ? Math.round(rel) : one.format(rel)}%`, direction, verdict };
}

export const metricDelta = (m: MetricOut) => (m.snapshot ? null : delta(m.value, m.prev, m.fmt, m.better));

const dayFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
const longFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

const asDate = (d: string) => new Date(`${d.slice(0, 10)}T00:00:00Z`);
export const shortDate = (d: string) => dayFmt.format(asDate(d));
export const longDate = (d: string) => longFmt.format(asDate(d));

/** "9a" / "3p" for an hour bucket, "8 Oct" for a day, "w/c 8 Oct" for a week. */
export function bucketLabel(t: string, bucket: "hour" | "day" | "week", long = false) {
  if (bucket === "hour") {
    const h = Number(t);
    const label = `${h % 12 === 0 ? 12 : h % 12}${h >= 12 ? "p" : "a"}`;
    return long ? `${label.replace("a", " AM").replace("p", " PM")}` : label;
  }
  if (bucket === "week") return long ? `Week of ${shortDate(t)}` : shortDate(t);
  return long ? longDate(t) : shortDate(t);
}

/** "synced 2 min ago" from the analytics mirror timestamp. */
export function syncedAgo(at: string | null, now = Date.now()) {
  if (!at) return null;
  const s = Math.max(0, Math.round((now - Date.parse(at)) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  return `${Math.round(s / 3600)} h ago`;
}
