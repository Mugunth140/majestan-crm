import { Test, TestingModule } from '@nestjs/testing';
import { LeadsService } from './leads.service';
import { Lead } from '../../database/entities/lead.entity';
import { LeadFollowUp } from '../../database/entities/lead-follow-up.entity';
import { LeadInquiry } from '../../database/entities/lead-inquiry.entity';
import { User } from '../../database/entities/user.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { TasksService } from '../tasks/tasks.service';
import { getDataSourceToken } from '@nestjs/typeorm';

jest.mock('bun', () => ({
  S3Client: class {}
}), { virtual: true });

describe('LeadsService.bulkCreateLeads assign-on-insert', () => {
  let service: LeadsService;
  let savedLeads: any[];
  let leadSeq: number;
  let findUsersImpl: jest.Mock;
  let existingLeadsImpl: jest.Mock;

  beforeEach(async () => {
    savedLeads = [];
    leadSeq = 0;
    findUsersImpl = jest.fn(async () => []);
    existingLeadsImpl = jest.fn(async () => []);

    const leadRepo = {
      createQueryBuilder: () => ({
        where: () => ({ getMany: existingLeadsImpl }),
      }),
      create: (obj: any) => ({ ...obj }),
    };
    const userRepo = { find: findUsersImpl };
    const inquiryRepo = { create: (obj: any) => ({ ...obj }) };
    const followUpRepo = { create: (obj: any) => ({ ...obj }) };
    const manager = {
      getRepository: (entity: any) => {
        if (entity === Lead) return leadRepo;
        if (entity === User) return userRepo;
        if (entity === LeadInquiry) return inquiryRepo;
        if (entity === LeadFollowUp) return followUpRepo;
        throw new Error('unexpected repository');
      },
      save: jest.fn(async (entity: any, entities?: any) => {
        const list = Array.isArray(entities) ? entities : [entities];
        if (entity === Lead) {
          const saved = list.map((e) => ({ ...e, id: ++leadSeq }));
          savedLeads.push(...saved);
          return saved;
        }
        return list;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeadsService,
        {
          provide: getDataSourceToken(),
          useValue: { transaction: jest.fn(async (cb: any) => cb(manager)) },
        },
        {
          provide: getDataSourceToken('site'),
          useValue: {},
        },
        {
          provide: NotificationsService,
          useValue: {},
        },
        {
          provide: TasksService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<LeadsService>(LeadsService);
  });

  it('assigns a new lead to sales staff with the sales pipeline', async () => {
    findUsersImpl.mockResolvedValueOnce([{ id: 5, department: { name: 'Sales' } }]);

    const result = await service.bulkCreateLeads([
      { name: 'Direct Buyer', mobile: '9876543210', source: 'Website', assignedStaffId: 5 },
    ]);

    expect(savedLeads).toHaveLength(1);
    expect(savedLeads[0].assigned_staff_id).toBe(5);
    expect(savedLeads[0].department).toBe('sales');
    expect(result).toMatchObject({ created: 1, assigned: 1 });
  });

  it('keeps telecalling staff in the telecalling pipeline', async () => {
    findUsersImpl.mockResolvedValueOnce([{ id: 6, department: { name: 'Telecalling' } }]);

    await service.bulkCreateLeads([
      { name: 'Tele Buyer', mobile: '9876543211', source: 'Website', assignedStaffId: 6 },
    ]);

    expect(savedLeads[0].assigned_staff_id).toBe(6);
    expect(savedLeads[0].department).toBe('telecalling');
  });

  it('ignores unknown staff ids (row falls back to the routing queue)', async () => {
    findUsersImpl.mockResolvedValueOnce([]);

    const result = await service.bulkCreateLeads([
      { name: 'Queue Buyer', mobile: '9876543212', source: 'Website', assignedStaffId: 999 },
    ]);

    expect(savedLeads[0].assigned_staff_id).toBeNull();
    expect(savedLeads[0].department).toBe('telecalling');
    expect(result).toMatchObject({ created: 1, assigned: 0 });
  });

  it('ignores the assignee on duplicate rows (merge-only)', async () => {    findUsersImpl.mockResolvedValueOnce([{ id: 5, department: { name: 'Sales' } }]);
    existingLeadsImpl.mockResolvedValueOnce([
      { id: 40, mobile_number: '9876543213', assigned_staff_id: null },
    ]);

    const result = await service.bulkCreateLeads([
      { name: 'Dupe Buyer', mobile: '9876543213', source: 'Website', assignedStaffId: 5 },
    ]);

    expect(savedLeads).toHaveLength(0);
    expect(result).toMatchObject({ created: 0, existing: 1, assigned: 0 });
  });

  it('strips pre-assignment for Staff callers (cannot skip the routing queue)', async () => {
    const result = await service.bulkCreateLeads(
      [{ name: 'Staff Buyer', mobile: '9876543201', source: 'Website', assignedStaffId: 5 }],
      { role: 'Staff' },
    );

    expect(findUsersImpl).not.toHaveBeenCalled();
    expect(savedLeads).toHaveLength(1);
    expect(savedLeads[0].assigned_staff_id).toBeNull();
    expect(savedLeads[0].department).toBe('telecalling');
    expect(result).toMatchObject({ created: 1, assigned: 0 });
  });

  it('ignores staff with no department link (row falls back to the queue)', async () => {
    findUsersImpl.mockResolvedValueOnce([{ id: 8, department: null }]);

    const result = await service.bulkCreateLeads(
      [{ name: 'NoDept Buyer', mobile: '9876543202', source: 'Website', assignedStaffId: 8 }],
      { role: 'Admin' },
    );

    expect(savedLeads[0].assigned_staff_id).toBeNull();
    expect(savedLeads[0].department).toBe('telecalling');
    expect(result).toMatchObject({ created: 1, assigned: 0 });
  });
});
