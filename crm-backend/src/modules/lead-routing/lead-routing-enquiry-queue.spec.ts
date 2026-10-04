import { Test, TestingModule } from '@nestjs/testing';
import { LeadRoutingService } from './lead-routing.service';
import { NotificationsService } from '../notifications/notifications.service';
import { getDataSourceToken } from '@nestjs/typeorm';

jest.mock('bun', () => ({
  S3Client: class {}
}), { virtual: true });

describe('LeadRoutingService enquiry queue (event-sourced)', () => {
  let service: LeadRoutingService;
  let queryMock: jest.Mock;
  let siteQueryMock: jest.Mock;

  beforeEach(async () => {
    queryMock = jest.fn().mockResolvedValue([]);
    siteQueryMock = jest.fn().mockResolvedValue([]);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeadRoutingService,
        {
          provide: getDataSourceToken(),
          useValue: { query: queryMock, getRepository: jest.fn() },
        },
        {
          provide: getDataSourceToken('site'),
          useValue: { query: siteQueryMock },
        },
        {
          provide: NotificationsService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<LeadRoutingService>(LeadRoutingService);
  });

  it('returns one row per open event, newest first', async () => {
    queryMock
      .mockResolvedValueOnce([{ total: 2 }])
      .mockResolvedValueOnce([
        { enquiry_id: 21, enquiry_at: '2026-10-02 10:00:00', event_name: 'Asha', mobile_number: '9999999999', email: 'a@x.com', property_id: null, property_code: 'VL009', intent: 'site_visit', matched_lead_id: 9, id: 9, name: 'Asha Lead', lead_status: 'New Lead', repeat_count: '2' },
        { enquiry_id: 20, enquiry_at: '2026-10-01 10:00:00', event_name: 'Asha', mobile_number: '9999999999', email: 'a@x.com', property_id: null, property_code: 'AP018', intent: 'enquiry', matched_lead_id: 9, id: 9, name: 'Asha Lead', lead_status: 'New Lead', repeat_count: '2' },
      ]);
    const result = await service.getEnquiryQueue(1, 10);
    // Same mobile, two events — neither hides the other.
    expect(result.items).toHaveLength(2);
    expect(result.items[0].enquiry_id).toBe(21);
    expect(result.items[0].property_code).toBe('VL009');
    expect(result.items[0].intent).toBe('site_visit');
    expect(result.items[1].enquiry_id).toBe(20);
    expect(result.items[1].property_code).toBe('AP018');
    expect(result.items[1].intent).toBe('enquiry');
    expect(result.total).toBe(2);
    const [sql] = queryMock.mock.calls[1];
    expect(sql).toContain('FROM website_enquiry_events e');
    expect(sql).toContain("e.status = 'open'");
    expect(sql).toContain('ORDER BY e.id DESC');
    // repeat_count scopes to OPEN events sharing the mobile.
    expect(sql).toContain('website_enquiry_events');
    expect(sql).toContain("status = 'open') AS repeat_count");
    expect(sql).toContain('mobile_number = e.mobile_number');
  });

  it('types unmatched events as New and matched events as Repeat', async () => {
    queryMock
      .mockResolvedValueOnce([{ total: 3 }])
      .mockResolvedValueOnce([
        { enquiry_id: 30, enquiry_at: '2026-10-03', event_name: 'New Person', mobile_number: '9111111111', matched_lead_id: null, id: null, repeat_count: '1' },
        { enquiry_id: 31, enquiry_at: '2026-10-02', event_name: 'Known', mobile_number: '9222222222', matched_lead_id: 8, id: 8, name: 'Known Lead', lead_status: 'Contacted', repeat_count: '1' },
        { enquiry_id: 32, enquiry_at: '2026-10-01', event_name: 'Owner', mobile_number: '9333333333', matched_lead_id: 9, id: 9, name: 'Owner Lead', lead_status: 'New Lead', assigned_staff_id: 3, repeat_count: '2' },
      ]);
    const result = await service.getEnquiryQueue(1, 10);
    const byEnquiry = Object.fromEntries(result.items.map((i: any) => [i.enquiry_id, i]));
    expect(byEnquiry[30].type).toBe('New');
    expect(byEnquiry[31].type).toBe('Repeat');
    expect(byEnquiry[32].type).toBe('Repeat');
    // Unmatched rows carry no lead id; matched rows carry the lead id.
    expect(byEnquiry[30].id).toBeNull();
    expect(byEnquiry[31].id).toBe(8);
  });

  it('uses EQ display ids for unmatched events and L display ids for matched ones', async () => {
    queryMock
      .mockResolvedValueOnce([{ total: 2 }])
      .mockResolvedValueOnce([
        { enquiry_id: 30, enquiry_at: '2026-10-03', event_name: 'New Person', mobile_number: '9111111111', matched_lead_id: null, id: null, repeat_count: '1' },
        { enquiry_id: 31, enquiry_at: '2026-10-02', event_name: 'Known', mobile_number: '9222222222', matched_lead_id: 8, id: 8, repeat_count: '1' },
      ]);
    const result = await service.getEnquiryQueue(1, 10);
    const byEnquiry = Object.fromEntries(result.items.map((i: any) => [i.enquiry_id, i]));
    expect(byEnquiry[30].display_id).toBe('EQ00030');
    expect(byEnquiry[31].display_id).toBe('L00008');
  });

  it('falls back to lead name and a dash status for unmatched events', async () => {
    queryMock
      .mockResolvedValueOnce([{ total: 1 }])
      .mockResolvedValueOnce([
        { enquiry_id: 30, enquiry_at: '2026-10-03', event_name: null, mobile_number: '9111111111', email: null, matched_lead_id: null, id: null, name: null, lead_status: null, repeat_count: '1' },
      ]);
    const result = await service.getEnquiryQueue(1, 10);
    expect(result.items[0].status).toBe('—');
  });

  it('applies propertyType/intent/date filters to the event columns on both queries', async () => {
    queryMock
      .mockResolvedValueOnce([{ total: 1 }])
      .mockResolvedValueOnce([
        { enquiry_id: 35, enquiry_at: '2026-10-02', event_name: 'A', mobile_number: '9111111111', matched_lead_id: null, id: null, repeat_count: '1' },
      ]);
    await service.getEnquiryQueue(1, 10, {
      propertyType: 'villa',
      intent: 'site_visit',
      dateFrom: '2026-10-01',
      dateTo: '2026-10-04',
    });
    const [countSql, countParams] = queryMock.mock.calls[0];
    const [rowsSql, rowsParams] = queryMock.mock.calls[1];
    for (const sql of [countSql, rowsSql]) {
      expect(sql).toContain('e.property_type = ?');
      expect(sql).toContain('e.intent = ?');
      expect(sql).toContain('DATE(e.created_at) >= ?');
      expect(sql).toContain('DATE(e.created_at) <= ?');
    }
    expect(countParams).toEqual(['villa', 'site_visit', '2026-10-01', '2026-10-04']);
    expect(rowsParams).toEqual(['villa', 'site_visit', '2026-10-01', '2026-10-04', 10, 0]);
  });

  it('ignores an intent value outside enquiry/site_visit', async () => {
    queryMock
      .mockResolvedValueOnce([{ total: 0 }]);
    await service.getEnquiryQueue(1, 10, { intent: 'callback' });
    const [sql, params] = queryMock.mock.calls[0];
    expect(sql).not.toContain('e.intent = ?');
    expect(params).toEqual([]);
  });

  it('excludes Dropped/Not Interested matched leads but always shows unmatched events', async () => {
    queryMock.mockResolvedValueOnce([{ total: 0 }]);
    await service.getEnquiryQueue(1, 10);
    const [countSql] = queryMock.mock.calls[0];
    expect(countSql).toContain("l.id IS NULL OR l.status NOT IN ('Not Interested', 'Dropped')");
    // Converted/dead leads stay visible: only Dropped/Not Interested are excluded.
    expect(countSql).not.toContain('Converted');
  });

  it('resolves property titles from the site DB and nulls them on outage', async () => {
    siteQueryMock.mockResolvedValueOnce([{ id: 18, title: 'Sunset Villa', code: 'VL009' }]);
    queryMock
      .mockResolvedValueOnce([{ total: 1 }])
      .mockResolvedValueOnce([
        { enquiry_id: 40, enquiry_at: '2026-10-03', event_name: 'A', mobile_number: '9111111111', property_id: 18, property_code: 'VL009', intent: 'enquiry', matched_lead_id: null, id: null, repeat_count: '1' },
      ]);
    const ok = await service.getEnquiryQueue(1, 10);
    expect(ok.items[0].property_title).toBe('Sunset Villa');

    siteQueryMock.mockRejectedValueOnce(new Error('site down'));
    queryMock
      .mockResolvedValueOnce([{ total: 1 }])
      .mockResolvedValueOnce([
        { enquiry_id: 40, enquiry_at: '2026-10-03', event_name: 'A', mobile_number: '9111111111', property_id: 18, property_code: 'VL009', intent: 'enquiry', matched_lead_id: null, id: null, repeat_count: '1' },
      ]);
    const degraded = await service.getEnquiryQueue(1, 10);
    expect(degraded.items[0].property_title).toBeNull();
  });
});
