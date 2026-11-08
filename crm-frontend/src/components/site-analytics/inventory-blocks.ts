import type { Bar, Block, Fmt, MetricOut, Span } from "@/components/dashboard/types";
import type { InventoryChart, InventoryMatch, InventoryReport, InventorySection } from "./inventory-data";

/**
 * Turns a Property Insights report into the same blocks the dashboard renders,
 * so both pages share one look. Charts that only restate the attention queue,
 * describe bookkeeping, or have nothing in them are left out.
 */

export const INSIGHT_SECTIONS: { value: InventorySection; label: string }[] = [
  { value: "overview", label: "Overview" },
  { value: "properties", label: "Properties" },
  { value: "projects", label: "Projects" },
  { value: "pricing", label: "Pricing" },
  { value: "demand", label: "Demand" },
];

/** Not useful at a glance: restates the queue, records storage details, or plots one dot per listing. */
const SKIP = new Set(["attention", "stock_history", "uploaders", "indexing", "spread", "pricing_issues", "capacity", "wishlist_activity"]);

/** Every drillable mark gets a number; the page maps it back to the records it stands for. */
export type DrillTarget = { match: InventoryMatch; label: string };

const ACRONYMS = /\b(bhk|seo|gst|pan|rera|it)\b/gi;
export function nice(raw: string | null | undefined): string {
  const s = String(raw ?? "").replace(/_/g, " ").trim();
  if (!s) return "Unknown";
  const lower = s === s.toUpperCase() || s === s.toLowerCase() ? s.toLowerCase() : s;
  return (lower.charAt(0).toUpperCase() + lower.slice(1)).replace(ACRONYMS, (m) => m.toUpperCase());
}

const fmtOf = (unit?: string): Fmt => (unit === "INR" ? "inr" : unit === "%" ? "pct" : unit === "seconds" ? "dur" : "n");
const isDay = (label: string) => /^\d{4}-\d{2}-\d{2}$/.test(label);
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_");
const uniq = <T,>(xs: T[]) => [...new Set(xs)];
const total = (v: Record<string, number>) => Object.values(v).reduce((a, b) => a + b, 0);

export function toBlocks(report: InventoryReport, section: InventorySection, uploaderNames: Record<string, string> = {}) {
  const drills: DrillTarget[] = [];
  const drill = (match: InventoryMatch | undefined, label: string) => {
    if (!match) return undefined;
    drills.push({ match, label });
    return drills.length;
  };

  const metrics: MetricOut[] = report.metrics.map((m) => ({
    key: m.key, label: m.label, fmt: fmtOf(m.unit), better: "none", value: m.value, prev: null, snapshot: true,
  }));
  const blocks: Block[] = [];
  if (metrics.length) blocks.push({ kind: "kpis", id: `${section}-kpis`, title: "Key numbers", span: "full", metrics });

  const charts: Block[] = [];
  for (const c of report.charts) {
    if (SKIP.has(c.key) || !c.rows.length) continue;
    const block = chartBlock(c, drill, uploaderNames);
    if (block && !empty(block)) charts.push(block);
  }
  blocks.push(...arrange(charts));
  return { blocks, drills };
}

function chartBlock(c: InventoryChart, drill: (m: InventoryMatch | undefined, l: string) => number | undefined, names: Record<string, string>): Block | null {
  const fmt = fmtOf(c.unit);
  const base = { id: c.key, title: c.title, subtitle: c.note };
  const label = (r: InventoryChart["rows"][number]) => (r.match?.uploader && names[r.match.uploader]) || nice(r.label);

  if (c.type === "line" || c.type === "area" || (c.type === "stack" && c.rows.every((r) => isDay(r.label)))) {
    const keys = uniq(c.rows.map((r) => r.series ?? c.title));
    const days = uniq(c.rows.map((r) => r.label)).sort();
    return {
      ...base, kind: "trend", fmt, bucket: "day", span: "full",
      series: keys.map((k) => ({ key: slug(k), label: nice(k) })),
      points: days.map((t) => ({ t, v: Object.fromEntries(keys.map((k) => [slug(k), c.rows.filter((r) => r.label === t && (r.series ?? c.title) === k).reduce((s, r) => s + (r.value ?? 0), 0)])) })),
    };
  }
  if (c.type === "stack") {
    const keys = uniq(c.rows.map((r) => r.series ?? "Value"));
    const labels = uniq(c.rows.map((r) => r.label));
    return {
      ...base, kind: "stacked", fmt, span: "half",
      keys: keys.map((k) => ({ key: slug(k), label: nice(k) })),
      rows: labels.map((l) => {
        const rows = c.rows.filter((r) => r.label === l);
        return { label: nice(l), personId: drill(commonMatch(rows.map((r) => r.match)), `${c.title} · ${nice(l)}`), values: Object.fromEntries(rows.map((r) => [slug(r.series ?? "Value"), r.value ?? 0])) };
      }).sort((a, b) => total(b.values) - total(a.values)),
    };
  }
  // A grid only earns its place with many columns; a handful of combinations reads better as a ranked list.
  if (c.type === "heatmap" && uniq(c.rows.map((r) => r.series ?? "")).length <= 4) {
    const bars = c.rows.filter((r) => r.value).map((r) => {
      const l = `${nice(r.label)} · ${nice(r.series)}`;
      return { label: l, value: r.value ?? 0, personId: drill(r.match, `${c.title} · ${l}`) };
    });
    return { ...base, kind: "bars", fmt, span: "half", bars: bars.sort((a, b) => b.value - a.value) };
  }
  if (c.type === "heatmap") {
    const rows = uniq(c.rows.map((r) => r.label));
    const cols = uniq(c.rows.map((r) => r.series ?? ""));
    return {
      ...base, kind: "heatmap", fmt, span: "full",
      rows: rows.map((l) => ({ label: nice(l) })),
      cols: cols.map(nice),
      cells: rows.map((l) => cols.map((s) => c.rows.find((r) => r.label === l && (r.series ?? "") === s)?.value ?? 0)),
    };
  }
  if (c.type === "scatter") {
    return { ...base, kind: "scatter", span: "full", x: { label: "Views", fmt: "n" }, y: { label: "Active time", fmt: "dur" },
      points: c.rows.map((r) => ({ label: r.label, x: r.x ?? 0, y: r.y ?? 0 })) };
  }
  if (c.type === "range") {
    return { ...base, kind: "bars", fmt: "inr", span: "half", valueLabel: "Up to", secondaryLabel: undefined,
      bars: c.rows.map((r) => ({ label: nice(r.label), value: r.high ?? r.value ?? 0, personId: drill(r.match, `${c.title} · ${r.label}`) })) };
  }
  if (c.type === "box") return null;
  // bar and histogram. Short categorical lists read better as a ring.
  // Labels that differ only in case ("BARESHELL", "Bareshell") are one row.
  const merged = new Map<string, Bar>();
  for (const r of c.rows) {
    const l = label(r);
    const k = l.toLowerCase();
    const hit = merged.get(k);
    if (hit) hit.value += r.value ?? 0;
    else merged.set(k, { label: l, value: r.value ?? 0, personId: drill(r.match, `${c.title} · ${l}`) });
  }
  const bars = [...merged.values()];
  if (c.type === "bar" && bars.length >= 2 && bars.length <= 5 && fmt === "n") {
    return { ...base, kind: "donut", span: "third", centerLabel: "Listings", slices: bars.map((b) => ({ label: b.label, value: b.value })) };
  }
  return { ...base, kind: "bars", fmt, span: "half", bars: c.type === "histogram" ? bars : [...bars].sort((a, b) => b.value - a.value) };
}

/** The fields every mark in a stacked row shares: drilling a row opens all of its segments. */
function commonMatch(matches: (InventoryMatch | undefined)[]): InventoryMatch | undefined {
  const [first = {}, ...rest] = matches.map((m) => m ?? {});
  const shared = Object.fromEntries(Object.entries(first).filter(([k, v]) => rest.every((m) => m[k] === v)));
  return Object.keys(shared).length ? shared : undefined;
}

function empty(b: Block) {
  switch (b.kind) {
    case "bars": return b.bars.every((x) => !x.value);
    case "donut": return b.slices.every((x) => !x.value);
    case "stacked": return b.rows.every((r) => Object.values(r.values).every((v) => !v));
    case "trend": return b.points.every((p) => Object.values(p.v).every((v) => !v));
    case "heatmap": return b.cells.every((r) => r.every((v) => !v));
    case "scatter": return !b.points.length;
    default: return false;
  }
}

/** Wide charts first, then halves in pairs, then rings in threes, so no row is left with a hole. */
function arrange(blocks: Block[]): Block[] {
  const by = (s: Span) => blocks.filter((b) => (b.span ?? "full") === s);
  const halves = by("half");
  const thirds = by("third");
  let rest = thirds.length % 3;
  const out = [...by("full")];
  // A spare half and a spare ring share a row as two thirds and one third.
  if (halves.length % 2 && rest === 1) {
    out.push(...halves.slice(0, -1), { ...halves[halves.length - 1], span: "twoThirds" }, thirds[thirds.length - 1]);
    thirds.pop();
    rest = 0;
  } else {
    if (halves.length % 2) halves[halves.length - 1] = { ...halves[halves.length - 1], span: "full" };
    out.push(...halves);
  }
  const tail = thirds.slice(thirds.length - rest).map((b) => ({ ...b, span: (rest === 1 ? "full" : "half") as Span }));
  return [...out, ...thirds.slice(0, thirds.length - rest), ...tail];
}
