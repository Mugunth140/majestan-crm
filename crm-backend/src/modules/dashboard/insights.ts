import { compute, deptLabel, median, type Counters, type DeptKey, type MetricDef } from './metrics';
import type { Insight, Person, TargetRow } from './types';

/** A change is worth a card only when it is large and the sample is big enough. */
const MIN_CHANGE = 0.2;
const MIN_SAMPLE = 8;

const fmtValue = (def: MetricDef, v: number) => {
  switch (def.fmt) {
    case 'pct': return `${Math.round(v)}%`;
    case 'min': return v >= 90 ? `${(v / 60).toFixed(1)} h` : `${Math.round(v)} min`;
    case 'hrs': return v >= 48 ? `${(v / 24).toFixed(1)} days` : `${v.toFixed(1)} h`;
    case 'days': return `${v.toFixed(1)} days`;
    case 'dur': return v >= 3600 ? `${(v / 3600).toFixed(1)} h` : `${Math.round(v / 60)} min`;
    case 'avg': return v.toFixed(1);
    default: return Math.round(v).toLocaleString('en-IN');
  }
};

/** How much work a period holds; ratios on a near-empty period are noise. */
const activitySize = (c: Counters) =>
  ['calls', 'touches', 'src_added', 'ver_done', 'hr_apps', 'assigned_n', 'fu_due'].reduce((s, k) => s + (c[k] ?? 0), 0);

const dropWeight = (i: Insight & { weight: number }): Insight => {
  const { tone, title, detail, href, personId, metric } = i;
  return { tone, title, detail, href, personId, metric };
};

/** Period-over-period movement on a department's key metrics. */
export function changeInsights(dept: DeptKey, defs: MetricDef[], cur: Counters, prev: Counters, workingDays: number, prevWorkingDays: number, scope: string): Insight[] {
  const out: (Insight & { weight: number })[] = [];
  for (const def of defs) {
    if (def.snapshot || def.better === 'none') continue;
    const a = compute(def, cur, workingDays);
    const b = compute(def, prev, prevWorkingDays);
    if (a === null || b === null || b === 0) continue;
    if (def.fmt === 'n' && Math.max(a, b) < MIN_SAMPLE) continue;
    if (def.fmt !== 'n' && activitySize(cur) < MIN_SAMPLE * 3) continue;
    const change = (a - b) / Math.abs(b);
    if (Math.abs(change) < MIN_CHANGE) continue;
    const improved = def.better === 'up' ? change > 0 : change < 0;
    const pctText = `${change > 0 ? '+' : ''}${Math.round(change * 100)}%`;
    out.push({
      tone: improved ? 'good' : 'bad',
      title: `${def.label} ${improved ? 'improved' : 'slipped'} ${pctText}`,
      detail: `${scope} · ${deptLabel(dept)}: ${fmtValue(def, a)} against ${fmtValue(def, b)} in the previous period.`,
      metric: def.key,
      weight: Math.abs(change),
    });
  }
  return out.sort((x, y) => y.weight - x.weight).map(dropWeight);
}

/** People well ahead of or behind their department median on a metric. */
export function outlierInsights(people: Person[], values: Map<number, Map<string, number | null>>, defs: MetricDef[]): Insight[] {
  const out: (Insight & { weight: number })[] = [];
  for (const def of defs) {
    if (def.better === 'none') continue;
    const series = people.map(p => ({ p, v: values.get(p.id)?.get(def.key) ?? null })).filter(x => x.v !== null) as { p: Person; v: number }[];
    if (series.length < 3) continue;
    const m = median(series.map(x => x.v));
    if (!m) continue;
    for (const { p, v } of series) {
      const ratio = v / m;
      const behind = def.better === 'up' ? ratio <= 0.5 : ratio >= 2;
      const ahead = def.better === 'up' ? ratio >= 1.8 : ratio <= 0.5;
      if (!behind && !ahead) continue;
      out.push({
        tone: ahead ? 'good' : 'bad',
        title: `${p.name}: ${def.label.toLowerCase()} ${ahead ? 'well ahead of' : 'well behind'} the team`,
        detail: `${fmtValue(def, v)} against a team median of ${fmtValue(def, m)}.`,
        personId: p.id,
        metric: def.key,
        weight: Math.abs(Math.log(ratio || 0.01)),
      });
    }
  }
  return out.sort((a, b) => b.weight - a.weight).slice(0, 8).map(dropWeight);
}

/** Monthly targets whose forecast at the current pace falls short. */
export function targetInsights(rows: TargetRow[], monthProgress: number): Insight[] {
  if (monthProgress < 0.2) return [];
  return rows
    .filter(r => r.monthly > 0 && r.forecast / r.monthly < 0.8)
    .sort((a, b) => a.forecast / a.monthly - b.forecast / b.monthly)
    .slice(0, 5)
    .map(r => ({
      tone: 'warn' as const,
      title: `${r.name} is on course for ${Math.round((r.forecast / r.monthly) * 100)}% of ${r.label.toLowerCase()}`,
      detail: `${Math.round(r.achieved)} of ${Math.round(r.monthly)} done; ${Math.round(r.expected)} were expected by today.`,
      personId: r.personId,
    }));
}

/** Leads per person far above the team median. */
export function workloadInsights(people: Person[], open: Map<number, number>): Insight[] {
  const loads = people.map(p => ({ p, n: open.get(p.id) ?? 0 })).filter(x => x.n > 0);
  if (loads.length < 3) return [];
  const m = median(loads.map(x => x.n)) ?? 0;
  if (m < 5) return [];
  return loads
    .filter(x => x.n >= m * 1.8)
    .sort((a, b) => b.n - a.n)
    .slice(0, 3)
    .map(({ p, n }) => ({
      tone: 'warn' as const,
      title: `${p.name} holds ${n} open leads`,
      detail: `${(n / m).toFixed(1)}× the team median of ${Math.round(m)}. Consider rebalancing new assignments.`,
      personId: p.id,
    }));
}
