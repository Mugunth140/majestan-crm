import type { DataSource } from 'typeorm';
import { trackingOf } from './task-metrics';

/**
 * Task progress is counted from the work itself, not from a running tally:
 * calls from the call logger and the CRM, follow-ups, lead status moves (first
 * time per lead in the month, by the person who made them), inbound listings and
 * verifications, HR candidates and their stage moves, receipts, and hand-logged
 * entries. Re-saving a status or reopening a lead cannot count twice, and the
 * Tasks page and the Dashboard read the same numbers.
 */

const QUALIFIED = ['Qualified', 'Interested'];
const BOOKED = ['Booking Advance', 'Agreement', 'Closed Won'];
const DROPPED = ['Dropped', 'Lost', 'Not Interested'];

/** Lead statuses that count toward each auto-tracked lead metric. */
export const STATUS_METRICS: Record<string, string[]> = {
  opportunity: QUALIFIED,
  validation: ['Qualified'],
  sv_schedule: ['Site Visit Scheduled'],
  sv_done: ['Site Visit Completed'],
  rsv_schedule: ['Re Visit Scheduled'],
  rsv_done: ['Re Visit Completed'],
  prospective: ['Negotiation'],
  booked: BOOKED,
  rejection: DROPPED,
  dropped: DROPPED,
  verification: ['Property Shared'],
};

/** HR candidate stages that count, once per candidate, toward each HR metric. */
export const HR_STAGE_METRICS: Record<string, string[]> = {
  interviews_scheduled: ['Interview Scheduled'],
  interviews_completed: ['Interview Completed'],
  hires_made: ['Joined'],
};

/** Every table a call or message is logged in, and the record it belongs to. */
export const CONTACT_SOURCES = [
  { table: 'contact_logs', entity: 'lead', id: 'lead_id' },
  { table: 'agent_contact_logs', entity: 'agent', id: 'agent_id' },
  { table: 'inbound_contact_logs', entity: 'inbound', id: 'inbound_id' },
  { table: 'asset_contact_logs', entity: 'asset', id: 'asset_id' },
  { table: 'hr_contact_logs', entity: 'hr', id: 'hr_candidate_id' },
] as const;

/** Follow-up tables that record who made them. */
export const FOLLOW_UP_SOURCES = [
  { table: 'lead_follow_ups', entity: 'lead', id: 'lead_id' },
  { table: 'agent_follow_ups', entity: 'agent', id: 'agent_id' },
  { table: 'inbound_follow_ups', entity: 'inbound', id: 'inbound_id' },
] as const;

/** Call metrics: which calls count and how they add up. */
const CALL_METRICS: Record<string, { tables: string[]; value: 'calls' | 'connected' | 'minutes' }> = {
  call_count: { tables: CONTACT_SOURCES.map(s => s.table), value: 'calls' },
  collection_calls: { tables: CONTACT_SOURCES.map(s => s.table), value: 'calls' },
  connected_calls: { tables: CONTACT_SOURCES.map(s => s.table), value: 'connected' },
  talk_minutes: { tables: CONTACT_SOURCES.map(s => s.table), value: 'minutes' },
  verification_calls: { tables: ['inbound_contact_logs'], value: 'calls' },
  hr_calls: { tables: ['hr_contact_logs'], value: 'calls' },
};

/** Unique-contact metrics: each record counts once a month, on its first touch. */
const REACH_METRICS: Record<string, string[]> = {
  leads_contacted: ['lead'],
  customers_contacted: ['lead', 'agent', 'inbound', 'asset'],
};

const FOLLOW_UP_METRICS = ['followups_done', 'payment_followups'];

const IST = 'INTERVAL 330 MINUTE';
const day = (col: string) => `DATE_FORMAT(DATE_ADD(${col}, ${IST}), '%Y-%m-%d')`;

export type TemplateRef = {
  id: number;
  assigned_to: number;
  month: string;
  metricTargets?: { metric_key: string; tracking_type: string }[];
};

/** UTC bounds of an IST calendar month, as MySQL datetime strings. */
export function monthBounds(month: string) {
  const [y, m] = month.split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1) - 330 * 60_000);
  const end = new Date(Date.UTC(y, m, 1) - 330 * 60_000);
  const sql = (d: Date) => d.toISOString().slice(0, 19).replace('T', ' ');
  return { from: sql(start), to: sql(end), lastDay: new Date(Date.UTC(y, m, 0)).getUTCDate() };
}

/** Achieved value per template → metric → IST date ('YYYY-MM-DD'). */
export type DailyProgress = Map<number, Map<string, Map<string, number>>>;

const dateKey = (v: unknown) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10));

export async function dailyProgress(dataSource: DataSource, templates: TemplateRef[]): Promise<DailyProgress> {
  const result: DailyProgress = new Map();
  const add = (templateId: number, metric: string, date: string, value: number) => {
    if (!value) return;
    if (!result.has(templateId)) result.set(templateId, new Map());
    const metrics = result.get(templateId)!;
    if (!metrics.has(metric)) metrics.set(metric, new Map());
    const days = metrics.get(metric)!;
    days.set(date, (days.get(date) ?? 0) + value);
  };

  const byMonth = new Map<string, TemplateRef[]>();
  for (const t of templates) byMonth.set(t.month, [...(byMonth.get(t.month) ?? []), t]);

  for (const [month, group] of byMonth) {
    const { from, to } = monthBounds(month);
    const ids = [...new Set(group.map(t => t.assigned_to))];
    const templateFor = new Map(group.map(t => [t.assigned_to, t]));
    const isAuto = (m: { metric_key: string; tracking_type: string }) => trackingOf(m.metric_key, m.tracking_type) === 'auto';
    const wanted = new Set(group.flatMap(t => (t.metricTargets ?? []).filter(isAuto).map(m => m.metric_key)));
    const window = (col: string) => `${col} >= ? AND ${col} < ?`;
    const credit = (rows: { uid: number; metric: string; d: unknown; n: number | string }[]) => {
      for (const row of rows) {
        const template = templateFor.get(Number(row.uid));
        if (template) add(template.id, row.metric, dateKey(row.d), Number(row.n));
      }
    };

    // Calls, once over every contact table, then split into the call metrics.
    const callMetrics = Object.entries(CALL_METRICS).filter(([k]) => wanted.has(k));
    if (callMetrics.length) {
      const tables = [...new Set(callMetrics.flatMap(([, c]) => c.tables))];
      const rows: { uid: number; src: string; d: unknown; calls: string; connected: string; secs: string }[] = await dataSource.query(
        tables.map(t => `SELECT sent_by_id AS uid, '${t}' AS src, ${day('created_at')} AS d, COUNT(*) AS calls,
            SUM(COALESCE(call_duration, 0) > 0) AS connected, SUM(COALESCE(call_duration, 0)) AS secs FROM ${t}
          WHERE contact_type = 'call' AND sent_by_id IN (?) AND ${window('created_at')} GROUP BY uid, d`).join('\nUNION ALL\n'),
        tables.flatMap(() => [ids, from, to]));
      const minutes = new Map<string, { uid: number; d: string; secs: number }>();
      for (const row of rows) {
        for (const [metric, c] of callMetrics) {
          if (!c.tables.includes(row.src)) continue;
          if (c.value === 'minutes') {
            const k = `${row.uid}|${dateKey(row.d)}`;
            const m = minutes.get(k) ?? { uid: Number(row.uid), d: dateKey(row.d), secs: 0 };
            m.secs += Number(row.secs);
            minutes.set(k, m);
          } else credit([{ uid: row.uid, metric, d: row.d, n: c.value === 'calls' ? row.calls : row.connected }]);
        }
      }
      for (const m of minutes.values()) credit([{ uid: m.uid, metric: 'talk_minutes', d: m.d, n: Math.round(m.secs / 60) }]);
    }

    const parts: string[] = [];
    const params: unknown[] = [];

    for (const [metric, entities] of Object.entries(REACH_METRICS)) {
      if (!wanted.has(metric)) continue;
      const touches = [
        ...CONTACT_SOURCES.filter(s => entities.includes(s.entity)).map(s => ({ ...s, uid: 'sent_by_id' })),
        ...FOLLOW_UP_SOURCES.filter(s => entities.includes(s.entity)).map(s => ({ ...s, uid: 'created_by_id' })),
      ];
      parts.push(`SELECT uid, '${metric}' AS metric, d, COUNT(*) AS n FROM (
          SELECT uid, ${day('MIN(t_at)')} AS d FROM (
            ${touches.map(s => `SELECT ${s.uid} AS uid, '${s.entity}' AS ent, ${s.id} AS eid, created_at AS t_at FROM ${s.table}
              WHERE ${s.uid} IN (?) AND ${window('created_at')}`).join('\n            UNION ALL\n            ')}
          ) touches GROUP BY uid, ent, eid) firsts GROUP BY uid, d`);
      touches.forEach(() => params.push(ids, from, to));
    }
    for (const metric of FOLLOW_UP_METRICS) {
      if (!wanted.has(metric)) continue;
      for (const s of FOLLOW_UP_SOURCES) {
        parts.push(`SELECT created_by_id AS uid, '${metric}' AS metric, ${day('created_at')} AS d, COUNT(*) AS n FROM ${s.table}
          WHERE created_by_id IN (?) AND ${window('created_at')} GROUP BY uid, d`);
        params.push(ids, from, to);
      }
    }
    for (const [metric, statuses] of Object.entries(STATUS_METRICS)) {
      if (!wanted.has(metric)) continue;
      parts.push(`SELECT uid, '${metric}' AS metric, d, COUNT(*) AS n FROM (
          SELECT actor_id AS uid, ${day('MIN(created_at)')} AS d FROM lead_events
           WHERE type = 'status_changed' AND to_value IN (?) AND actor_id IN (?) AND ${window('created_at')}
           GROUP BY actor_id, lead_id) first_moves GROUP BY uid, d`);
      params.push(statuses, ids, from, to);
    }
    for (const [metric, stages] of Object.entries(HR_STAGE_METRICS)) {
      if (!wanted.has(metric)) continue;
      parts.push(`SELECT uid, '${metric}' AS metric, d, COUNT(*) AS n FROM (
          SELECT actor_id AS uid, ${day('MIN(created_at)')} AS d FROM record_events
           WHERE entity = 'hr' AND field = 'status' AND to_value IN (?) AND actor_id IN (?) AND ${window('created_at')}
           GROUP BY actor_id, entity_id) first_moves GROUP BY uid, d`);
      params.push(stages, ids, from, to);
    }
    if (wanted.has('candidates_sourced')) {
      parts.push(`SELECT assignedStaffId AS uid, 'candidates_sourced' AS metric, ${day('createdAt')} AS d, COUNT(*) AS n FROM hr_candidates
        WHERE assignedStaffId IN (?) AND ${window('createdAt')} GROUP BY uid, d`);
      params.push(ids, from, to);
    }
    if (wanted.has('sourcing')) {
      parts.push(`SELECT assigned_staff_id AS uid, 'sourcing' AS metric, ${day('created_at')} AS d, COUNT(*) AS n FROM leads
        WHERE assigned_staff_id IN (?) AND ${window('created_at')} GROUP BY uid, d`);
      params.push(ids, from, to);
    }
    if (wanted.has('properties_sourced')) {
      parts.push(`SELECT uploaded_by_id AS uid, 'properties_sourced' AS metric, ${day('created_at')} AS d, COUNT(*) AS n FROM inbounds
        WHERE uploaded_by_id IN (?) AND ${window('created_at')} GROUP BY uid, d`);
      params.push(ids, from, to);
    }
    if (wanted.has('documents_collected')) {
      parts.push(`SELECT uploaded_by_id AS uid, 'documents_collected' AS metric, ${day('created_at')} AS d, COUNT(*) AS n FROM inbounds
        WHERE documents_collected = 1 AND uploaded_by_id IN (?) AND ${window('created_at')} GROUP BY uid, d`);
      params.push(ids, from, to);
    }
    if (wanted.has('verifications_done')) {
      parts.push(`SELECT uid, 'verifications_done' AS metric, d, COUNT(*) AS n FROM (
          SELECT actor_id AS uid, ${day('MIN(created_at)')} AS d FROM record_events
           WHERE entity = 'inbound' AND field = 'inbound_status' AND to_value = 'verification_done' AND actor_id IN (?) AND ${window('created_at')}
           GROUP BY actor_id, entity_id) first_moves GROUP BY uid, d`);
      params.push(ids, from, to);
    }

    if (parts.length) credit(await dataSource.query(parts.join('\nUNION ALL\n'), params));

    const templateIds = group.map(t => t.id);
    if (wanted.has('receipts_uploaded')) {
      const rows: { tid: number; d: unknown; n: number | string }[] = await dataSource.query(
        `SELECT task_template_id AS tid, ${day('created_at')} AS d, COUNT(*) AS n FROM task_receipts
          WHERE task_template_id IN (?) GROUP BY tid, d`, [templateIds]);
      for (const row of rows) add(Number(row.tid), 'receipts_uploaded', dateKey(row.d), Number(row.n));
    }
    // Hand-logged entries, on the day they were logged for.
    const manual: { tid: number; metric_key: string; d: unknown; n: number | string }[] = await dataSource.query(
      `SELECT task_template_id AS tid, metric_key, DATE_FORMAT(logged_date, '%Y-%m-%d') AS d, SUM(count_value) AS n FROM task_activity_logs
        WHERE task_template_id IN (?) GROUP BY tid, metric_key, d`, [templateIds]);
    for (const row of manual) {
      const template = group.find(t => t.id === Number(row.tid));
      const target = template?.metricTargets?.find(m => m.metric_key === row.metric_key);
      if (target && !isAuto(target)) add(Number(row.tid), row.metric_key, dateKey(row.d), Number(row.n));
    }
  }
  return result;
}

// ── What was counted ──────────────────────────────────────────────────────

export type ActivityItem = {
  at: string;
  kind: 'call' | 'message' | 'follow_up' | 'status' | 'listing' | 'candidate' | 'receipt' | 'manual';
  /** Metrics on the task this item counted toward. */
  metrics: string[];
  title: string;
  detail: string | null;
  /** The call logger on the phone, the CRM, or a hand entry. */
  source: 'logger' | 'crm' | 'manual';
  href: string | null;
};

const ENTITY_LINK: Record<string, { table: string; name: string; href: (id: number) => string }> = {
  lead: { table: 'leads', name: 'name', href: id => `/leads/${id}` },
  agent: { table: 'agents', name: 'name', href: id => `/agent-network/${id}` },
  inbound: { table: 'inbounds', name: 'COALESCE(property_title, owner_name)', href: id => `/inbound/${id}` },
  asset: { table: 'assets', name: 'COALESCE(display_id, owner_name)', href: id => `/asset-inventory/${id}` },
  hr: { table: 'hr_candidates', name: 'name', href: id => `/hr/${id}` },
};

/**
 * The latest things that counted toward a task, newest first, so staff can see
 * why a number moved. Covers the same sources as dailyProgress for that month.
 */
export async function activityFeed(dataSource: DataSource, template: TemplateRef, limit = 60): Promise<ActivityItem[]> {
  const { from, to } = monthBounds(template.month);
  const uid = template.assigned_to;
  const targets = (template.metricTargets ?? []).map(m => ({ key: m.metric_key, auto: trackingOf(m.metric_key, m.tracking_type) === 'auto' }));
  const has = (k: string) => targets.some(t => t.key === k && t.auto);
  const items: ActivityItem[] = [];
  const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : new Date(`${String(v).replace(' ', 'T')}Z`).toISOString());
  const name = (e: string) => {
    const l = ENTITY_LINK[e];
    return `(SELECT ${l.name} FROM ${l.table} x WHERE x.id = c.eid)`;
  };

  const callKeys = Object.keys(CALL_METRICS).filter(has);
  const reachKeys = Object.keys(REACH_METRICS).filter(has);
  // A record counts as contacted once a month, on its first touch; later touches don't add to it.
  const firstTouch = new Map<string, string>();
  if (reachKeys.length) {
    const entities = new Set(reachKeys.flatMap(k => REACH_METRICS[k]));
    const sources = [
      ...CONTACT_SOURCES.filter(s => entities.has(s.entity)).map(s => ({ ...s, uid: 'sent_by_id' })),
      ...FOLLOW_UP_SOURCES.filter(s => entities.has(s.entity)).map(s => ({ ...s, uid: 'created_by_id' })),
    ];
    const rows = (await Promise.all(sources.map(s => dataSource.query(
      `SELECT '${s.entity}' AS ent, ${s.id} AS eid, MIN(created_at) AS t_at FROM ${s.table}
        WHERE ${s.uid} = ? AND created_at >= ? AND created_at < ? GROUP BY ${s.id}`, [uid, from, to])))).flat() as { ent: string; eid: number; t_at: unknown }[];
    for (const r of rows) {
      const k = `${r.ent}:${r.eid}`, at = iso(r.t_at);
      if (!firstTouch.has(k) || at < firstTouch.get(k)!) firstTouch.set(k, at);
    }
  }
  // Claimed once, so a call and a follow-up logged in the same second don't both take it.
  const reachFor = (ent: string, eid: number, at: string) => {
    const key = `${ent}:${eid}`;
    if (firstTouch.get(key) !== at) return [];
    firstTouch.delete(key);
    return reachKeys.filter(k => REACH_METRICS[k].includes(ent));
  };
  if (callKeys.length || reachKeys.length) {
    // One query per table: their text columns do not share a collation, so no UNION.
    const rows = (await Promise.all(CONTACT_SOURCES.map(s => dataSource.query(
      `SELECT '${s.entity}' AS ent, c.eid, c.contact_type, c.call_duration, c.call_direction, c.logger, c.t_at, ${name(s.entity)} AS label
        FROM (SELECT ${s.id} AS eid, contact_type, call_duration, call_direction, source_call_id IS NOT NULL AS logger, created_at AS t_at FROM ${s.table}
          WHERE sent_by_id = ? AND created_at >= ? AND created_at < ? ORDER BY created_at DESC LIMIT ${limit}) c`, [uid, from, to]))))
      .flat() as { ent: string; eid: number; contact_type: string; call_duration: number | null; call_direction: string | null; logger: number; t_at: unknown; label: string | null }[];
    for (const r of rows) {
      const isCall = r.contact_type === 'call';
      const table = CONTACT_SOURCES.find(s => s.entity === r.ent)!.table;
      const metrics = [
        ...(isCall ? callKeys.filter(k => CALL_METRICS[k].tables.includes(table) && (CALL_METRICS[k].value === 'calls' || (r.call_duration ?? 0) > 0)) : []),
        ...reachFor(r.ent, r.eid, iso(r.t_at)),
      ];
      if (!metrics.length) continue;
      const secs = Number(r.call_duration ?? 0);
      const length = secs > 0 ? (secs >= 60 ? `${Math.floor(secs / 60)} min ${secs % 60} s` : `${secs} s`) : 'Not connected';
      items.push({
        at: iso(r.t_at), kind: isCall ? 'call' : 'message', metrics,
        title: r.label || `${r.ent} #${r.eid}`,
        detail: isCall ? [r.call_direction === 'incoming' ? 'Incoming' : r.call_direction === 'outgoing' ? 'Outgoing' : null, length].filter(Boolean).join(' · ') : r.contact_type,
        source: r.logger ? 'logger' : 'crm', href: ENTITY_LINK[r.ent].href(Number(r.eid)),
      });
    }
  }

  const followKeys = [...FOLLOW_UP_METRICS, ...Object.keys(REACH_METRICS)].filter(has);
  if (followKeys.length) {
    const rows = (await Promise.all(FOLLOW_UP_SOURCES.map(s => dataSource.query(
      `SELECT '${s.entity}' AS ent, c.eid, c.t_at, c.outcome, ${name(s.entity)} AS label
        FROM (SELECT ${s.id} AS eid, created_at AS t_at, ${s.table === 'lead_follow_ups' ? 'COALESCE(outcome, purpose)' : 'purpose'} AS outcome FROM ${s.table}
          WHERE created_by_id = ? AND created_at >= ? AND created_at < ? ORDER BY created_at DESC LIMIT ${limit}) c`, [uid, from, to]))))
      .flat() as { ent: string; eid: number; t_at: unknown; outcome: string | null; label: string | null }[];
    for (const r of rows) {
      const metrics = [...followKeys.filter(k => FOLLOW_UP_METRICS.includes(k)), ...reachFor(r.ent, r.eid, iso(r.t_at))];
      if (metrics.length) items.push({ at: iso(r.t_at), kind: 'follow_up', metrics, title: r.label || `${r.ent} #${r.eid}`, detail: r.outcome, source: 'crm', href: ENTITY_LINK[r.ent].href(Number(r.eid)) });
    }
  }

  const statusKeys = Object.keys(STATUS_METRICS).filter(has);
  if (statusKeys.length) {
    const statuses = [...new Set(statusKeys.flatMap(k => STATUS_METRICS[k]))];
    const rows: { eid: number; to_value: string; t_at: unknown; label: string | null }[] = await dataSource.query(
      `SELECT c.eid, c.to_value, c.t_at, ${name('lead')} AS label FROM (
         SELECT lead_id AS eid, to_value, MIN(created_at) AS t_at FROM lead_events
          WHERE type = 'status_changed' AND to_value IN (?) AND actor_id = ? AND created_at >= ? AND created_at < ?
          GROUP BY lead_id, to_value ORDER BY t_at DESC LIMIT ${limit}) c`, [statuses, uid, from, to]);
    for (const r of rows) {
      items.push({ at: iso(r.t_at), kind: 'status', metrics: statusKeys.filter(k => STATUS_METRICS[k].includes(r.to_value)),
        title: r.label || `Lead #${r.eid}`, detail: `Moved to ${r.to_value}`, source: 'crm', href: ENTITY_LINK.lead.href(Number(r.eid)) });
    }
  }

  const hrKeys = Object.keys(HR_STAGE_METRICS).filter(has);
  if (hrKeys.length) {
    const stages = [...new Set(hrKeys.flatMap(k => HR_STAGE_METRICS[k]))];
    const rows: { eid: number; to_value: string; t_at: unknown; label: string | null }[] = await dataSource.query(
      `SELECT c.eid, c.to_value, c.t_at, ${name('hr')} AS label FROM (
         SELECT entity_id AS eid, to_value, MIN(created_at) AS t_at FROM record_events
          WHERE entity = 'hr' AND field = 'status' AND to_value IN (?) AND actor_id = ? AND created_at >= ? AND created_at < ?
          GROUP BY entity_id, to_value ORDER BY t_at DESC LIMIT ${limit}) c`, [stages, uid, from, to]);
    for (const r of rows) {
      items.push({ at: iso(r.t_at), kind: 'status', metrics: hrKeys.filter(k => HR_STAGE_METRICS[k].includes(r.to_value)),
        title: r.label || `Candidate #${r.eid}`, detail: `Moved to ${r.to_value}`, source: 'crm', href: ENTITY_LINK.hr.href(Number(r.eid)) });
    }
  }
  if (has('candidates_sourced')) {
    const rows: { id: number; name: string; t_at: unknown }[] = await dataSource.query(
      `SELECT id, name, createdAt AS t_at FROM hr_candidates WHERE assignedStaffId = ? AND createdAt >= ? AND createdAt < ? ORDER BY createdAt DESC LIMIT ${limit}`, [uid, from, to]);
    for (const r of rows) items.push({ at: iso(r.t_at), kind: 'candidate', metrics: ['candidates_sourced'], title: r.name, detail: 'Candidate added', source: 'crm', href: ENTITY_LINK.hr.href(r.id) });
  }
  if (has('sourcing')) {
    const rows: { id: number; name: string; t_at: unknown }[] = await dataSource.query(
      `SELECT id, name, created_at AS t_at FROM leads WHERE assigned_staff_id = ? AND created_at >= ? AND created_at < ? ORDER BY created_at DESC LIMIT ${limit}`, [uid, from, to]);
    for (const r of rows) items.push({ at: iso(r.t_at), kind: 'listing', metrics: ['sourcing'], title: r.name || `Lead #${r.id}`, detail: 'New lead', source: 'crm', href: ENTITY_LINK.lead.href(r.id) });
  }
  if (has('properties_sourced') || has('documents_collected')) {
    const rows: { id: number; label: string | null; docs: number; t_at: unknown }[] = await dataSource.query(
      `SELECT id, COALESCE(property_title, owner_name) AS label, documents_collected AS docs, created_at AS t_at FROM inbounds
        WHERE uploaded_by_id = ? AND created_at >= ? AND created_at < ? ORDER BY created_at DESC LIMIT ${limit}`, [uid, from, to]);
    for (const r of rows) {
      const metrics = [has('properties_sourced') ? 'properties_sourced' : null, has('documents_collected') && Number(r.docs) ? 'documents_collected' : null].filter((m): m is string => !!m);
      if (metrics.length) items.push({ at: iso(r.t_at), kind: 'listing', metrics, title: r.label || `Listing #${r.id}`, detail: Number(r.docs) ? 'Listing added with documents' : 'Listing added', source: 'crm', href: ENTITY_LINK.inbound.href(r.id) });
    }
  }
  if (has('verifications_done')) {
    const rows: { eid: number; t_at: unknown; label: string | null }[] = await dataSource.query(
      `SELECT c.eid, c.t_at, ${name('inbound')} AS label FROM (
         SELECT entity_id AS eid, MIN(created_at) AS t_at FROM record_events
          WHERE entity = 'inbound' AND field = 'inbound_status' AND to_value = 'verification_done' AND actor_id = ? AND created_at >= ? AND created_at < ?
          GROUP BY entity_id ORDER BY t_at DESC LIMIT ${limit}) c`, [uid, from, to]);
    for (const r of rows) items.push({ at: iso(r.t_at), kind: 'status', metrics: ['verifications_done'], title: r.label || `Listing #${r.eid}`, detail: 'Verification done', source: 'crm', href: ENTITY_LINK.inbound.href(Number(r.eid)) });
  }
  if (has('receipts_uploaded')) {
    const rows: { file_name: string; file_url: string; t_at: unknown }[] = await dataSource.query(
      `SELECT file_name, file_url, created_at AS t_at FROM task_receipts WHERE task_template_id = ? ORDER BY created_at DESC LIMIT ${limit}`, [template.id]);
    for (const r of rows) items.push({ at: iso(r.t_at), kind: 'receipt', metrics: ['receipts_uploaded'], title: r.file_name, detail: 'Receipt uploaded', source: 'crm', href: r.file_url });
  }
  const manualKeys = targets.filter(t => !t.auto).map(t => t.key);
  if (manualKeys.length) {
    const rows: { metric_key: string; count_value: string; note: string | null; t_at: unknown; by_name: string | null }[] = await dataSource.query(
      `SELECT l.metric_key, l.count_value, l.note, l.created_at AS t_at, u.name AS by_name FROM task_activity_logs l LEFT JOIN users u ON u.id = l.logged_by
        WHERE l.task_template_id = ? AND l.metric_key IN (?) ORDER BY l.created_at DESC LIMIT ${limit}`, [template.id, manualKeys]);
    for (const r of rows) {
      const n = Number(r.count_value);
      items.push({ at: iso(r.t_at), kind: 'manual', metrics: [r.metric_key], title: `${n > 0 ? '+' : ''}${n.toLocaleString('en-IN')} logged`, detail: [r.note, r.by_name ? `by ${r.by_name}` : null].filter(Boolean).join(' · ') || null, source: 'manual', href: null });
    }
  }

  return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}
