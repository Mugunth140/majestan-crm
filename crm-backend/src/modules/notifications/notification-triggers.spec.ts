import { NotificationTriggersListener } from './notification-triggers.listener';
import { audience, leadRef, leadRefs } from './recipients';
import { behindToday } from '../tasks/pace-alerts.service';
import { TeamDigestsService } from './team-digests.service';

describe('recipients', () => {
  it('names leads by their ID', () => {
    expect(leadRef(4488)).toBe('L04488');
    expect(leadRefs([1])).toBe('L00001');
    expect(leadRefs([1, 2])).toBe('L00001 and L00002');
    expect(leadRefs([1, 2, 3, 4, 5, 6, 7])).toBe(
      'L00001, L00002, L00003, L00004, L00005 and 2 more',
    );
  });

  it('tells each person once, never the one who did it', () => {
    expect(audience([3, 4, 3, null, 5], [5])).toEqual([3, 4]);
  });
});

describe('NotificationTriggersListener', () => {
  /** `tls`: team-lead rows ({ userId, tlId }); `users`: names by id. */
  function setup({
    tls = [] as any[],
    users = {} as Record<number, string>,
    deptLeads = [] as any[],
    bosses = [] as any[],
    lead = null as any,
  } = {}) {
    const query = jest.fn(async (sql: string, params?: any[]) => {
      if (sql.includes('JOIN users tl')) return tls;
      if (sql.includes('JOIN departments d')) return deptLeads;
      if (sql.includes('r.name IN (?)')) return bosses;
      if (sql.startsWith('SELECT id, name FROM users'))
        return (params![0] as number[]).map((id) => ({ id, name: users[id] }));
      if (sql.includes('FROM hr_candidates'))
        return (params![0] as number[]).map((id) => ({
          id,
          name: `Candidate${id}`,
        }));
      if (sql.includes('FROM leads l')) return lead ? [lead] : [];
      return [];
    });
    const createNotification = jest.fn(async () => undefined);
    const listener = new NotificationTriggersListener(
      { query } as any,
      { createNotification } as any,
    );
    return { listener, createNotification };
  }

  it('sends one message per new owner for a bulk assignment, and tells the previous owner', async () => {
    const { listener, createNotification } = setup({
      users: { 3: 'Yazhini', 4: 'Abarna' },
    });
    await listener.onAssigned({
      module: 'lead',
      actorId: 1,
      changes: [
        { id: 10, from: null, to: 3 },
        { id: 11, from: 4, to: 3 },
        { id: 12, from: null, to: 3 },
      ],
    });
    expect(createNotification).toHaveBeenCalledWith(
      3,
      '3 assigned to you',
      '3 leads were assigned to you: L00010, L00011 and L00012.',
      'record_assigned',
      undefined,
      'lead',
    );
    expect(createNotification).toHaveBeenCalledWith(
      4,
      'Reassigned',
      'L00011 was moved to Yazhini.',
      'record_reassigned',
      11,
      'lead',
    );
    expect(createNotification).toHaveBeenCalledTimes(2);
  });

  it('skips whoever made the change, and the new owner when routing already told them', async () => {
    const { listener, createNotification } = setup();
    await listener.onAssigned({
      module: 'lead',
      actorId: 3,
      changes: [{ id: 10, from: null, to: 3 }],
    });
    await listener.onAssigned({
      module: 'lead',
      actorId: 1,
      newOwnerTold: true,
      changes: [{ id: 10, from: null, to: 3 }],
    });
    expect(createNotification).not.toHaveBeenCalled();
  });

  it('names other records by type and name', async () => {
    const { listener, createNotification } = setup();
    await listener.onAssigned({
      module: 'hr',
      actorId: 1,
      changes: [{ id: 7, from: null, to: 3 }],
    });
    expect(createNotification).toHaveBeenCalledWith(
      3,
      'Assigned to you',
      'Candidate Candidate7 was assigned to you.',
      'record_assigned',
      7,
      'hr',
    );
  });

  it('tells owners and their team leads about repeat leads in an import, once each', async () => {
    const { listener, createNotification } = setup({
      users: { 3: 'Yazhini', 4: 'Abarna' },
      tls: [
        { userId: 3, tlId: 2 },
        { userId: 4, tlId: 2 },
      ],
    });
    await listener.onRepeat({
      via: 'import',
      actorId: 1,
      leads: [
        { id: 10, ownerId: 3 },
        { id: 11, ownerId: 3 },
        { id: 12, ownerId: 4 },
        { id: 13, ownerId: null },
      ],
    });
    expect(createNotification).toHaveBeenCalledWith(
      3,
      'Repeat lead',
      '2 of your leads came in again in an Excel import: L00010 and L00011.',
      'lead_repeat',
      undefined,
      'lead',
    );
    expect(createNotification).toHaveBeenCalledWith(
      4,
      'Repeat lead',
      "L00012 came in again in an Excel import. It's still yours.",
      'lead_repeat',
      12,
      'lead',
    );
    expect(createNotification).toHaveBeenCalledWith(
      2,
      'Repeat lead',
      "3 of your team's leads came in again in an Excel import: L00010 (Yazhini), L00011 (Yazhini), L00012 (Abarna).",
      'lead_repeat_team',
      undefined,
      'lead',
    );
    expect(createNotification).toHaveBeenCalledTimes(3);
  });

  it('tells the telecalling team leads what is waiting in the routing queue', async () => {
    const { listener, createNotification } = setup({
      deptLeads: [{ id: 2 }, { id: 5 }],
    });
    await listener.onQueue({
      leadIds: [20, 21],
      source: '99acres',
      actorId: 5,
    });
    expect(createNotification).toHaveBeenCalledWith(
      2,
      'New in the routing queue',
      '2 new leads from 99acres are waiting in the routing queue: L00020 and L00021.',
      'queue_new',
      undefined,
      undefined,
    );
    expect(createNotification).toHaveBeenCalledTimes(1);
  });

  it('tells people their targets were set', async () => {
    const { listener, createNotification } = setup();
    await listener.onTargets({
      userIds: [3, 1],
      month: '2026-12',
      changed: false,
      actorId: 1,
    });
    expect(createNotification).toHaveBeenCalledWith(
      3,
      'New targets',
      'Your targets for December 2026 are set. Open Tasks to see them.',
      'targets_set',
      undefined,
      undefined,
    );
    expect(createNotification).toHaveBeenCalledTimes(1);
  });

  it('announces a booking to the owner, their team lead and admins, not to whoever set it', async () => {
    const { listener, createNotification } = setup({
      lead: { ownerId: 3, owner: 'Yazhini' },
      tls: [{ userId: 3, tlId: 2 }],
      bosses: [{ id: 1 }, { id: 9 }],
    });
    await listener.onStatusChanged({
      entityId: 4488,
      actorId: 3,
      from: 'Negotiation',
      to: 'Booking Advance',
    });
    const told = createNotification.mock.calls.map((c: any[]) => c[0]).sort();
    expect(told).toEqual([1, 2, 9]);
    expect(createNotification).toHaveBeenCalledWith(
      1,
      'Booking Advance',
      'L04488 reached Booking Advance (Yazhini).',
      'lead_milestone',
      4488,
      'lead',
    );
  });

  it('stays quiet for everyday status changes', async () => {
    const { listener, createNotification } = setup({ lead: { ownerId: 3 } });
    await listener.onStatusChanged({
      entityId: 1,
      actorId: 3,
      from: 'New Lead',
      to: 'Contacted',
    });
    expect(createNotification).not.toHaveBeenCalled();
  });
});

describe('behindToday', () => {
  const calls = { label: 'Calls', goal: 120, achieved: 20 };
  it('flags targets in the red band for the time of day', () => {
    // At 15:00, 6 of 9.5 working hours have gone: 120 calls → about 76 expected; 20 is 26%.
    expect(behindToday([calls], 15 * 60)).toEqual([calls]);
    expect(behindToday([{ ...calls, achieved: 40 }], 15 * 60)).toEqual([]);
  });
  it('ignores met goals and the time before work starts', () => {
    expect(behindToday([{ ...calls, achieved: 120 }], 15 * 60)).toEqual([]);
    expect(behindToday([calls], 8 * 60)).toEqual([]);
  });
});

describe('TeamDigestsService', () => {
  // 13:30 UTC is 19:00 in India, a Tuesday.
  const evening = new Date('2026-11-17T13:30:00Z');

  it('sends each team lead one summary of the leads their team lost today', async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('FROM lead_events'))
        return [
          { leadId: 10, personId: 3, person: 'Yazhini' },
          { leadId: 11, personId: 3, person: 'Yazhini' },
          { leadId: 12, personId: 4, person: 'Abarna' },
        ];
      if (sql.includes('JOIN users tl'))
        return [
          { userId: 3, tlId: 2 },
          { userId: 4, tlId: 2 },
        ];
      return [];
    });
    const createNotification = jest.fn();
    const service = new TeamDigestsService(
      { query } as any,
      { createNotification, pruneOld: jest.fn(async () => 0) } as any,
    );
    await service.lostLeads(evening);
    expect(createNotification).toHaveBeenCalledWith(
      2,
      'Leads lost today',
      'Your team closed 3 leads as Not Interested, Lost or Dropped today (Yazhini 2, Abarna 1): L00010, L00011 and L00012.',
      'lost_leads_digest',
    );
  });

  it('waits for the end of the working day', async () => {
    const query = jest.fn();
    const service = new TeamDigestsService(
      { query } as any,
      { createNotification: jest.fn() } as any,
    );
    await service.lostLeads(new Date('2026-11-17T09:00:00Z'));
    expect(query).not.toHaveBeenCalled();
  });
});
