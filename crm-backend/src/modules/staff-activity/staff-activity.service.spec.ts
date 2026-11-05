import { StaffActivityService } from './staff-activity.service';

// The service runs one query per source; this fake answers by table name.
function service(rows: Record<string, any[]>) {
  const calls: { sql: string; params: unknown[] }[] = [];
  const ds = {
    query: jest.fn(async (sql: string, params: unknown[]) => {
      calls.push({ sql, params });
      const table = Object.keys(rows).find((t) => new RegExp(`FROM ${t}\\b`).test(sql));
      return table ? rows[table] : [];
    }),
  };
  return { svc: new StaffActivityService(ds as any), calls };
}

describe('StaffActivityService.list', () => {
  it('merges changes and conversation from every module, newest first', async () => {
    const { svc } = service({
      lead_events: [{ id: 1, record_id: 12, record_name: 'Pam', type: 'status_changed', field: 'status', from_value: 'New', to_value: 'Hot', meta: null, created_at: new Date('2026-11-05T10:00:00Z') }],
      record_events: [{ id: 2, entity: 'agent', record_id: 3, record_name: 'Neha', type: 'created', field: null, from_value: null, to_value: 'New', meta: '{"x":1}', created_at: new Date('2026-11-05T09:00:00Z') }],
      contact_logs: [{ id: 3, record_id: 12, record_name: 'Pam', contact_type: 'call', subject: null, message: null, call_duration: 65, call_direction: 'outgoing', created_at: new Date('2026-11-05T11:00:00Z') }],
      inbound_follow_ups: [{ id: 4, record_id: 18, record_name: 'Shop', contacted_via: 'call', notes: 'Owner away', next_follow_up_date: '2026-11-07', next_follow_up_time: '10:30:00', created_at: new Date('2026-11-05T08:00:00Z') }],
    });
    const { items, next } = await svc.list({ userId: 7 });
    expect(items.map((i) => i.id)).toEqual(['lead-cl3', 'le1', 're2', 'inbound-fu4']);
    expect(items[0]).toMatchObject({ group: 'conversation', source: 'lead', kind: 'contact_log', field: 'call', meta: { duration: 65 } });
    expect(items[2]).toMatchObject({ source: 'agent', record: { id: 3, name: 'Neha' }, meta: { x: 1 } });
    expect(items[3].meta).toMatchObject({ notes: 'Owner away', next: '2026-11-07 10:30' });
    expect(next).toBeNull();
  });

  it('only asks the sources a group needs, for that person and window', async () => {
    const { svc, calls } = service({});
    await svc.list({ userId: 7, group: 'activity', before: new Date('2026-11-05T00:00:00Z'), limit: 10 });
    expect(calls.every((c) => !/follow_ups|contact_logs/.test(c.sql))).toBe(true);
    expect(calls.length).toBe(3);
    expect(calls[0].params).toEqual([7, expect.any(Date), new Date('2026-11-05T00:00:00Z'), 10]);
  });

  it('offers a next page when a source filled its page', async () => {
    const at = new Date('2026-11-05T10:00:00Z');
    const { svc } = service({ lead_events: [{ id: 1, record_id: 1, type: 'created', created_at: at }] });
    const { next } = await svc.list({ userId: 7, limit: 1 });
    expect(next).toBe(at.toISOString());
  });

  it('needs a staff member', async () => {
    await expect(service({}).svc.list({ userId: NaN })).rejects.toThrow('Pick a staff member');
  });
});
