import { addDays, inBothPeriods, istDate, periodOf, utcStart, type Range } from './range';
import { supplyDemand, type Ctx } from './sql';
import { compute, DEPT_METRICS, type Counters, type MetricDef } from './metrics';
import type { Bar, Block, Insight, MetricOut, Person, Section } from './types';

/**
 * Business-wide Human Resource and Sourcing tabs. Unlike the department views,
 * these count every candidate and every listing, whoever handled it, so the
 * tabs are useful even when nobody on the roster sits in HR or Sourcing.
 */

type Query = <T>(sql: string) => Promise<T[]>;
type Row = Record<string, number | string | null>;

const DEFS = new Map<string, MetricDef>(Object.values(DEPT_METRICS).flat().map(d => [d.key, d]));
const HR_STAGES = ['New Application', 'Contacted', 'Resume Shortlisted', 'Interview Scheduled', 'Interview Completed', 'Selected', 'Offer Sent', 'Joined'];
const HR_CLOSED = `('Joined', 'Rejected')`;
const n = (v: unknown) => Number(v ?? 0) || 0;
const end = (r: Range) => utcStart(addDays(r.to, 1));
const within = (col: string, r: Range) => `${col} >= ${utcStart(r.from)} AND ${col} < ${end(r)}`;
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : null);
const nice = (s: unknown) => {
  const t = String(s ?? '').replace(/_/g, ' ').trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1).toLowerCase() : 'Unknown';
};

function bucketOf(col: string, range: Range) {
  if (range.bucket === 'hour') return `CAST(hour(${col} + INTERVAL 330 MINUTE) AS VARCHAR)`;
  if (range.bucket === 'week') return `CAST(date_trunc('week', ${istDate(col)}) AS VARCHAR)`;
  return `CAST(${istDate(col)} AS VARCHAR)`;
}

export function buckets(range: Range) {
  if (range.bucket === 'hour') return Array.from({ length: 13 }, (_, i) => String(i + 8));
  const out: string[] = [];
  if (range.bucket === 'week') {
    const start = new Date(range.from);
    start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
    for (let d = start.toISOString().slice(0, 10); d <= range.to; d = addDays(d, 7)) out.push(d);
    return out;
  }
  for (let d = range.from; d <= range.to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** A metric tile from the shared definitions, so labels, formats and direction match every other tab. */
function tile(key: string, cur: Counters, prev: Counters, range: Range, over: Partial<MetricOut> = {}): MetricOut {
  const def = DEFS.get(key)!;
  return {
    key, label: def.label, fmt: def.fmt, better: def.better, hint: def.hint, alert: def.alert, snapshot: def.snapshot,
    value: compute(def, cur, range.workingDays),
    prev: def.snapshot ? null : compute(def, prev, range.prevWorkingDays),
    ...over,
  };
}

const snap = (key: string, label: string, value: number | null, better: MetricOut['better'], fmt: MetricOut['fmt'] = 'n', extra: Partial<MetricOut> = {}): MetricOut =>
  ({ key, label, fmt, better, value, prev: null, snapshot: true, ...extra });

function trend(id: string, title: string, range: Range, rows: { t: string; k: string; n: number }[], series: { key: string; label: string }[], span: Block['span'] = 'twoThirds'): Block {
  const points = buckets(range).map(t => {
    const v: Record<string, number> = {};
    for (const s of series) v[s.key] = rows.filter(r => r.t === t && r.k === s.key).reduce((a, r) => a + n(r.n), 0);
    return { t, v };
  });
  return { kind: 'trend', id, title, fmt: 'n', span, series, points, bucket: range.bucket };
}

function periods(rows: Row[]) {
  const pick = (p: string) => Object.fromEntries(Object.entries(rows.find(r => r.p === p) ?? {}).filter(([k]) => k !== 'p').map(([k, v]) => [k, n(v)])) as Counters;
  return { cur: pick('cur'), prev: pick('prev') };
}

const named = (people: Person[]) => new Map(people.map(p => [p.id, p.name]));

// ── Human Resource ────────────────────────────────────────────────────────

export const hrSql = {
  totals: (range: Range) => {
    const stage = (name: string, value: string) => `COUNT(DISTINCT entity_id) FILTER (WHERE to_value = '${value}') AS ${name}`;
    return `
    WITH apps AS (
      SELECT ${periodOf('"createdAt"', range)} AS p, COUNT(*) AS hr_apps FROM hr_candidates WHERE ${inBothPeriods('"createdAt"', range)} GROUP BY ALL
    ), moves AS (
      SELECT ${periodOf('e.created_at', range)} AS p,
        ${stage('hr_shortlisted', 'Resume Shortlisted')}, ${stage('hr_int_sched', 'Interview Scheduled')},
        ${stage('hr_int_done', 'Interview Completed')}, ${stage('hr_selected', 'Selected')},
        ${stage('hr_offers', 'Offer Sent')}, ${stage('hr_joined', 'Joined')}, ${stage('hr_rejected', 'Rejected')},
        COALESCE(SUM(date_diff('hour', c."createdAt", e.created_at)) FILTER (WHERE e.to_value = 'Joined'), 0) / 24.0 AS hr_hire_days_sum
      FROM record_events e LEFT JOIN hr_candidates c ON c.id = e.entity_id
      WHERE e.entity = 'hr' AND e.type = 'status_changed' AND ${inBothPeriods('e.created_at', range)} GROUP BY ALL
    ), calls AS (
      SELECT ${periodOf('created_at', range)} AS p, COUNT(*) FILTER (WHERE contact_type = 'call') AS hr_calls, COUNT(*) AS hr_contacts
      FROM all_contacts WHERE entity = 'hr' AND ${inBothPeriods('created_at', range)} GROUP BY ALL
    )
    SELECT p.p, COALESCE(a.hr_apps, 0) AS hr_apps, m.* EXCLUDE (p), COALESCE(c.hr_calls, 0) AS hr_calls, COALESCE(c.hr_contacts, 0) AS hr_contacts
    FROM (SELECT 'cur' AS p UNION ALL SELECT 'prev') p
      LEFT JOIN apps a ON a.p = p.p LEFT JOIN moves m ON m.p = p.p LEFT JOIN calls c ON c.p = p.p`;
  },
  snapshot: (range: Range, now: string) => `
    SELECT
      COUNT(*) FILTER (WHERE status NOT IN ${HR_CLOSED}) AS open,
      COUNT(*) FILTER (WHERE status NOT IN ${HR_CLOSED} AND "updatedAt" < ${now} - INTERVAL 7 DAY) AS stuck,
      COUNT(*) FILTER (WHERE status = 'Hold') AS hold,
      COUNT(*) FILTER (WHERE status = 'Offer Sent') AS offers_out,
      COUNT(*) FILTER (WHERE status NOT IN ${HR_CLOSED} AND "assignedStaffId" IS NULL) AS unassigned,
      COUNT(*) FILTER (WHERE "interviewDate" >= DATE '${range.today}' AND "interviewDate" <= DATE '${addDays(range.today, 7)}' AND status NOT IN ${HR_CLOSED}) AS upcoming,
      COUNT(*) FILTER (WHERE status NOT IN ${HR_CLOSED} AND NULLIF(TRIM("resumeUrl"), '') IS NULL) AS no_resume
    FROM hr_candidates`,
  status: () => `SELECT COALESCE(status, 'New Application') AS label, COUNT(*) AS value FROM hr_candidates GROUP BY ALL`,
  /** Applications in the period by a dimension, and how many of them have joined since. */
  by: (dim: 'department' | 'position' | 'source' | 'city', range: Range) => {
    const col = dim === 'source'
      ? `COALESCE(NULLIF(TRIM(s.name), ''), NULLIF(TRIM(c."recruitmentSource"), ''), 'Unknown')`
      : `COALESCE(NULLIF(TRIM(c."${dim}"), ''), 'Unknown')`;
    return `SELECT ${col} AS label, COUNT(*) AS value, COUNT(*) FILTER (WHERE c.status = 'Joined') AS joined,
        COUNT(*) FILTER (WHERE c.status IN ('Interview Scheduled', 'Interview Completed', 'Selected', 'Offer Sent', 'Joined')) AS interviewed
      FROM hr_candidates c LEFT JOIN hr_sources s ON s.id = c."hrSourceId"
      WHERE ${within('c."createdAt"', range)} GROUP BY ALL ORDER BY value DESC LIMIT 10`;
  },
  modes: (range: Range) => `SELECT COALESCE(CAST("interviewMode" AS VARCHAR), 'not set') AS label, COUNT(*) AS value FROM hr_candidates
      WHERE "interviewDate" >= DATE '${range.from}' AND "interviewDate" <= DATE '${range.to}' GROUP BY ALL`,
  ageing: (now: string) => `SELECT
      COUNT(*) FILTER (WHERE "updatedAt" >= ${now} - INTERVAL 3 DAY) AS a0,
      COUNT(*) FILTER (WHERE "updatedAt" < ${now} - INTERVAL 3 DAY AND "updatedAt" >= ${now} - INTERVAL 7 DAY) AS a1,
      COUNT(*) FILTER (WHERE "updatedAt" < ${now} - INTERVAL 7 DAY AND "updatedAt" >= ${now} - INTERVAL 14 DAY) AS a2,
      COUNT(*) FILTER (WHERE "updatedAt" < ${now} - INTERVAL 14 DAY AND "updatedAt" >= ${now} - INTERVAL 30 DAY) AS a3,
      COUNT(*) FILTER (WHERE "updatedAt" < ${now} - INTERVAL 30 DAY) AS a4
    FROM hr_candidates WHERE status NOT IN ${HR_CLOSED}`,
  recruiters: () => `SELECT "assignedStaffId" AS uid, COUNT(*) FILTER (WHERE status NOT IN ${HR_CLOSED}) AS open,
      COUNT(*) FILTER (WHERE status = 'Joined') AS joined FROM hr_candidates WHERE "assignedStaffId" IS NOT NULL GROUP BY ALL ORDER BY open DESC LIMIT 12`,
  series: (range: Range) => `
    SELECT ${bucketOf('"createdAt"', range)} AS t, 'apps' AS k, COUNT(*) AS n FROM hr_candidates WHERE ${within('"createdAt"', range)} GROUP BY ALL
    UNION ALL
    SELECT ${bucketOf('created_at', range)}, CASE to_value WHEN 'Interview Scheduled' THEN 'interviews' WHEN 'Offer Sent' THEN 'offers' ELSE 'joined' END, COUNT(DISTINCT entity_id)
      FROM record_events WHERE entity = 'hr' AND type = 'status_changed' AND to_value IN ('Interview Scheduled', 'Offer Sent', 'Joined') AND ${within('created_at', range)} GROUP BY ALL`,
};

export async function hrTab(query: Query, ctx: Ctx, people: Person[]): Promise<Section[]> {
  const { range, now } = ctx;
  const [totals, [s = {}], status, depts, positions, sources, modes, [age = {}], recruiters, series] = await Promise.all([
    query<Row>(hrSql.totals(range)), query<Row>(hrSql.snapshot(range, now)), query<Row>(hrSql.status()),
    query<Row>(hrSql.by('department', range)), query<Row>(hrSql.by('position', range)), query<Row>(hrSql.by('source', range)),
    query<Row>(hrSql.modes(range)), query<Row>(hrSql.ageing(now)), query<Row>(hrSql.recruiters()),
    query<{ t: string; k: string; n: number }>(hrSql.series(range)),
  ]);
  const { cur, prev } = periods(totals);
  const names = named(people);
  const statusCount = (label: string) => n(status.find(r => r.label === label)?.value);

  const insights: Insight[] = [];
  if (n(s.stuck)) insights.push({ tone: 'bad', title: `${n(s.stuck)} candidate${n(s.stuck) > 1 ? 's have' : ' has'} not moved in a week`, detail: 'Open candidates with no update for 7 days or more. Call them or close them out.' });
  if (n(s.offers_out)) insights.push({ tone: 'warn', title: `${n(s.offers_out)} offer${n(s.offers_out) > 1 ? 's are' : ' is'} waiting for an answer`, detail: 'Follow up before the candidate takes another offer.' });
  if (n(s.unassigned)) insights.push({ tone: 'warn', title: `${n(s.unassigned)} open candidate${n(s.unassigned) > 1 ? 's have' : ' has'} no recruiter`, detail: 'Assign them in the HR panel so someone owns the next step.' });
  if (n(s.upcoming)) insights.push({ tone: 'good', title: `${n(s.upcoming)} interview${n(s.upcoming) > 1 ? 's' : ''} in the next 7 days`, detail: 'Candidates with an interview date this week.' });
  const bestSource = sources.filter(r => n(r.value) >= 3).sort((a, b) => n(b.joined) / n(b.value) - n(a.joined) / n(a.value))[0];
  if (bestSource && n(bestSource.joined)) insights.push({ tone: 'good', title: `${bestSource.label} brings the most hires`, detail: `${pct(n(bestSource.joined), n(bestSource.value))}% of its applications in the period have joined.` });
  if (cur.hr_apps && prev.hr_apps && cur.hr_apps < prev.hr_apps * 0.7) insights.push({ tone: 'bad', title: 'Applications are down', detail: `${cur.hr_apps} against ${prev.hr_apps} in the previous period.` });
  if (n(s.no_resume)) insights.push({ tone: 'warn', title: `${n(s.no_resume)} open candidate${n(s.no_resume) > 1 ? 's have' : ' has'} no resume`, detail: 'Upload a resume before the interview round.' });

  return [
    {
      id: 'hr-health', title: 'Human Resource', hideHeader: true,
      blocks: [
        { kind: 'kpis', id: 'hr-kpis', title: 'Hiring', span: 'full', metrics: [
          tile('hr_apps', cur, prev, range), tile('hr_int_sched', cur, prev, range), tile('hr_offers', cur, prev, range), tile('hr_joined', cur, prev, range),
          tile('hr_app_to_int', cur, prev, range), tile('hr_accept', cur, prev, range), tile('hr_time_to_hire', cur, prev, range),
          snap('hr_open', 'Open candidates', n(s.open), 'none', 'n', { hint: 'Every candidate not yet joined or rejected' }),
        ] },
        trend('hr-trend', 'Hiring activity', range, series, [
          { key: 'apps', label: 'Applications' }, { key: 'interviews', label: 'Interviews scheduled' }, { key: 'offers', label: 'Offers' }, { key: 'joined', label: 'Joined' },
        ]),
        { kind: 'bars', id: 'hr-pipeline', title: 'Candidate pipeline', subtitle: 'Every candidate by current stage', fmt: 'n', span: 'third',
          bars: [...HR_STAGES, 'Hold', 'Rejected'].map(label => ({ label, value: statusCount(label), tone: label === 'Joined' ? 'good' as const : label === 'Rejected' ? 'bad' as const : undefined })) },
        { kind: 'insights', id: 'hr-insights', title: 'What needs attention', span: 'full', items: insights.slice(0, 6) },
      ],
    },
    {
      id: 'hr-flow', title: 'Pipeline health', description: 'Candidates still open and how long since anyone touched them.',
      blocks: [
        { kind: 'kpis', id: 'hr-open-kpis', title: 'Open candidates', span: 'full', metrics: [
          snap('hr_stuck', 'Not moved in 7+ days', n(s.stuck), 'down', 'n', { alert: true }),
          snap('hr_upcoming', 'Interviews next 7 days', n(s.upcoming), 'none'),
          snap('hr_offers_out', 'Offers awaiting answer', n(s.offers_out), 'down'),
          snap('hr_hold', 'On hold', n(s.hold), 'none'),
          snap('hr_unassigned', 'No recruiter assigned', n(s.unassigned), 'down', 'n', { alert: true }),
          tile('hr_calls', cur, prev, range),
        ] },
        { kind: 'bars', id: 'hr-ageing', title: 'Days since last update', subtitle: 'Open candidates', fmt: 'n', span: 'half', bars: [
          { label: '0–3 days', value: n(age.a0), tone: 'good' }, { label: '4–7 days', value: n(age.a1) },
          { label: '8–14 days', value: n(age.a2), tone: 'warn' }, { label: '15–30 days', value: n(age.a3), tone: 'bad' }, { label: '30+ days', value: n(age.a4), tone: 'bad' },
        ] },
        { kind: 'bars', id: 'hr-conversion', title: 'Stage conversion', subtitle: 'Share moving on in the period', fmt: 'pct', span: 'half', bars: [
          { label: 'Application → shortlist', value: pct(cur.hr_shortlisted ?? 0, cur.hr_apps ?? 0) ?? 0 },
          { label: 'Shortlist → interview', value: pct(cur.hr_int_sched ?? 0, cur.hr_shortlisted ?? 0) ?? 0 },
          { label: 'Interview → offer', value: pct(cur.hr_offers ?? 0, cur.hr_int_done ?? 0) ?? 0 },
          { label: 'Offer → joined', value: pct(cur.hr_joined ?? 0, cur.hr_offers ?? 0) ?? 0 },
        ] },
      ],
    },
    {
      id: 'hr-sources', title: 'Where candidates come from', description: 'Applications received in the period.',
      blocks: [
        { kind: 'bars', id: 'hr-source', title: 'Source effectiveness', subtitle: 'Applications, and how many joined', fmt: 'n', span: 'half', valueLabel: 'Applications', secondaryLabel: 'Joined',
          bars: sources.map(r => ({ label: String(r.label), value: n(r.value), secondary: n(r.joined) })) },
        { kind: 'bars', id: 'hr-dept', title: 'Hiring by department', subtitle: 'Applications, and how many reached interview', fmt: 'n', span: 'half', valueLabel: 'Applications', secondaryLabel: 'Interviewed',
          bars: depts.map(r => ({ label: String(r.label), value: n(r.value), secondary: n(r.interviewed) })) },
        { kind: 'bars', id: 'hr-position', title: 'Top positions', subtitle: 'Applications by role applied for', fmt: 'n', span: 'half', valueLabel: 'Applications', secondaryLabel: 'Joined',
          bars: positions.map(r => ({ label: String(r.label), value: n(r.value), secondary: n(r.joined) })) },
        { kind: 'donut', id: 'hr-modes', title: 'Interview mode', subtitle: 'Interviews dated in the period', span: 'half', centerLabel: 'Interviews',
          slices: modes.map(r => ({ label: nice(String(r.label).replace('in_person', 'in person')), value: n(r.value) })) },
      ],
    },
    {
      id: 'hr-team', title: 'Recruiters', description: 'Open candidates each recruiter owns.',
      blocks: [
        { kind: 'bars', id: 'hr-recruiters', title: 'Recruiter workload', subtitle: 'Open candidates, and how many of theirs have joined', fmt: 'n', span: 'full', valueLabel: 'Open', secondaryLabel: 'Joined',
          bars: recruiters.map((r): Bar => ({ label: names.get(n(r.uid)) ?? `User ${r.uid}`, value: n(r.open), secondary: n(r.joined), personId: n(r.uid) })) },
      ],
    },
  ];
}

// ── Sourcing ──────────────────────────────────────────────────────────────

const FILLED = [
  `NULLIF(TRIM(owner_name), '') IS NOT NULL`, `NULLIF(TRIM(mobile_number), '') IS NOT NULL`,
  `NULLIF(TRIM(property_type), '') IS NOT NULL`, `NULLIF(TRIM(COALESCE(locality, area)), '') IS NOT NULL`,
  `(COALESCE(sale_price, 0) > 0 OR COALESCE(total_rent, 0) > 0)`, `NULLIF(TRIM(image_url), '') IS NOT NULL`,
  `latitude IS NOT NULL`, `COALESCE(documents_collected, false)`,
];

export const sourcingSql = {
  totals: (range: Range) => `
    WITH v AS (
      SELECT entity_id, MIN(created_at) AS t_at FROM record_events
       WHERE entity = 'inbound' AND field = 'inbound_status' AND to_value = 'verification_done' GROUP BY 1
    ), src AS (
      SELECT ${periodOf('i.created_at', range)} AS p, COUNT(*) AS src_added,
        SUM((${FILLED.map(f => `CASE WHEN ${f} THEN 1 ELSE 0 END`).join(' + ')}) / ${FILLED.length}.0) AS src_complete_sum,
        COUNT(*) FILTER (WHERE i.inbound_status IN ('available', 'fixed_verification', 'verification_done')) AS src_validated,
        COUNT(*) FILTER (WHERE i.inbound_status = 'verification_done' OR v.t_at IS NOT NULL) AS src_verified,
        COUNT(*) FILTER (WHERE i.inbound_status = 'not_available') AS src_rejected,
        COUNT(v.t_at) AS src_verify_n, COALESCE(SUM(date_diff('hour', i.created_at, v.t_at)), 0) AS src_verify_hours_sum,
        COUNT(DISTINCT COALESCE(i.locality, i.area)) AS src_localities,
        COUNT(*) FILTER (WHERE COALESCE(i.is_exclusive, false)) AS src_exclusive
      FROM inbounds i LEFT JOIN v ON v.entity_id = i.id WHERE ${inBothPeriods('i.created_at', range)} GROUP BY ALL
    ), dec AS (
      SELECT ${periodOf('created_at', range)} AS p,
        COUNT(DISTINCT entity_id) FILTER (WHERE to_value = 'verification_done') AS ver_done,
        COUNT(DISTINCT entity_id) FILTER (WHERE to_value = 'not_available') AS ver_rejected
      FROM record_events WHERE entity = 'inbound' AND field = 'inbound_status' AND to_value IN ('verification_done', 'not_available')
        AND ${inBothPeriods('created_at', range)} GROUP BY ALL
    ), ag AS (
      SELECT ${periodOf('created_at', range)} AS p, COUNT(*) AS agents_added FROM agents WHERE ${inBothPeriods('created_at', range)} GROUP BY ALL
    ), calls AS (
      SELECT ${periodOf('created_at', range)} AS p,
        COUNT(*) FILTER (WHERE entity = 'inbound' AND contact_type = 'call') AS inbound_calls,
        COUNT(*) FILTER (WHERE entity = 'inbound' AND contact_type = 'call' AND call_duration IS NOT NULL) AS inbound_calls_timed,
        COUNT(*) FILTER (WHERE entity = 'inbound' AND contact_type = 'call' AND call_duration > 0) AS inbound_calls_connected,
        COUNT(*) FILTER (WHERE entity = 'agent') AS agent_contacts
      FROM all_contacts WHERE entity IN ('inbound', 'agent') AND ${inBothPeriods('created_at', range)} GROUP BY ALL
    )
    SELECT p.p, s.* EXCLUDE (p), d.* EXCLUDE (p), COALESCE(a.agents_added, 0) AS agents_added, c.* EXCLUDE (p)
    FROM (SELECT 'cur' AS p UNION ALL SELECT 'prev') p
      LEFT JOIN src s ON s.p = p.p LEFT JOIN dec d ON d.p = p.p LEFT JOIN ag a ON a.p = p.p LEFT JOIN calls c ON c.p = p.p`,
  snapshot: (now: string) => `
    WITH q AS (
      SELECT i.id, i.created_at,
        (SELECT MAX(x.created_at) FROM record_events x WHERE x.entity = 'inbound' AND x.entity_id = i.id
          AND x.field = 'inbound_status' AND x.to_value = 'fixed_verification') AS queued_at
      FROM inbounds i WHERE i.inbound_status = 'fixed_verification'
    )
    SELECT
      (SELECT COUNT(*) FROM inbounds WHERE NULLIF(inbound_status, '') IS NULL AND COALESCE(status, '') <> 'Closed') AS unchecked,
      (SELECT COUNT(*) FROM q) AS ver_pending,
      (SELECT COUNT(*) FROM q WHERE COALESCE(queued_at, created_at) < ${now} - INTERVAL 3 DAY) AS ver_overdue,
      (SELECT COUNT(*) FROM inbounds WHERE inbound_status = 'verification_done') AS verified_stock,
      (SELECT COUNT(*) FROM inbounds WHERE COALESCE(status, '') <> 'Closed' AND assigned_staff_id IS NULL) AS unassigned,
      (SELECT COUNT(*) FROM inbounds WHERE COALESCE(status, '') <> 'Closed' AND updated_at < ${now} - INTERVAL 14 DAY AND COALESCE(inbound_status, '') NOT IN ('verification_done', 'not_available')) AS idle,
      (SELECT COUNT(*) FROM agents WHERE COALESCE(LOWER(status), 'active') NOT IN ('inactive', 'blocked')) AS agents_active`,
  stages: (range: Range) => `SELECT COALESCE(NULLIF(TRIM(property_type), ''), 'Unknown') AS type,
      COUNT(*) AS sourced,
      COUNT(*) FILTER (WHERE NULLIF(inbound_status, '') IS NULL) AS unchecked,
      COUNT(*) FILTER (WHERE inbound_status = 'available') AS validated,
      COUNT(*) FILTER (WHERE inbound_status = 'fixed_verification') AS verifying,
      COUNT(*) FILTER (WHERE inbound_status = 'verification_done') AS verified,
      COUNT(*) FILTER (WHERE inbound_status = 'not_available') AS not_available
    FROM inbounds WHERE ${within('created_at', range)} GROUP BY ALL ORDER BY sourced DESC LIMIT 10`,
  by: (dim: 'area' | 'purpose' | 'category', range: Range) => {
    // Purpose and category are typed by hand, so 'Sale' and 'sale' are one bucket.
    const col = dim === 'area' ? 'COALESCE(locality, area)' : dim === 'purpose' ? 'LOWER(purpose)' : 'LOWER(property_category)';
    return `SELECT COALESCE(NULLIF(TRIM(${col}), ''), 'Unknown') AS label, COUNT(*) AS value,
        COUNT(*) FILTER (WHERE inbound_status = 'verification_done') AS verified
      FROM inbounds WHERE ${within('created_at', range)} GROUP BY ALL ORDER BY value DESC LIMIT 12`;
  },
  people: (range: Range) => `SELECT uploaded_by_id AS uid, COUNT(*) AS value, COUNT(*) FILTER (WHERE inbound_status = 'verification_done') AS verified
      FROM inbounds WHERE uploaded_by_id IS NOT NULL AND ${within('created_at', range)} GROUP BY ALL ORDER BY value DESC LIMIT 12`,
  partners: () => `SELECT COALESCE(NULLIF(TRIM(LOWER(partner_type)), ''), 'Unknown') AS label, COUNT(*) AS value FROM agents GROUP BY ALL ORDER BY value DESC`,
  queueAge: (now: string) => `
    WITH q AS (
      SELECT COALESCE((SELECT MAX(x.created_at) FROM record_events x WHERE x.entity = 'inbound' AND x.entity_id = i.id
        AND x.field = 'inbound_status' AND x.to_value = 'fixed_verification'), i.created_at) AS t_at
      FROM inbounds i WHERE i.inbound_status = 'fixed_verification'
    )
    SELECT COUNT(*) FILTER (WHERE t_at >= ${now} - INTERVAL 1 DAY) AS a0,
      COUNT(*) FILTER (WHERE t_at < ${now} - INTERVAL 1 DAY AND t_at >= ${now} - INTERVAL 3 DAY) AS a1,
      COUNT(*) FILTER (WHERE t_at < ${now} - INTERVAL 3 DAY AND t_at >= ${now} - INTERVAL 7 DAY) AS a2,
      COUNT(*) FILTER (WHERE t_at < ${now} - INTERVAL 7 DAY) AS a3
    FROM q`,
  series: (range: Range) => `
    SELECT ${bucketOf('created_at', range)} AS t, 'sourced' AS k, COUNT(*) AS n FROM inbounds WHERE ${within('created_at', range)} GROUP BY ALL
    UNION ALL
    SELECT ${bucketOf('created_at', range)}, 'verified', COUNT(DISTINCT entity_id) FROM record_events
      WHERE entity = 'inbound' AND field = 'inbound_status' AND to_value = 'verification_done' AND ${within('created_at', range)} GROUP BY ALL
    UNION ALL
    SELECT ${bucketOf('created_at', range)}, 'agents', COUNT(*) FROM agents WHERE ${within('created_at', range)} GROUP BY ALL`,
};

const STAGES = [
  { key: 'unchecked', label: 'Awaiting validation' }, { key: 'validated', label: 'Validated' },
  { key: 'verifying', label: 'In verification' }, { key: 'verified', label: 'Verified' }, { key: 'not_available', label: 'Not available' },
];

export async function sourcingTab(query: Query, ctx: Ctx, people: Person[]): Promise<Section[]> {
  const { range, now } = ctx;
  const [totals, [s = {}], stages, areas, purposes, categories, uploaders, partners, [qa = {}], series, supply] = await Promise.all([
    query<Row>(sourcingSql.totals(range)), query<Row>(sourcingSql.snapshot(now)), query<Row>(sourcingSql.stages(range)),
    query<Row>(sourcingSql.by('area', range)), query<Row>(sourcingSql.by('purpose', range)), query<Row>(sourcingSql.by('category', range)),
    query<Row>(sourcingSql.people(range)), query<Row>(sourcingSql.partners()), query<Row>(sourcingSql.queueAge(now)),
    query<{ t: string; k: string; n: number }>(sourcingSql.series(range)),
    query<{ label: string; demand: number; supply: number }>(supplyDemand(ctx)),
  ]);
  const { cur, prev } = periods(totals);
  const names = named(people);
  const verifiedRate = (c: Counters) => (c.src_added ? pct(c.src_verified ?? 0, c.src_added) : null);

  const insights: Insight[] = [];
  if (n(s.ver_overdue)) insights.push({ tone: 'bad', title: `${n(s.ver_overdue)} listing${n(s.ver_overdue) > 1 ? 's have' : ' has'} waited 3+ days for verification`, detail: 'Clear the Verification Queue before owners go cold.' });
  if (n(s.unchecked)) insights.push({ tone: 'warn', title: `${n(s.unchecked)} listing${n(s.unchecked) > 1 ? 's are' : ' is'} not validated yet`, detail: 'Call the owner to confirm the property is still available.' });
  if (n(s.idle)) insights.push({ tone: 'warn', title: `${n(s.idle)} open listing${n(s.idle) > 1 ? 's' : ''} untouched for 14+ days`, detail: 'Open inbound listings with no update in two weeks.' });
  if (n(s.unassigned)) insights.push({ tone: 'warn', title: `${n(s.unassigned)} open listing${n(s.unassigned) > 1 ? 's have' : ' has'} no owner in the team`, detail: 'Assign them so verification has someone to chase it.' });
  const gap = supply.filter(r => n(r.demand) >= 5 && n(r.supply) < n(r.demand) / 2).sort((a, b) => n(b.demand) - n(a.demand))[0];
  if (gap) insights.push({ tone: 'bad', title: `Short on ${nice(gap.label)} stock`, detail: `${n(gap.demand)} buyer requirements in 90 days against ${n(gap.supply)} listings.` });
  if (cur.src_added && prev.src_added && cur.src_added < prev.src_added * 0.7) insights.push({ tone: 'bad', title: 'Sourcing has slowed', detail: `${cur.src_added} listings against ${prev.src_added} in the previous period.` });
  else if (cur.src_added && prev.src_added && cur.src_added > prev.src_added * 1.3) insights.push({ tone: 'good', title: 'Sourcing is up', detail: `${cur.src_added} listings against ${prev.src_added} in the previous period.` });

  return [
    {
      id: 'src-health', title: 'Sourcing', hideHeader: true,
      blocks: [
        { kind: 'kpis', id: 'src-kpis', title: 'Sourcing', span: 'full', metrics: [
          tile('src_added', cur, prev, range),
          { key: 'src_validated', label: 'Validated with owner', fmt: 'n', better: 'up', value: cur.src_validated ?? 0, prev: prev.src_validated ?? 0, hint: 'Owner confirmed it is available, including those sent on to verification' },
          tile('ver_done', cur, prev, range),
          { key: 'src_verified_rate', label: 'Verified of sourced', fmt: 'pct', better: 'up', value: verifiedRate(cur), prev: verifiedRate(prev) },
          tile('src_complete', cur, prev, range),
          tile('src_to_verify', cur, prev, range),
          snap('ver_pending', 'In verification queue', n(s.ver_pending), 'down'),
          snap('ver_overdue', 'Overdue verification cases', n(s.ver_overdue), 'down', 'n', { alert: true, hint: 'Waiting in the Verification Queue for more than 3 days' }),
        ] },
        trend('src-trend', 'Sourcing activity', range, series, [
          { key: 'sourced', label: 'Listings sourced' }, { key: 'verified', label: 'Verified' }, { key: 'agents', label: 'Agents added' },
        ]),
        { kind: 'funnel', id: 'src-funnel', title: 'Listing journey', subtitle: 'Listings sourced in the period', span: 'third', stages: [
          { label: 'Sourced', value: cur.src_added ?? 0 }, { label: 'Validated', value: cur.src_validated ?? 0 }, { label: 'Verified', value: cur.src_verified ?? 0 },
        ] },
        { kind: 'insights', id: 'src-insights', title: 'What needs attention', span: 'twoThirds', items: insights.slice(0, 6) },
        { kind: 'bars', id: 'src-queue-age', title: 'Verification queue age', subtitle: 'Listings waiting now, by days in the queue', fmt: 'n', span: 'third', bars: [
          { label: 'Under 1 day', value: n(qa.a0), tone: 'good' }, { label: '1–3 days', value: n(qa.a1) },
          { label: '3–7 days', value: n(qa.a2), tone: 'warn' }, { label: '7+ days', value: n(qa.a3), tone: 'bad' },
        ] },
      ],
    },
    {
      id: 'src-stock', title: 'Inventory', description: 'What was sourced in the period, and where it stands.',
      blocks: [
        { kind: 'stacked', id: 'src-types', title: 'By property type', subtitle: 'Listings sourced and their current stage', fmt: 'n', span: 'full', keys: STAGES,
          rows: stages.map(r => ({ label: nice(r.type), values: Object.fromEntries(STAGES.map(st => [st.key, n(r[st.key])])) })) },
        { kind: 'bars', id: 'src-area', title: 'Top localities', subtitle: 'Listings sourced, and how many are verified', fmt: 'n', span: 'half', valueLabel: 'Sourced', secondaryLabel: 'Verified',
          bars: areas.map(r => ({ label: String(r.label), value: n(r.value), secondary: n(r.verified) })) },
        { kind: 'bars', id: 'src-gaps', title: 'Supply against demand', subtitle: 'Buyer requirements (90 days) against available listings, by type', fmt: 'n', span: 'half', valueLabel: 'Requirements', secondaryLabel: 'Listings',
          bars: supply.map(r => ({ label: nice(r.label), value: n(r.demand), secondary: n(r.supply), tone: n(r.supply) < n(r.demand) / 2 ? 'bad' : undefined })) },
        { kind: 'donut', id: 'src-purpose', title: 'Rent or sale', subtitle: 'Listings sourced in the period', span: 'half', centerLabel: 'Listings',
          slices: purposes.map(r => ({ label: nice(r.label), value: n(r.value) })) },
        { kind: 'donut', id: 'src-category', title: 'Category', subtitle: 'Listings sourced in the period', span: 'half', centerLabel: 'Listings',
          slices: categories.map(r => ({ label: nice(r.label), value: n(r.value) })) },
        { kind: 'kpis', id: 'src-stock-kpis', title: 'Stock', span: 'full', metrics: [
          snap('verified_stock', 'Verified listings in stock', n(s.verified_stock), 'up'),
          { key: 'src_localities', label: 'Localities covered', fmt: 'n', better: 'up', value: cur.src_localities ?? 0, prev: prev.src_localities ?? 0 },
          { key: 'src_exclusive', label: 'Exclusive listings', fmt: 'n', better: 'up', value: cur.src_exclusive ?? 0, prev: prev.src_exclusive ?? 0 },
          tile('ver_conn', cur, prev, range),
        ] },
      ],
    },
    {
      id: 'src-network', title: 'Agent network', description: 'Partners who bring in listings and buyers.',
      blocks: [
        { kind: 'kpis', id: 'agent-kpis', title: 'Agents', span: 'full', metrics: [
          { key: 'agents_added', label: 'Agents added', fmt: 'n', better: 'up', value: cur.agents_added ?? 0, prev: prev.agents_added ?? 0 },
          { key: 'agent_contacts', label: 'Agent contacts', fmt: 'n', better: 'up', value: cur.agent_contacts ?? 0, prev: prev.agent_contacts ?? 0 },
          snap('agents_active', 'Active agents', n(s.agents_active), 'up'),
          tile('ver_calls', cur, prev, range),
        ] },
        { kind: 'donut', id: 'agent-types', title: 'Partner types', subtitle: 'Every agent on the network', span: 'third', centerLabel: 'Agents',
          slices: partners.map(r => ({ label: nice(r.label), value: n(r.value) })) },
        { kind: 'bars', id: 'src-people', title: 'Sourced by person', subtitle: 'Listings added in the period, and how many are verified', fmt: 'n', span: 'twoThirds', valueLabel: 'Sourced', secondaryLabel: 'Verified',
          bars: uploaders.map((r): Bar => ({ label: names.get(n(r.uid)) ?? `User ${r.uid}`, value: n(r.value), secondary: n(r.verified), personId: n(r.uid) })) },
      ],
    },
  ];
}
