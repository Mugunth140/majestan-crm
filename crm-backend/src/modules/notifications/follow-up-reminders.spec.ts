import { FollowUpRemindersService, REMINDER_SOURCES, formatDueTime, indiaNow } from './follow-up-reminders.service';

describe('FollowUpRemindersService', () => {
  // 08:45 UTC is 14:15 in India.
  const now = new Date('2026-11-05T08:45:00Z');

  function setup(due: Record<string, any[]>, late: Record<string, any[]> = {}, teamLeads: any[] = []) {
    const query = jest.fn(async (sql: string) => {
      if (sql.startsWith('UPDATE')) return [];
      if (sql.includes('FROM users u')) return teamLeads;
      const source = REMINDER_SOURCES.find((s) => sql.includes(`FROM ${s.table}`))!;
      const rows = sql.includes('escalated_for') ? late : due;
      return rows[source.entityType] ?? [];
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
    const reminders = query.mock.calls.filter(([sql]) => !String(sql).includes('escalated_for'));
    expect(reminders).toHaveLength(REMINDER_SOURCES.length);
    for (const call of reminders) {
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
  it('tells the team lead about a follow-up still not done an hour of working time after it was due', async () => {
    const { service, query, createNotification } = setup({}, {
      lead: [
        { followUpId: 9, recordId: 4488, name: 'Pam', userId: 4, owner: 'Yazhini', due: '13:00' },
        { followUpId: 10, recordId: 4487, name: 'Jim', userId: 4, owner: 'Yazhini', due: '13:45' },
      ],
    }, [{ userId: 4, tlId: 2 }]);
    await service.run(now);
    // 13:00 was 75 working minutes ago at 14:15; 13:45 only 30.
    expect(createNotification).toHaveBeenCalledWith(
      2, 'Follow-up missed', "Yazhini hasn't followed up on L04488, due at 1:00 PM.", 'followup_missed', 4488, 'lead',
    );
    expect(createNotification).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('SET escalated_for = reminded_for'), [9]);
  });

  it('only escalates follow-ups with no call or message logged since they were due', async () => {
    const { service, query } = setup({});
    await service.run(now);
    const escalations = query.mock.calls.filter(([sql]) => String(sql).includes('escalated_for'));
    expect(escalations).toHaveLength(REMINDER_SOURCES.length);
    for (const [sql] of escalations) {
      expect(sql).toContain('NOT EXISTS');
      expect(sql).toContain('c.sent_by_id IS NOT NULL');
    }
  });
});
