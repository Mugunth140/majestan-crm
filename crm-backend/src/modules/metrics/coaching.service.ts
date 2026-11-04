import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { AnalyticsStoreService } from '../analytics/analytics-store.service';
import { CacheService } from '../analytics/cache.service';

type Viewer = { id: number; role: string; department_id?: number | null };
type Person = { id: number; name: string; department: string | null };
type Pipeline = { id: number; open: number; overdue: number; dueToday: number; unscheduled: number; untouched: number; rnr: number };
type Activity = { id: number; day: string; calls: number; messages: number; whatsapp: number; email: number; sms: number; followUps: number; visits: number; wins: number };

const ORG_ROLES = ['Admin', 'Super Admin', 'Manager'];
const PERIODS = new Set([7, 30, 90]);
const activityKeys = ['calls', 'messages', 'whatsapp', 'email', 'sms', 'followUps', 'visits', 'wins'] as const;
const pipelineKeys = ['open', 'overdue', 'dueToday', 'unscheduled', 'untouched', 'rnr'] as const;

function totals<K extends string>(rows: Partial<Record<K, number>>[], keys: readonly K[]) {
  return Object.fromEntries(keys.map(key => [key, rows.reduce((sum, row) => sum + (row[key] ?? 0), 0)])) as Record<K, number>;
}

@Injectable()
export class CoachingService {
  constructor(private readonly store: AnalyticsStoreService, private readonly cache: CacheService) {}

  private scope(viewer: Viewer) {
    if (ORG_ROLES.includes(viewer.role)) return 'organization';
    if (viewer.role === 'Team Lead') return 'department';
    return 'self';
  }

  async people(viewer: Viewer) {
    const scope = this.scope(viewer);
    const where = scope === 'organization' ? 'TRUE' : scope === 'department' ? '(u.id = ? OR u.department_id = (SELECT department_id FROM users WHERE id = ?))' : 'u.id = ?';
    const params = scope === 'organization' ? [] : scope === 'department' ? [viewer.id, viewer.id] : [viewer.id];
    const people = await this.store.query<Person>(
      `SELECT u.id, u.name, d.name AS department FROM users u LEFT JOIN departments d ON d.id = u.department_id
        WHERE u.is_active = 1 AND ${where} ORDER BY u.name, u.id`, params,
    );
    return { scope, people };
  }

  async report(viewer: Viewer, rawPerson?: string, rawDays?: string) {
    const days = rawDays === undefined ? 30 : Number(rawDays);
    if (!PERIODS.has(days)) throw new BadRequestException('Choose 7, 30 or 90 days');
    if (rawPerson !== undefined && (!/^\d+$/.test(rawPerson) || !Number.isSafeInteger(Number(rawPerson)) || Number(rawPerson) < 1)) {
      throw new BadRequestException('Invalid staff ID');
    }
    const { scope, people } = await this.people(viewer);
    const selected = rawPerson === undefined ? undefined : people.find(person => person.id === Number(rawPerson));
    if (rawPerson !== undefined && !selected) throw new ForbiddenException('This staff member is outside your dashboard scope');
    const roster = selected ? [selected] : people;
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const toMs = Date.parse(today);
    const from = new Date(toMs - (days - 1) * 86_400_000).toISOString().slice(0, 10);
    const dates = Array.from({ length: days }, (_, i) => new Date(Date.parse(from) + i * 86_400_000).toISOString().slice(0, 10));
    // The permitted roster is resolved before checking the cache, including after reassignment.
    const key = `metrics:coaching-v1:${viewer.role}:${viewer.id}:${today}:${days}:${selected?.id ?? 'all'}:${roster.map(p => p.id).join(',')}`;
    const data = await this.cache.wrap(key, 60, () => this.build(roster, from, today, dates));
    return { ...data, scope, selected: selected ?? null, from, to: today };
  }

  private async build(roster: Person[], from: string, today: string, dates: string[]) {
    const ids = roster.map(person => person.id);
    const placeholders = ids.length ? ids.map(() => '?').join(',') : 'NULL';
    const params = [from, today, ...ids];
    const portfolio = `
      WITH period AS (SELECT CAST(? AS DATE) AS start_day, CAST(? AS DATE) AS today),
      owned AS (
        SELECT id, name, status, assigned_staff_id, rnr_consecutive_count FROM leads
         WHERE assigned_staff_id IN (${placeholders})
           AND COALESCE(is_unqualified, 0) = 0 AND converted_to IS NULL
           AND status NOT IN ('Closed Won', 'Lost', 'Closed Lost', 'Dropped', 'Not Interested', 'Unqualified')
      ),
      latest AS (
        SELECT f.lead_id, f.next_follow_up_date, f.is_completed
          FROM lead_follow_ups f JOIN owned l ON l.id = f.lead_id
        QUALIFY ROW_NUMBER() OVER (PARTITION BY f.lead_id ORDER BY f.created_at DESC, f.id DESC) = 1
      ),
      touches AS (
        SELECT f.lead_id FROM lead_follow_ups f JOIN owned l ON l.id = f.lead_id AND l.assigned_staff_id = f.created_by_id, period
          WHERE f.created_at >= start_day AND f.created_at < today + INTERVAL 1 DAY
        UNION
        SELECT c.lead_id FROM contact_logs c JOIN owned l ON l.id = c.lead_id AND l.assigned_staff_id = c.sent_by_id, period
          WHERE c.created_at >= start_day AND c.created_at < today + INTERVAL 1 DAY
      ),
      work AS (
        SELECT l.*, CASE WHEN COALESCE(f.is_completed, 0) = 0 THEN f.next_follow_up_date END AS due,
          today, t.lead_id IS NULL AS untouched
        FROM owned l CROSS JOIN period LEFT JOIN latest f ON f.lead_id = l.id LEFT JOIN touches t ON t.lead_id = l.id
      )`;
    const [pipeline, queue, activity, targets] = await Promise.all([
      this.store.query<Pipeline>(`${portfolio}
        SELECT assigned_staff_id AS id, COUNT(*) AS open,
          COUNT(*) FILTER (WHERE due < today) AS overdue,
          COUNT(*) FILTER (WHERE due = today) AS dueToday,
          COUNT(*) FILTER (WHERE due IS NULL) AS unscheduled,
          COUNT(*) FILTER (WHERE untouched) AS untouched,
          COUNT(*) FILTER (WHERE rnr_consecutive_count >= 3) AS rnr
        FROM work GROUP BY assigned_staff_id`, params),
      this.store.query<{ id: number; name: string; ownerId: number; due: string | null; reason: string }>(`${portfolio}
        SELECT id, name, assigned_staff_id AS ownerId, CAST(due AS VARCHAR) AS due,
          CASE WHEN due < today THEN 'Overdue' WHEN due = today THEN 'Due today'
            WHEN rnr_consecutive_count >= 3 THEN '3+ unanswered attempts'
            WHEN due IS NULL THEN 'No next follow-up' ELSE 'No recent owner activity' END AS reason
        FROM work WHERE due <= today OR due IS NULL OR untouched OR rnr_consecutive_count >= 3
        ORDER BY CASE WHEN due < today THEN 0 WHEN due = today THEN 1 WHEN rnr_consecutive_count >= 3 THEN 2
          WHEN due IS NULL THEN 3 ELSE 4 END, due NULLS LAST, id LIMIT 12`, params),
      this.store.query<Activity>(`
        WITH period AS (SELECT CAST(? AS DATE) AS start_day, CAST(? AS DATE) + INTERVAL 1 DAY AS end_day),
        events AS (
          SELECT sent_by_id AS actor, created_at AS event_at, contact_type AS kind
            FROM all_contacts, period WHERE created_at >= start_day AND created_at < end_day
              AND contact_type IN ('call', 'sms', 'whatsapp', 'email')
          UNION ALL
          SELECT created_by_id, created_at, 'followUp' FROM lead_follow_ups, period WHERE created_at >= start_day AND created_at < end_day
          UNION ALL
          SELECT actor_id, created_at, CASE WHEN to_value = 'Closed Won' THEN 'win' ELSE 'visit' END
            FROM lead_events, period WHERE created_at >= start_day AND created_at < end_day AND type = 'status_changed'
              AND to_value IN ('Site Visit Completed', 'Re Visit Completed', 'Closed Won')
        )
        SELECT actor AS id, CAST(CAST(event_at AS DATE) AS VARCHAR) AS day,
          COUNT(*) FILTER (WHERE kind = 'call') AS calls,
          COUNT(*) FILTER (WHERE kind IN ('whatsapp', 'email', 'sms')) AS messages,
          COUNT(*) FILTER (WHERE kind = 'whatsapp') AS whatsapp, COUNT(*) FILTER (WHERE kind = 'email') AS email,
          COUNT(*) FILTER (WHERE kind = 'sms') AS sms,
          COUNT(*) FILTER (WHERE kind = 'followUp') AS followUps, COUNT(*) FILTER (WHERE kind = 'visit') AS visits,
          COUNT(*) FILTER (WHERE kind = 'win') AS wins
        FROM events WHERE actor IN (${placeholders}) GROUP BY ALL ORDER BY day`, params),
      this.store.query<{ id: number; ownerId: number; label: string; target: number; achieved: number; unit: string }>(`
        SELECT t.id, tt.assigned_to AS ownerId, t.metric_label AS label, t.monthly_target AS target,
          COALESCE(SUM(p.achieved_count), 0) AS achieved, t.metric_value_type AS unit
          FROM task_metric_targets t JOIN task_templates tt ON tt.id = t.task_template_id
          LEFT JOIN task_metric_progress p ON p.task_template_id = tt.id AND p.metric_key = t.metric_key AND p.month = tt.month
         WHERE tt.month = ? AND tt.status = 'active' AND t.monthly_target > 0 AND tt.assigned_to IN (${placeholders})
         GROUP BY ALL ORDER BY t.metric_label, t.id`, [today.slice(0, 7), ...ids]),
    ]);
    const byId = new Map(pipeline.map(row => [row.id, row]));
    const activityByPerson = new Map<number, Activity[]>();
    const activityByDay = new Map<string, Activity[]>();
    for (const row of activity) {
      if (!activityByPerson.has(row.id)) activityByPerson.set(row.id, []);
      if (!activityByDay.has(row.day)) activityByDay.set(row.day, []);
      activityByPerson.get(row.id)!.push(row);
      activityByDay.get(row.day)!.push(row);
    }
    const staff = roster.map(person => ({
      ...person,
      ...totals([byId.get(person.id) ?? {}], pipelineKeys),
      ...totals(activityByPerson.get(person.id) ?? [], activityKeys),
    })).sort((a, b) => b.overdue - a.overdue || b.untouched - a.untouched || a.name.localeCompare(b.name));
    return {
      summary: { ...totals(pipeline, pipelineKeys), ...totals(activity, activityKeys) },
      staff, queue, targets,
      trend: dates.map(day => ({ day, ...totals(activityByDay.get(day) ?? [], activityKeys) })),
      syncedAt: this.store.syncedAt,
    };
  }
}
