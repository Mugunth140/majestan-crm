import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { LeadRoutingService } from './lead-routing.service';
import { NotificationsService } from '../notifications/notifications.service';
import { getDataSourceToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';

jest.mock('bun', () => ({
  S3Client: class {}
}), { virtual: true });

const CLAIM_ROLES = ['Staff', 'Team Lead', 'Manager'];
const ASSIGN_ROLES = ['Team Lead', 'Manager', 'Admin'];

describe('claim/assign role rules', () => {
  let service: LeadRoutingService;
  let managerQueryMock: jest.Mock;
  let dataSourceQueryMock: jest.Mock;
  let saved: any[];
  let emitted: any[];
  /** Open portal repeats on the lead, and its owner before routing. */
  let openRepeats: any[];
  let ownerBefore: number | null;

  beforeEach(async () => {
    saved = [];
    emitted = [];
    openRepeats = [];
    ownerBefore = null;
    managerQueryMock = jest.fn(async (sql: string) => {
      if (/^\s*SELECT assigned_staff_id/.test(sql)) return [{ assigned_staff_id: ownerBefore }];
      if (/^\s*SELECT \* FROM website_enquiry_events/.test(sql)) return openRepeats.map((e) => ({ ...e }));
      return { affectedRows: 1 };
    });
    dataSourceQueryMock = jest.fn().mockResolvedValue({ affectedRows: 1 });

    const leadRow = { id: 7, assigned_staff_id: null, department: 'telecalling' };
    const userRow = { id: 3, name: 'Claimer', department_id: null };

    const repoFor = (entity: any) => {
      const name = entity?.name ?? '';
      return {
        findOne: async () =>
          name === 'Lead' ? { ...leadRow } : name === 'User' ? { ...userRow } : null,
        create: (x: any) => ({ ...x }),
        save: async (x: any) => { saved.push({ entity: name, ...x }); return { ...x }; },
      };
    };

    const qbStub = () => {
      const stub: any = {};
      stub.leftJoin = () => stub;
      stub.andWhere = () => stub;
      stub.where = () => stub;
      stub.getMany = async () => [];
      return stub;
    };

    const manager = {
      query: managerQueryMock,
      getRepository: (e: any) => repoFor(e),
      save: async (x: any) => { saved.push({ ...x }); return { ...x }; },
      createQueryBuilder: () => qbStub(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeadRoutingService,
        {
          provide: getDataSourceToken(),
          useValue: {
            transaction: async (fn: any) => fn(manager),
            query: dataSourceQueryMock,
            getRepository: (e: any) => repoFor(e),
          },
        },
        {
          provide: getDataSourceToken('site'),
          useValue: { query: jest.fn().mockResolvedValue([]) },
        },
        {
          provide: NotificationsService,
          useValue: { createNotification: jest.fn().mockResolvedValue(undefined) },
        },
        { provide: EventEmitter2, useValue: { emit: (name: string, payload: any) => emitted.push({ name, payload }) } },
      ],
    }).compile();

    service = module.get<LeadRoutingService>(LeadRoutingService);
  });

  it.each(CLAIM_ROLES)('claim allows role %s', async (role) => {
    await expect(service.claimLead(7, 3, role)).resolves.toBeDefined();
  });

  it('claim forbids a role outside Staff/Team Lead/Manager', async () => {
    await expect(service.claimLead(7, 3, 'Viewer')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('claim no longer acknowledges website enquiries (event-driven resolution)', async () => {
    await service.claimLead(7, 3, 'Staff');
    const ackCalls = managerQueryMock.mock.calls.filter(([sql]: any[]) =>
      String(sql).includes('acknowledged_at'),
    );
    expect(ackCalls).toHaveLength(0);
  });

  it.each(ASSIGN_ROLES)('assign allows role %s', async (role) => {
    await expect(service.assignLead(7, 5, 3, role)).resolves.toBeDefined();
  });

  it('assign forbids Staff', async () => {
    await expect(service.assignLead(7, 5, 3, 'Staff')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('assign no longer acknowledges website enquiries (event-driven resolution)', async () => {
    await service.assignLead(7, 5, 3, 'Manager');
    const ackCalls = dataSourceQueryMock.mock.calls.filter(([sql]: any[]) =>
      String(sql).includes('acknowledged_at'),
    );
    expect(ackCalls).toHaveLength(0);
  });

  const repeat = { id: 80, matched_lead_id: 7, status: 'open', source: '99Acres', message: '4Bed villa, Saravanampatti', intent: 'enquiry' };

  it('claim takes a portal repeat from its owner and attaches the repeat', async () => {
    openRepeats = [repeat];
    ownerBefore = 9;
    await service.claimLead(7, 3, 'Staff');
    const update = managerQueryMock.mock.calls.find(([sql]) => String(sql).includes('UPDATE leads'));
    expect(update[0]).toContain('assigned_staff_id IS NULL OR EXISTS');
    expect(saved).toEqual(expect.arrayContaining([
      expect.objectContaining({ entity: 'WebsiteEnquiryEvent', id: 80, status: 'attached', resolved_lead_id: 7, decided_by: 3 }),
      expect.objectContaining({ entity: 'LeadInquiry', lead_id: 7, source: null }),
      expect.objectContaining({ entity: 'LeadFollowUp', lead_id: 7, notes: '4Bed villa, Saravanampatti' }),
      expect.objectContaining({ event_type: 'Claimed', from_user_id: 9, to_user_id: 3 }),
    ]));
    expect(emitted).toEqual([expect.objectContaining({ payload: expect.objectContaining({ changes: [{ id: 7, from: 9, to: 3 }] }) })]);
  });

  it('claim of a new lead tells no previous owner', async () => {
    await service.claimLead(7, 3, 'Staff');
    expect(emitted).toHaveLength(0);
    expect(saved.filter((x) => x.entity === 'WebsiteEnquiryEvent')).toHaveLength(0);
  });

  it('assign attaches the lead\'s open portal repeats', async () => {
    openRepeats = [repeat];
    await service.assignLead(7, 5, 3, 'Manager');
    expect(saved).toEqual(expect.arrayContaining([
      expect.objectContaining({ entity: 'Lead', assigned_staff_id: 5 }),
      expect.objectContaining({ entity: 'WebsiteEnquiryEvent', id: 80, status: 'attached', decided_by: 3 }),
    ]));
  });
});
