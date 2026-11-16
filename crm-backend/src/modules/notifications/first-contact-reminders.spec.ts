import { FirstContactRemindersService, waitedText } from './first-contact-reminders.service';

// Tuesday 10 Nov 2026; 03:30Z is 9:00 IST.
const lead = (over: Partial<Record<string, unknown>> = {}) => ({
  id: 7, name: 'Suganya', ownerId: 3, owner: 'Yazhini', deptId: 2, assignedAt: new Date('2026-11-10T03:30:00Z'), nudged: 0, ...over,
});

function setup(rows: unknown[]) {
  const notify = jest.fn(async () => ({}));
  const calls: string[] = [];
  const query = jest.fn(async (sql: string) => {
    calls.push(sql);
    if (sql.includes('FROM leads l JOIN users u')) return rows;
    if (sql.startsWith('UPDATE leads')) return { affectedRows: 1 };
    if (sql.includes("r.name = 'Team Lead'")) return [{ id: 9 }];
    if (sql.includes('SELECT COUNT(*)')) return [{ count: 0 }];
    return [];
  });
  const service = new FirstContactRemindersService({ query } as any, { createNotification: notify } as any);
  return { service, notify, query, calls };
}

describe('FirstContactRemindersService', () => {
  it('leaves a lead alone inside its first working hour', async () => {
    const { service, notify } = setup([lead()]);
    await service.run(new Date('2026-11-10T04:15:00Z')); // 45 min
    expect(notify).not.toHaveBeenCalled();
  });

  it('reminds the owner after an hour of working time', async () => {
    const { service, notify, query } = setup([lead()]);
    await service.run(new Date('2026-11-10T04:40:00Z')); // 70 min
    expect(query).toHaveBeenCalledWith(expect.stringContaining('UPDATE leads SET first_contact_nudged'), [1, 7, 0]);
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify.mock.calls[0]).toEqual(expect.arrayContaining([3, 'first_contact_reminder', 7, 'lead']));
  });

  it('tells the team lead after two hours, once the owner was reminded', async () => {
    const { service, notify } = setup([lead({ nudged: 1 })]);
    await service.run(new Date('2026-11-10T05:40:00Z')); // 130 min
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify.mock.calls[0]).toEqual(expect.arrayContaining([9, 'first_contact_escalation', 7, 'lead']));
  });

  it('does not count the night: assigned at 18:00 IST, nothing due by 9:20 next day', async () => {
    const { service, notify } = setup([lead({ assignedAt: new Date('2026-11-10T12:30:00Z') })]);
    await service.run(new Date('2026-11-11T03:50:00Z')); // 30 + 20 = 50 min
    expect(notify).not.toHaveBeenCalled();
  });
});

describe('waitedText', () => {
  it('reads as hours and minutes', () => {
    expect(waitedText(45)).toBe('45 min');
    expect(waitedText(60)).toBe('1 h');
    expect(waitedText(130)).toBe('2 h 10 min');
  });
});
