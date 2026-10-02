import { Test, TestingModule } from '@nestjs/testing';
import { LeadRoutingService } from './lead-routing.service';
import { NotificationsService } from '../notifications/notifications.service';
import { getDataSourceToken } from '@nestjs/typeorm';

jest.mock('bun', () => ({
  S3Client: class {}
}), { virtual: true });

describe('LeadRoutingService enquiry queue', () => {
  let service: LeadRoutingService;
  let queryMock: jest.Mock;

  beforeEach(async () => {
    queryMock = jest.fn().mockResolvedValue([]);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeadRoutingService,
        {
          provide: getDataSourceToken(),
          useValue: { query: queryMock, getRepository: jest.fn() },
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

  it('orders by latest website enquiry first', async () => {
    queryMock
      .mockResolvedValueOnce([{ total: 2 }])
      .mockResolvedValueOnce([
        { id: 9, repeat_count: '3', last_enquiry_at: '2026-10-02 10:00:00' },
        { id: 7, repeat_count: '1', last_enquiry_at: '2026-10-01 10:00:00' },
      ]);
    const result = await service.getEnquiryQueue(1, 10);
    expect(result.items[0].id).toBe(9);
    expect(result.total).toBe(2);
    const [sql] = queryMock.mock.calls[1];
    expect(sql).toContain("i.source = 'website'");
    expect(sql).toContain('acknowledged_at IS NULL');
    expect(sql).toContain('ORDER BY last_enquiry_at DESC');
    // repeat_count must count ALL website enquiries (acknowledged or not),
    // while membership (the JOIN) sees only unacknowledged rows.
    expect(sql).toContain('ia.source = \'website\') AS repeat_count');
  });

  it('marks a single-website-enquiry new lead as New, everything else as Repeat', async () => {
    queryMock
      .mockResolvedValueOnce([{ total: 2 }])
      .mockResolvedValueOnce([
        { id: 7, repeat_count: '1', has_new_lead_flag: 1 },
        { id: 8, repeat_count: '1', has_new_lead_flag: 0 },
      ]);
    const result = await service.getEnquiryQueue(1, 10);
    const byId = Object.fromEntries(result.items.map((i: any) => [i.id, i.type]));
    expect(byId[7]).toBe('New');
    expect(byId[8]).toBe('Repeat');
  });
});
