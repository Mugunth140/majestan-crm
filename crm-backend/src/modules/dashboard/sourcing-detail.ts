import type { Block, MetricOut } from './types';

/** Where a sourced inbound stands, by its availability. */
export const SOURCING_STAGES = [
  { key: 'unchecked', label: 'Awaiting validation' }, { key: 'validated', label: 'Validated' },
  { key: 'verifying', label: 'In verification' }, { key: 'verified', label: 'Verified' }, { key: 'not_available', label: 'Not available' },
];

export type DetailRow = { dim: string; label: string } & Record<string, number | string>;
type Facts = Record<string, number | string | null>;

const num = (v: unknown) => Number(v ?? 0) || 0;
const words = (v: string) => { const s = v.replace(/_/g, ' ').trim().toLowerCase(); return s.charAt(0).toUpperCase() + s.slice(1); };
const CATEGORY: Record<string, string> = { residential: 'Residential', commercial: 'Commercial', unknown: 'Category not set' };
const PURPOSE: Record<string, string> = { rent: 'Rent', sale: 'Sale', unknown: 'Rent or sale not set' };
const TYPE: Record<string, string> = { individual_portion: 'Individual / Portion house', unknown: 'Type not set' };

const stageValues = (r: DetailRow) => Object.fromEntries(SOURCING_STAGES.map(s => [s.key, num(r[s.key])]));

/**
 * Residential and commercial, rent or sale, property types, work status and source for the
 * inbounds sourced in the period, with headline facts. Shared by the Overview and the Sourcing tab.
 */
export function sourcingDetailBlocks(prefix: string, rows: DetailRow[], facts: Facts[]): Block[] {
  const dim = (d: string) => rows.filter(r => r.dim === d);
  const at = (p: 'cur' | 'prev') => facts.find(f => f.p === p) ?? {};
  const [cur, prev] = [at('cur'), at('prev')];
  const avg = (k: string) => (x: Facts) => (x[k] == null ? null : Math.round(num(x[k])));
  const share = (k: string, of = 'n') => (x: Facts) => (num(x[of]) ? Math.round((num(x[k]) / num(x[of])) * 100) : null);
  const tile = (key: string, label: string, fmt: MetricOut['fmt'], value: (x: Facts) => number | null, better: MetricOut['better'] = 'up', hint?: string): MetricOut =>
    ({ key, label, fmt, better, value: value(cur), prev: value(prev), hint });

  const typeRows = (cat: string) => dim('type').filter(r => r.label.startsWith(`${cat}|`))
    .map(r => { const t = r.label.slice(cat.length + 1); return { label: TYPE[t] ?? words(t), values: stageValues(r) }; });

  return [
    { kind: 'kpis', id: `${prefix}-detail-kpis`, title: 'Sourcing detail', span: 'full', metrics: [
      tile('src_res', 'Residential sourced', 'n', x => num(x.res)),
      tile('src_com', 'Commercial sourced', 'n', x => num(x.com)),
      tile('src_rent_res', 'Avg residential rent asked', 'inr', avg('rent_res'), 'none', 'Monthly rent owners asked for, on homes'),
      tile('src_rent_com', 'Avg commercial rent asked', 'inr', avg('rent_com'), 'none', 'Monthly rent owners asked for, on business space'),
      tile('src_sale_avg', 'Avg sale price asked', 'inr', avg('sale_avg'), 'none'),
      tile('src_photo', 'With photos', 'pct', share('photo')),
      tile('src_located', 'With map location', 'pct', share('located')),
      tile('src_brokerage', 'Brokerage accepted', 'pct', share('brokerage_yes', 'brokerage_asked'), 'up', 'Of the owners asked about brokerage'),
    ] },
    { kind: 'stacked', id: `${prefix}-segments`, title: 'Residential and commercial', subtitle: 'Rent or sale, and where each listing stands', fmt: 'n', span: 'full',
      keys: SOURCING_STAGES,
      rows: dim('segment').map(r => {
        const [cat, pur] = r.label.split('|');
        return { label: `${CATEGORY[cat] ?? words(cat)} · ${PURPOSE[pur] ?? words(pur)}`, values: stageValues(r) };
      }) },
    { kind: 'stacked', id: `${prefix}-res-types`, title: 'Residential by property type', subtitle: 'Homes sourced and where each one stands', fmt: 'n', span: 'half',
      keys: SOURCING_STAGES, rows: typeRows('residential') },
    { kind: 'stacked', id: `${prefix}-com-types`, title: 'Commercial by property type', subtitle: 'Business space sourced and where each one stands', fmt: 'n', span: 'half',
      keys: SOURCING_STAGES, rows: typeRows('commercial') },
    { kind: 'bars', id: `${prefix}-work-status`, title: 'By work status', subtitle: 'Listings sourced in the period, by their status now', fmt: 'n', span: 'half', showAll: true,
      bars: dim('status').map(r => ({ label: r.label, value: num(r.sourced), tone: r.label === 'Rejected' || r.label === 'Terms not Accepted' ? 'bad' as const : undefined })) },
    { kind: 'stacked', id: `${prefix}-sources`, title: 'By source', subtitle: 'Where the listing came from, and where it stands', fmt: 'n', span: 'half',
      keys: SOURCING_STAGES, rows: dim('source').map(r => ({ label: r.label, values: stageValues(r) })) },
  ];
}
