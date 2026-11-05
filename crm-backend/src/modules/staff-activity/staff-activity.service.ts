import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

export type StaffActivitySource = 'lead' | 'inbound' | 'agent' | 'hr' | 'asset';
export type StaffActivityGroup = 'activity' | 'conversation';

/** One thing a staff member did, on whichever record it was. */
export interface StaffActivityItem {
  id: string;
  group: StaffActivityGroup;
  source: StaffActivitySource;
  record: { id: number; name: string | null };
  at: string;
  /** A record event's type, 'routing', 'follow_up' or 'contact_log'. */
  kind: string;
  field: string | null;
  from: string | null;
  to: string | null;
  meta: Record<string, unknown> | null;
}

export interface StaffActivityQuery {
  userId: number;
  group?: StaffActivityGroup;
  /** Only entries at or after this time. */
  since?: Date;
  /** Only entries before this time: the cursor for the next page. */
  before?: Date;
  limit?: number;
}

const FAR_PAST = new Date('1970-01-01T00:00:00Z');
const FAR_FUTURE = new Date('9999-01-01T00:00:00Z');

const iso = (d: unknown) => (d instanceof Date ? d.toISOString() : new Date(String(d)).toISOString());
const parse = (m: unknown) => (typeof m === 'string' ? JSON.parse(m) : (m as Record<string, unknown> | null)) ?? null;

/** A DATE column as YYYY-MM-DD (the driver may hand back a local-midnight Date). */
const day = (d: unknown) => {
  if (d == null) return null;
  if (!(d instanceof Date)) return String(d).slice(0, 10);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// Each record's display name, by module.
const RECORD_NAME = {
  lead: 'l.name',
  inbound: "COALESCE(NULLIF(i.property_title, ''), i.owner_name)",
  agent: 'a.name',
  hr: 'h.name',
  asset: "COALESCE(NULLIF(s.display_id, ''), s.owner_name)",
} as const;

// Follow-ups and calls/messages live in one table per module.
const FOLLOW_UPS = [
  { source: 'lead', table: 'lead_follow_ups', key: 'lead_id', join: 'leads l', alias: 'l' },
  { source: 'inbound', table: 'inbound_follow_ups', key: 'inbound_id', join: 'inbounds i', alias: 'i' },
  { source: 'agent', table: 'agent_follow_ups', key: 'agent_id', join: 'agents a', alias: 'a' },
] as const;
const CONTACT_LOGS = [
  { source: 'lead', table: 'contact_logs', key: 'lead_id', join: 'leads l', alias: 'l', calls: false },
  { source: 'inbound', table: 'inbound_contact_logs', key: 'inbound_id', join: 'inbounds i', alias: 'i', calls: false },
  { source: 'agent', table: 'agent_contact_logs', key: 'agent_id', join: 'agents a', alias: 'a', calls: false },
  { source: 'hr', table: 'hr_contact_logs', key: 'hr_candidate_id', join: 'hr_candidates h', alias: 'h', calls: false },
  // Asset logs are calls only: no subject or message.
  { source: 'asset', table: 'asset_contact_logs', key: 'asset_id', join: 'assets s', alias: 's', calls: true },
] as const;

/**
 * One person's history across the CRM, newest first: what they changed on
 * records (Activity) and the follow-ups, calls and messages they logged
 * (Conversation). For admins and managers reviewing a staff member's day.
 */
@Injectable()
export class StaffActivityService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  async list(q: StaffActivityQuery) {
    if (!Number.isSafeInteger(q.userId) || q.userId <= 0) throw new BadRequestException('Pick a staff member');
    const limit = Math.min(Math.max(q.limit ?? 50, 1), 200);
    const window = [q.userId, q.since ?? FAR_PAST, q.before ?? FAR_FUTURE, limit];

    // Each source returns its newest `limit` rows; merged and cut to `limit` below.
    const queries: Promise<StaffActivityItem[]>[] = [];
    if (q.group !== 'conversation') {
      queries.push(
        this.ds.query(
          `SELECT e.id, e.lead_id AS record_id, ${RECORD_NAME.lead} AS record_name, e.type, e.field, e.from_value, e.to_value, e.meta, e.created_at
             FROM lead_events e LEFT JOIN leads l ON l.id = e.lead_id
            WHERE e.actor_id = ? AND e.created_at >= ? AND e.created_at < ?
            ORDER BY e.created_at DESC, e.id DESC LIMIT ?`,
          window,
        ).then((rows: any[]) => rows.map((r) => this.event('lead', `le${r.id}`, r))),
        this.ds.query(
          `SELECT e.id, e.entity, e.entity_id AS record_id,
                  CASE e.entity WHEN 'inbound' THEN ${RECORD_NAME.inbound} WHEN 'agent' THEN ${RECORD_NAME.agent} WHEN 'hr' THEN ${RECORD_NAME.hr} END AS record_name,
                  e.type, e.field, e.from_value, e.to_value, e.meta, e.created_at
             FROM record_events e
             LEFT JOIN inbounds i ON e.entity = 'inbound' AND i.id = e.entity_id
             LEFT JOIN agents a ON e.entity = 'agent' AND a.id = e.entity_id
             LEFT JOIN hr_candidates h ON e.entity = 'hr' AND h.id = e.entity_id
            WHERE e.actor_id = ? AND e.created_at >= ? AND e.created_at < ?
            ORDER BY e.created_at DESC, e.id DESC LIMIT ?`,
          window,
        ).then((rows: any[]) => rows.map((r) => this.event(r.entity, `re${r.id}`, r))),
        this.ds.query(
          `SELECT r.id, r.lead_id AS record_id, ${RECORD_NAME.lead} AS record_name, r.event_type, r.feedback, r.department, r.created_at,
                  f.name AS from_name, t.name AS to_name
             FROM routing_histories r
             LEFT JOIN leads l ON l.id = r.lead_id
             LEFT JOIN users f ON f.id = r.from_user_id
             LEFT JOIN users t ON t.id = r.to_user_id
            WHERE r.actioned_by_id = ? AND r.created_at >= ? AND r.created_at < ?
            ORDER BY r.created_at DESC, r.id DESC LIMIT ?`,
          window,
        ).then((rows: any[]) => rows.map((r) => ({
          id: `rh${r.id}`, group: 'activity' as const, source: 'lead' as const,
          record: { id: Number(r.record_id), name: r.record_name ?? null }, at: iso(r.created_at),
          kind: 'routing', field: r.event_type, from: r.from_name ?? null, to: r.to_name ?? null,
          meta: { feedback: r.feedback ?? null, department: r.department ?? null },
        }))),
      );
    }
    if (q.group !== 'activity') {
      for (const t of FOLLOW_UPS) {
        queries.push(this.ds.query(
          `SELECT f.id, f.${t.key} AS record_id, ${RECORD_NAME[t.source]} AS record_name, f.contacted_via, f.notes, f.priority, f.rnr,
                  f.next_follow_up_date, f.next_follow_up_time, f.created_at${t.source === 'lead' ? ', f.outcome' : ''}
             FROM ${t.table} f LEFT JOIN ${t.join} ON ${t.alias}.id = f.${t.key}
            WHERE f.created_by_id = ? AND f.created_at >= ? AND f.created_at < ?
            ORDER BY f.created_at DESC, f.id DESC LIMIT ?`,
          window,
        ).then((rows: any[]) => rows.map((r) => ({
          id: `${t.source}-fu${r.id}`, group: 'conversation' as const, source: t.source,
          record: { id: Number(r.record_id), name: r.record_name ?? null }, at: iso(r.created_at),
          kind: 'follow_up', field: null, from: null, to: null,
          meta: {
            via: r.contacted_via ?? null, notes: r.notes ?? null, priority: r.priority ?? null, rnr: r.rnr ?? null, outcome: r.outcome ?? null,
            next: [day(r.next_follow_up_date), r.next_follow_up_time ? String(r.next_follow_up_time).slice(0, 5) : null].filter(Boolean).join(' ') || null,
          },
        }))));
      }
      for (const t of CONTACT_LOGS) {
        queries.push(this.ds.query(
          `SELECT c.id, c.${t.key} AS record_id, ${RECORD_NAME[t.source]} AS record_name, c.contact_type,
                  ${t.calls ? 'NULL AS subject, NULL AS message' : 'c.subject, c.message'}, c.call_duration, c.call_direction, c.created_at
             FROM ${t.table} c LEFT JOIN ${t.join} ON ${t.alias}.id = c.${t.key}
            WHERE c.sent_by_id = ? AND c.created_at >= ? AND c.created_at < ?
            ORDER BY c.created_at DESC, c.id DESC LIMIT ?`,
          window,
        ).then((rows: any[]) => rows.map((r) => ({
          id: `${t.source}-cl${r.id}`, group: 'conversation' as const, source: t.source,
          record: { id: Number(r.record_id), name: r.record_name ?? null }, at: iso(r.created_at),
          kind: 'contact_log', field: r.contact_type ?? null, from: null, to: null,
          meta: {
            subject: r.subject ?? null, message: r.message ?? null,
            duration: r.call_duration == null ? null : Number(r.call_duration), direction: r.call_direction ?? null,
          },
        }))));
      }
    }

    const pages = await Promise.all(queries);
    const merged = pages.flat().sort((a, b) => b.at.localeCompare(a.at));
    const items = merged.slice(0, limit);
    // More exist when the merge had leftovers or any source filled its page.
    const more = merged.length > limit || pages.some((p) => p.length === limit);
    return { items, next: more && items.length ? items[items.length - 1].at : null };
  }

  /** Everyone whose activity can be reviewed: name, role, team and photo only. */
  async staff() {
    const rows: any[] = await this.ds.query(
      `SELECT u.id, u.name, u.avatar_url, u.is_active, r.name AS role, d.name AS department
         FROM users u LEFT JOIN roles r ON r.id = u.role_id LEFT JOIN departments d ON d.id = u.department_id
        ORDER BY u.is_active DESC, u.name`,
    );
    return rows.map((r) => ({
      id: Number(r.id), name: r.name, avatar_url: r.avatar_url ?? null, active: !!Number(r.is_active),
      role: r.role ?? null, department: r.department ?? null,
    }));
  }

  /** How much the person did in the window: calls, messages, follow-ups and record changes. */
  async summary(userId: number, since?: Date) {
    const args = [userId, since ?? FAR_PAST];
    const one = (sql: string) => this.ds.query(sql, args).then((r: any[]) => r[0] ?? {});
    const [logs, followUps, changes] = await Promise.all([
      Promise.all(CONTACT_LOGS.map((t) => one(
        `SELECT SUM(contact_type = 'call') AS calls, SUM(contact_type <> 'call') AS messages FROM ${t.table} WHERE sent_by_id = ? AND created_at >= ?`))),
      Promise.all(FOLLOW_UPS.map((t) => one(`SELECT COUNT(*) AS c FROM ${t.table} WHERE created_by_id = ? AND created_at >= ?`))),
      Promise.all([
        one('SELECT COUNT(*) AS c FROM lead_events WHERE actor_id = ? AND created_at >= ?'),
        one('SELECT COUNT(*) AS c FROM record_events WHERE actor_id = ? AND created_at >= ?'),
        one('SELECT COUNT(*) AS c FROM routing_histories WHERE actioned_by_id = ? AND created_at >= ?'),
      ]),
    ]);
    const sum = (rows: any[], key: string) => rows.reduce((n, r) => n + Number(r[key] ?? 0), 0);
    return { calls: sum(logs, 'calls'), messages: sum(logs, 'messages'), followUps: sum(followUps, 'c'), changes: sum(changes, 'c') };
  }

  private event(source: StaffActivitySource, id: string, r: any): StaffActivityItem {
    return {
      id, group: 'activity', source, record: { id: Number(r.record_id), name: r.record_name ?? null }, at: iso(r.created_at),
      kind: r.type, field: r.field ?? null, from: r.from_value ?? null, to: r.to_value ?? null, meta: parse(r.meta),
    };
  }
}
