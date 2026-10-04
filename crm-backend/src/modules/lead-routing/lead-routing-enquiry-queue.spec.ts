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

  it('marks unassigned website-born leads as New, everything else as Repeat', async () => {
    queryMock
      .mockResolvedValueOnce([{ total: 3 }])
      .mockResolvedValueOnce([
        { id: 7, repeat_count: '1', first_is_new_lead: 1, assigned_staff_id: null },
        { id: 8, repeat_count: '1', first_is_new_lead: 0, assigned_staff_id: null },
        { id: 9, repeat_count: '2', first_is_new_lead: 1, assigned_staff_id: 3 },
      ]);
    const result = await service.getEnquiryQueue(1, 10);
    const byId = Object.fromEntries(result.items.map((i: any) => [i.id, i.type]));
    expect(byId[7]).toBe('New');
    expect(byId[8]).toBe('Repeat');
    expect(byId[9]).toBe('Repeat');
  });

  it('marks a first-time visit (enquiry + visit rows) as New, not Repeat', async () => {
    queryMock
      .mockResolvedValueOnce([{ total: 1 }])
      .mockResolvedValueOnce([
        { id: 7, repeat_count: '2', first_is_new_lead: 1, assigned_staff_id: null },
      ]);
    const result = await service.getEnquiryQueue(1, 10);
    expect(result.items[0].type).toBe('New');
    expect(result.items[0].repeat_count).toBe(2);
  });

  it('applies propertyType/intent/date filters to the latest open enquiry', async () => {
    queryMock
      .mockResolvedValueOnce([{ total: 1 }])
      .mockResolvedValueOnce([
        { id: 7, repeat_count: '2', first_is_new_lead: 1 },
      ]);
    await service.getEnquiryQueue(1, 10, {
      propertyType: 'villa',
      intent: 'site_visit',
      dateFrom: '2026-10-01',
      dateTo: '2026-10-04',
    });
    const [, params] = queryMock.mock.calls[0];
    const [sql, rowsParams] = queryMock.mock.calls[1];
    expect(sql).toContain('lw.property_type = ?');
    expect(sql).toContain('lw.intent = ?');
    expect(sql).toContain('DATE(lw.created_at) >= ?');
    expect(sql).toContain('DATE(lw.created_at) <= ?');
    expect(rowsParams).toEqual(['villa', 'site_visit', '2026-10-01', '2026-10-04', 10, 0]);
    expect(params).toEqual(['villa', 'site_visit', '2026-10-01', '2026-10-04']);
  });

  it('ignores an intent value outside enquiry/site_visit', async () => {
    queryMock
      .mockResolvedValueOnce([{ total: 0 }]);
    await service.getEnquiryQueue(1, 10, { intent: 'callback' });
    const [sql, params] = queryMock.mock.calls[0];
    expect(sql).not.toContain('lw.intent = ?');
    expect(params).toEqual([]);
  });
});
