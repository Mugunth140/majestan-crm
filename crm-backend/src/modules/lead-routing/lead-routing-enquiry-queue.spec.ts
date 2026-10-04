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

  it('returns one row per open website enquiry, newest first', async () => {
    queryMock
      .mockResolvedValueOnce([{ total: 2 }])
      .mockResolvedValueOnce([
        { id: 9, enquiry_id: 21, enquiry_at: '2026-10-02 10:00:00', repeat_count: '3', first_is_new_lead: 0, assigned_staff_id: 3, property_code: 'VL009', intent: 'site_visit' },
        { id: 9, enquiry_id: 20, enquiry_at: '2026-10-01 10:00:00', repeat_count: '3', first_is_new_lead: 0, assigned_staff_id: 3, property_code: 'AP018', intent: 'enquiry' },
      ]);
    const result = await service.getEnquiryQueue(1, 10);
    // Same lead, two rows — neither enquiry hides the other.
    expect(result.items).toHaveLength(2);
    expect(result.items[0].enquiry_id).toBe(21);
    expect(result.items[0].property_code).toBe('VL009');
    expect(result.items[0].intent).toBe('site_visit');
    expect(result.items[1].enquiry_id).toBe(20);
    expect(result.items[1].property_code).toBe('AP018');
    expect(result.items[1].intent).toBe('enquiry');
    expect(result.total).toBe(2);
    const [sql] = queryMock.mock.calls[1];
    expect(sql).toContain("i.source = 'website'");
    expect(sql).toContain('acknowledged_at IS NULL');
    expect(sql).toContain('ORDER BY i.id DESC');
    // repeat_count must count ALL website enquiries (acknowledged or not).
    expect(sql).toContain('ia.source = \'website\') AS repeat_count');
  });

  it('marks unassigned website-born leads as New, everything else as Repeat', async () => {
    queryMock
      .mockResolvedValueOnce([{ total: 3 }])
      .mockResolvedValueOnce([
        { id: 7, enquiry_id: 30, repeat_count: '1', first_is_new_lead: 1, assigned_staff_id: null },
        { id: 8, enquiry_id: 31, repeat_count: '1', first_is_new_lead: 0, assigned_staff_id: null },
        { id: 9, enquiry_id: 32, repeat_count: '2', first_is_new_lead: 1, assigned_staff_id: 3 },
      ]);
    const result = await service.getEnquiryQueue(1, 10);
    const byId = Object.fromEntries(result.items.map((i: any) => [i.id, i.type]));
    expect(byId[7]).toBe('New');
    expect(byId[8]).toBe('Repeat');
    expect(byId[9]).toBe('Repeat');
  });

  it('marks a first-time visit (enquiry + visit rows) as New, not Repeat', async () => {
    queryMock
      .mockResolvedValueOnce([{ total: 2 }])
      .mockResolvedValueOnce([
        { id: 7, enquiry_id: 34, repeat_count: '2', first_is_new_lead: 1, assigned_staff_id: null, intent: 'site_visit' },
        { id: 7, enquiry_id: 33, repeat_count: '2', first_is_new_lead: 1, assigned_staff_id: null, intent: 'enquiry' },
      ]);
    const result = await service.getEnquiryQueue(1, 10);
    expect(result.items).toHaveLength(2);
    expect(result.items[0].type).toBe('New');
    expect(result.items[0].repeat_count).toBe(2);
    expect(result.items[1].type).toBe('New');
  });

  it('applies propertyType/intent/date filters to each row enquiry', async () => {
    queryMock
      .mockResolvedValueOnce([{ total: 1 }])
      .mockResolvedValueOnce([
        { id: 7, enquiry_id: 35, repeat_count: '2', first_is_new_lead: 1 },
      ]);
    await service.getEnquiryQueue(1, 10, {
      propertyType: 'villa',
      intent: 'site_visit',
      dateFrom: '2026-10-01',
      dateTo: '2026-10-04',
    });
    const [, params] = queryMock.mock.calls[0];
    const [sql, rowsParams] = queryMock.mock.calls[1];
    expect(sql).toContain('i.property_type = ?');
    expect(sql).toContain('i.intent = ?');
    expect(sql).toContain('DATE(i.created_at) >= ?');
    expect(sql).toContain('DATE(i.created_at) <= ?');
    expect(rowsParams).toEqual(['villa', 'site_visit', '2026-10-01', '2026-10-04', 10, 0]);
    expect(params).toEqual(['villa', 'site_visit', '2026-10-01', '2026-10-04']);
  });

  it('ignores an intent value outside enquiry/site_visit', async () => {
    queryMock
      .mockResolvedValueOnce([{ total: 0 }]);
    await service.getEnquiryQueue(1, 10, { intent: 'callback' });
    const [sql, params] = queryMock.mock.calls[0];
    expect(sql).not.toContain('i.intent = ?');
    expect(params).toEqual([]);
  });
});
