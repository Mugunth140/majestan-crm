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

  beforeEach(async () => {
    andWhereMock = jest.fn();
    const qb: any = {
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
          useValue: { getRepository: jest.fn().mockReturnValue({ createQueryBuilder: jest.fn().mockReturnValue(qb) }) },
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
});
