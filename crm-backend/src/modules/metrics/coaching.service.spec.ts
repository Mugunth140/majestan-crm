import { CoachingService } from './coaching.service';
import type { AnalyticsStoreService } from '../analytics/analytics-store.service';
import type { CacheService } from '../analytics/cache.service';

function setup() {
  const query = jest.fn()
    .mockResolvedValueOnce([{ id: 3, name: 'Local staff', department: 'Sales' }])
    .mockResolvedValue([]);
  const wrap = jest.fn((_key, _ttl, load: () => Promise<unknown>) => load());
  const service = new CoachingService(
    { query } as unknown as AnalyticsStoreService,
    { wrap } as unknown as CacheService,
  );
  return { service, query, wrap };
}

describe('coaching dashboard scope', () => {
  it('rejects selection outside the roster before loading a cached report', async () => {
    const { service, query, wrap } = setup();
    await expect(service.report({ id: 3, role: 'Staff' }, '4', '7')).rejects.toMatchObject({ status: 403 });
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][1]).toEqual([3]);
    expect(wrap).not.toHaveBeenCalled();
  });

  it('uses the team lead’s current department membership rather than a requested department', async () => {
    const { service, query } = setup();
    await service.people({ id: 4, role: 'Team Lead', department_id: 99 });
    expect(query.mock.calls[0][0]).toContain('SELECT department_id FROM users WHERE id = ?');
    expect(query.mock.calls[0][1]).toEqual([4, 4]);
  });

  it('zero-fills days with no activity and scopes each report query to the selected user', async () => {
    const { service, query } = setup();
    const report = await service.report({ id: 1, role: 'Admin' }, '3', '7');
    expect(report.selected?.id).toBe(3);
    expect(report.trend).toHaveLength(7);
    expect(report.trend.every(day => day.calls === 0)).toBe(true);
    for (const [, params] of query.mock.calls.slice(1)) expect(params.at(-1)).toBe(3);
  });

  it.each(['0', '120', 'abc'])('rejects invalid reporting periods (%s)', async days => {
    const { service, query } = setup();
    await expect(service.report({ id: 1, role: 'Admin' }, undefined, days)).rejects.toMatchObject({ status: 400 });
    expect(query).not.toHaveBeenCalled();
  });
});

it('uses latest pending follow-ups, separates owner coverage from actor activity, and counts only current targets', async () => {
  const { DuckDBInstance } = await import('@duckdb/node-api');
  const db = await DuckDBInstance.create(':memory:');
  const connection = await db.connect();
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const yesterday = new Date(Date.parse(today) - 86_400_000).toISOString().slice(0, 10);
  const month = today.slice(0, 7);
  try {
    await connection.run(`
      CREATE TABLE departments(id INTEGER, name VARCHAR);
      CREATE TABLE users(id INTEGER, name VARCHAR, department_id INTEGER, is_active INTEGER);
      INSERT INTO departments VALUES (1, 'Sales');
      INSERT INTO users VALUES (2, 'Other actor', 1, 1), (3, 'Owner', 1, 1);
      CREATE TABLE leads(id INTEGER, name VARCHAR, status VARCHAR, assigned_staff_id INTEGER, is_unqualified INTEGER,
        converted_to VARCHAR, rnr_consecutive_count INTEGER);
      INSERT INTO leads VALUES (10, 'Overdue lead', 'Contacted', 3, 0, NULL, 3),
        (11, 'Touched lead', 'Contacted', 3, 0, NULL, 0), (12, 'Closed lead', 'Closed Won', 3, 0, NULL, 0);
      CREATE TABLE lead_follow_ups(id INTEGER, lead_id INTEGER, next_follow_up_date DATE, is_completed INTEGER,
        created_by_id INTEGER, created_at TIMESTAMP);
      INSERT INTO lead_follow_ups VALUES (1, 10, '${today}', 0, 2, '${yesterday} 09:00:00'),
        (2, 10, '${yesterday}', 0, 2, '${yesterday} 10:00:00'), (3, 11, '${today}', 1, 3, '${yesterday} 11:00:00');
      CREATE TABLE contact_logs(lead_id INTEGER, sent_by_id INTEGER, created_at TIMESTAMP);
      CREATE TABLE all_contacts(sent_by_id INTEGER, contact_type VARCHAR, created_at TIMESTAMP);
      INSERT INTO all_contacts VALUES (2, 'call', '${yesterday} 10:00:00'), (3, 'whatsapp', '${yesterday} 11:00:00');
      CREATE TABLE lead_events(actor_id INTEGER, created_at TIMESTAMP, type VARCHAR, to_value VARCHAR);
      INSERT INTO lead_events VALUES (3, '${yesterday} 12:00:00', 'status_changed', 'Closed Won');
      CREATE TABLE task_templates(id INTEGER, assigned_to INTEGER, month VARCHAR, status VARCHAR);
      INSERT INTO task_templates VALUES (1, 3, '${month}', 'active');
      CREATE TABLE task_metric_targets(id INTEGER, task_template_id INTEGER, metric_key VARCHAR, metric_label VARCHAR,
        monthly_target DOUBLE, metric_value_type VARCHAR);
      INSERT INTO task_metric_targets VALUES (1, 1, 'calls', 'Calls', 10, 'count');
      CREATE TABLE task_metric_progress(task_template_id INTEGER, metric_key VARCHAR, month VARCHAR, achieved_count DOUBLE);
      INSERT INTO task_metric_progress VALUES (1, 'calls', '${month}', 4), (1, 'calls', '2020-01', 50);
    `);
    const query = async (sql: string, params: unknown[]) => {
      const reader = await connection.runAndReadAll(sql, params as never);
      return reader.getRowObjects().map(row => Object.fromEntries(
        Object.entries(row).map(([key, value]) => [key, typeof value === 'bigint' ? Number(value) : value]),
      ));
    };
    const service = new CoachingService(
      { query } as unknown as AnalyticsStoreService,
      { wrap: (_key: string, _ttl: number, load: () => Promise<unknown>) => load() } as CacheService,
    );
    const report = await service.report({ id: 3, role: 'Staff' }, undefined, '7');
    expect(report.summary).toMatchObject({ open: 2, overdue: 1, dueToday: 0, unscheduled: 1, untouched: 1, rnr: 1, calls: 0, messages: 1, whatsapp: 1, email: 0, sms: 0, followUps: 1, wins: 1 });
    expect(report.queue[0]).toMatchObject({ id: 10, reason: 'Overdue' });
    expect(report.targets).toEqual([expect.objectContaining({ ownerId: 3, achieved: 4, target: 10 })]);
    expect(report.trend.find(day => day.day === yesterday)).toMatchObject({ messages: 1, wins: 1 });
  } finally {
    connection.closeSync();
    db.closeSync();
  }
});
