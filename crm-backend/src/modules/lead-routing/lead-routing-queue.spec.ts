import { Test, TestingModule } from '@nestjs/testing';
import { LeadRoutingService } from './lead-routing.service';
import { NotificationsService } from '../notifications/notifications.service';
import { getDataSourceToken } from '@nestjs/typeorm';

jest.mock('bun', () => ({
  S3Client: class {}
}), { virtual: true });

describe('LeadRoutingService queue', () => {
  let service: LeadRoutingService;
  let andWhereMock: jest.Mock;
  let qb: any;
  let queryMock: jest.Mock;

  beforeEach(async () => {
    andWhereMock = jest.fn();
    queryMock = jest.fn().mockResolvedValue([]);
    qb = {
      where: jest.fn().mockReturnThis(),
      andWhere: andWhereMock.mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      getMany: jest.fn().mockResolvedValue([]),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeadRoutingService,
        {
          provide: getDataSourceToken(),
          useValue: { getRepository: jest.fn().mockReturnValue({ createQueryBuilder: jest.fn().mockReturnValue(qb) }), query: queryMock },
        },
        {
          provide: getDataSourceToken('site'),
          useValue: { query: jest.fn().mockResolvedValue([]) },
        },
        {
          provide: NotificationsService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<LeadRoutingService>(LeadRoutingService);
  });

  it('excludes Not Interested and Dropped leads from the routing queue', async () => {
    await service.getQueue('telecalling', 1, 10);

    const statusClause = andWhereMock.mock.calls.find(([clause]) =>
      String(clause).includes('lead.status NOT IN'),
    );
    expect(statusClause).toBeDefined();
    expect(statusClause[1]).toMatchObject({
      excluded: expect.arrayContaining(['Not Interested', 'Dropped']),
    });
  });

  it('excludes leads with open website enquiry events from the routing queue', async () => {
    await service.getQueue('telecalling', 1, 10);

    const eventClause = andWhereMock.mock.calls.find(([clause]) =>
      String(clause).includes('NOT EXISTS') &&
      String(clause).includes('website_enquiry_events') &&
      String(clause).includes("status = 'open'"),
    );
    expect(eventClause).toBeDefined();
  });

  it('no longer excludes the routing queue by lead_source', async () => {
    await service.getQueue('telecalling', 1, 10);

    const sourceClause = andWhereMock.mock.calls.find(([clause]) =>
      String(clause).includes('lead.lead_source'),
    );
    expect(sourceClause).toBeUndefined();
  });

  it('lists portal and import repeats even when the lead has an owner', async () => {
    await service.getQueue('telecalling', 1, 10);
    const where = qb.where.mock.calls.map(([c]: any[]) => String(c));
    expect(where).not.toContain('lead.assigned_staff_id IS NULL');
    const clause = andWhereMock.mock.calls.map(([c]: any[]) => String(c)).find((c: string) => c.includes('OR EXISTS'));
    expect(clause).toContain('lead.assigned_staff_id IS NULL');
    expect(clause).toContain("r.source NOT LIKE 'Website%'");
  });

  it('marks a lead with an open portal repeat as Repeat, with its current owner', async () => {
    qb.getManyAndCount.mockResolvedValue([[
      { id: 4605, assigned_staff_id: 9, created_at: new Date('2026-11-19T04:25:00Z') },
      { id: 4629, assigned_staff_id: null, created_at: new Date('2026-11-19T07:03:00Z') },
    ], 2]);
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM website_enquiry_events r')) {
        return [{ id: 80, matched_lead_id: 4605, created_at: new Date('2026-11-19T06:48:24Z'), source: '99Acres', message: '4Bed villa' }];
      }
      if (sql.includes('FROM users')) return [{ id: 9, name: 'Abarna' }];
      return [];
    });
    const { items } = await service.getQueue('telecalling', 1, 10);
    expect(items[0]).toMatchObject({ id: 4605, type: 'Repeat', repeat_event_ids: [80], repeat_source: '99Acres', current_owner_name: 'Abarna' });
    expect(items[1]).toMatchObject({ id: 4629, type: 'New', repeat_event_ids: [], current_owner_name: null });
  });
});
