import { FollowUpRemindersService, REMINDER_SOURCES, formatDueTime, indiaNow } from './follow-up-reminders.service';

describe('FollowUpRemindersService', () => {
  // 08:45 UTC is 14:15 in India.
  const now = new Date('2026-11-05T08:45:00Z');

  function setup(due: Record<string, any[]>) {
    const query = jest.fn(async (sql: string) => {
      if (sql.startsWith('UPDATE')) return [];
      const source = REMINDER_SOURCES.find((s) => sql.includes(`FROM ${s.table}`))!;
      return due[source.entityType] ?? [];
    });
    const createNotification = jest.fn();
    const service = new FollowUpRemindersService({ query } as any, { createNotification } as any);
    return { service, query, createNotification };
  }

  it('reads follow-ups on the India calendar', () => {
    expect(indiaNow(now)).toEqual({ date: '2026-11-05', time: '14:15' });
    expect(formatDueTime('14:30:00')).toBe('2:30 PM');
    expect(formatDueTime('00:05')).toBe('12:05 AM');
  });

  it('asks each module for today\'s due follow-ups up to now', async () => {
    const { service, query } = setup({});
    await service.run(now);
    expect(query).toHaveBeenCalledTimes(REMINDER_SOURCES.length);
    for (const call of query.mock.calls) {
      const [sql, params] = call as unknown as [string, unknown[]];
      expect(sql).toContain('f.rn = 1');
      expect(params.slice(0, 4)).toEqual(['2026-11-05', '2026-11-05', '14:15', '2026-11-05']);
    }
  });

  it('marks the slot and notifies the owner once per due follow-up', async () => {
    const { service, query, createNotification } = setup({
      lead: [{ followUpId: 9, recordId: 12, name: 'Pam Beesly', userId: 4, due: '14:00' }],
      hr: [{ followUpId: 3, recordId: 7, name: 'Jim', userId: null, due: '09:00' }],
    });
    await service.run(now);
    expect(query).toHaveBeenCalledWith('UPDATE lead_follow_ups SET reminded_for = ? WHERE id = ?', ['2026-11-05 14:00', 9]);
    expect(query).toHaveBeenCalledWith('UPDATE hr_follow_ups SET reminded_for = ? WHERE id = ?', ['2026-11-05 09:00', 3]);
    expect(createNotification).toHaveBeenCalledTimes(1);
    expect(createNotification).toHaveBeenCalledWith(4, 'Follow-up due', 'Pam Beesly · Lead · 2:00 PM', 'followup_reminder', 12, 'lead');
  });
});
