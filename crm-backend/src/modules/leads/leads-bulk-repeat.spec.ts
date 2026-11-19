import { LeadsService } from './leads.service';
import { Lead } from '../../database/entities/lead.entity';
import { LeadFollowUp } from '../../database/entities/lead-follow-up.entity';
import { LeadInquiry } from '../../database/entities/lead-inquiry.entity';
import { LeadSource } from '../../database/entities/lead-source.entity';
import {
  NOTIFY_ASSIGNED,
  NOTIFY_LEAD_REPEAT,
  NOTIFY_QUEUE,
} from '../notifications/notify-events';

jest.mock('bun', () => ({ S3Client: class {} }), { virtual: true });

describe('LeadsService.bulkCreateLeads announcements', () => {
  function setup() {
    let seq = 100;
    // 9884012345 is already L04488, owned by Yazhini (3).
    const existing = [
      { id: 4488, mobile_number: '9884012345', assigned_staff_id: 3 },
    ];
    const manager: any = {
      getRepository: (entity: any) => {
        if (entity === Lead)
          return {
            createQueryBuilder: () => ({
              where: () => ({ getMany: async () => existing }),
            }),
            create: (obj: any) => ({ ...obj }),
          };
        if (entity === LeadInquiry || entity === LeadFollowUp)
          return { create: (obj: any) => ({ ...obj }) };
        // Assignee lookup: Abarna (4) is in Telecalling.
        return {
          find: async () => [
            { id: 4, department: { name: 'Telecalling Department' } },
          ],
        };
      },
      save: jest.fn(async (entity: any, list: any) =>
        entity === Lead ? list.map((l: any) => ({ ...l, id: ++seq })) : list,
      ),
    };
    const dataSource: any = {
      transaction: async (cb: any) => cb(manager),
      getRepository: (entity: any) => {
        if (entity !== LeadSource) throw new Error('unexpected repository');
        return { find: async () => [] };
      },
    };
    const events = { emit: jest.fn(), emitAsync: jest.fn() };
    const leadEvents = { record: jest.fn() };
    const service = new LeadsService(
      dataSource,
      {} as any,
      {} as any,
      events as any,
      leadEvents as any,
    );
    return { service, events, leadEvents };
  }

  it('records repeats on the existing lead and announces repeats, assignments and queued leads', async () => {
    const { service, events, leadEvents } = setup();
    const result = await service.bulkCreateLeads(
      [
        {
          name: 'Suganya',
          mobile: '+91 98840 12345',
          source: 'Olx',
          commissionRemarks: 'Called again',
        },
        { name: 'New one', mobile: '9000000001', assignedStaffId: 4 },
        { name: 'Queue one', mobile: '9000000002' },
      ],
      { id: 1, role: 'Team Lead' },
    );

    expect(result).toEqual({ count: 2, created: 2, existing: 1, assigned: 1 });
    expect(leadEvents.record).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          leadId: 4488,
          actorId: 1,
          type: 'repeat_enquiry',
          to: 'Olx',
          meta: expect.objectContaining({
            via: 'import',
            remarks: 'Called again',
          }),
        }),
      ],
      expect.anything(),
    );
    expect(events.emit).toHaveBeenCalledWith(
      NOTIFY_LEAD_REPEAT,
      expect.objectContaining({
        via: 'import',
        actorId: 1,
        leads: [{ id: 4488, ownerId: 3 }],
      }),
    );
    expect(events.emit).toHaveBeenCalledWith(
      NOTIFY_ASSIGNED,
      expect.objectContaining({
        module: 'lead',
        changes: [{ id: 101, from: null, to: 4 }],
      }),
    );
    expect(events.emit).toHaveBeenCalledWith(
      NOTIFY_QUEUE,
      expect.objectContaining({ leadIds: [102] }),
    );
  });

  it('marks a repeat from a portal push as a new enquiry, not an Excel import', async () => {
    const { service, events, leadEvents } = setup();
    await service.bulkCreateLeads(
      [{ name: 'Suganya', mobile: '9884012345', source: '99Acres', commissionRemarks: 'Portal enquiry' }],
      { role: 'Staff' },
    );
    expect(leadEvents.record).toHaveBeenCalledWith(
      [expect.objectContaining({ leadId: 4488, actorId: null, to: '99Acres', meta: expect.objectContaining({ via: 'entry' }) })],
      expect.anything(),
    );
    expect(events.emit).toHaveBeenCalledWith(NOTIFY_LEAD_REPEAT, expect.objectContaining({ via: 'entry', source: '99Acres' }));
  });
});
