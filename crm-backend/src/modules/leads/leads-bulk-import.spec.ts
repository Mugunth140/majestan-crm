import { Test, TestingModule } from '@nestjs/testing';
import { LeadsService } from './leads.service';
import { Lead } from '../../database/entities/lead.entity';
import { LeadFollowUp } from '../../database/entities/lead-follow-up.entity';
import { LeadInquiry } from '../../database/entities/lead-inquiry.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { TasksService } from '../tasks/tasks.service';
import { getDataSourceToken } from '@nestjs/typeorm';

jest.mock('bun', () => ({
  S3Client: class {}
}), { virtual: true });

describe('LeadsService.bulkCreateLeads remarks', () => {
  let service: LeadsService;
  let savedLeads: any[];
  let savedFollowUps: any[];
  let leadSeq: number;

  beforeEach(async () => {
    savedLeads = [];
    savedFollowUps = [];
    leadSeq = 0;

    const leadRepo = {
      createQueryBuilder: () => ({ where: () => ({ getMany: async () => [] }) }),
      create: (obj: any) => ({ ...obj }),
    };
    const inquiryRepo = { create: (obj: any) => ({ ...obj }) };
    const followUpRepo = { create: (obj: any) => ({ ...obj }) };
    const manager = {
      getRepository: (entity: any) => {
        if (entity === Lead) return leadRepo;
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
        if (entity === LeadFollowUp) {
          savedFollowUps.push(...list);
          return list;
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

  it('creates a follow-up note from the bulk upload remark', async () => {
    await service.bulkCreateLeads([
      { name: 'Bulk Buyer', mobile: '9876543210', email: 'b@example.com', source: 'Website', commissionRemarks: 'Looking for 3BHK' },
    ]);

    expect(savedFollowUps).toHaveLength(1);
    expect(savedFollowUps[0].lead_id).toBe(1);
    expect(savedFollowUps[0].notes).toBe('Looking for 3BHK');
    expect(savedFollowUps[0].follow_up_date).toBeNull();
  });

  it('does not store the bulk remark in commission_remarks', async () => {
    await service.bulkCreateLeads([
      { name: 'Bulk Buyer', mobile: '9876543210', email: 'b@example.com', source: 'Website', commissionRemarks: 'Looking for 3BHK' },
    ]);

    expect(savedLeads).toHaveLength(1);
    expect(savedLeads[0].commission_remarks ?? null).toBeNull();
  });

  it('creates no follow-up when the bulk row has no remark', async () => {
    await service.bulkCreateLeads([
      { name: 'Plain Buyer', mobile: '9876543211', email: 'p@example.com', source: 'Website' },
    ]);

    expect(savedFollowUps).toHaveLength(0);
  });
});
