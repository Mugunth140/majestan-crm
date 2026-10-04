import { Test, TestingModule } from '@nestjs/testing';
import { LeadsService } from './leads.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TasksService } from '../tasks/tasks.service';
import { getDataSourceToken } from '@nestjs/typeorm';

jest.mock('bun', () => ({
  S3Client: class {}
}), { virtual: true });

describe('createLead intent mapping', () => {
  let service: LeadsService;
  const saved: Record<string, any[]> = { Lead: [], LeadInquiry: [], LeadFollowUp: [], WebsiteEnquiryEvent: [] };

  beforeEach(async () => {
    saved.Lead = [];
    saved.LeadInquiry = [];
    saved.LeadFollowUp = [];
    saved.WebsiteEnquiryEvent = [];
    const repoFor = (key: string) => ({
      // Arg-aware Lead.findOne: matches by mobile_number/email like the real
      // queries, falling back to the first saved lead for arg-less calls.
      findOne: async (args?: any) => {
        if (key !== 'Lead') return null;
        const w = args?.where ?? args ?? {};
        if (w.mobile_number) return saved.Lead.find((l) => l.mobile_number === w.mobile_number) ?? null;
        if (w.email) return saved.Lead.find((l) => l.email === w.email) ?? null;
        return saved.Lead[0] ?? null;
      },
      create: (x: any) => ({ ...x, _entityKey: key }),
      save: async (x: any) => {
        const row = { ...x, id: saved[key].length + 1 };
        saved[key].push(row);
        return row;
      },
    });
    const manager = {
      getRepository: (e: any) => repoFor(e.name),
      // manager.save(entityInstance) — detect key from _entityKey tag set by create()
      save: async (x: any) => {
        const key = x._entityKey as string;
        if (!key || !(key in saved)) {
          // Fallback: try to identify by known shape
          throw new Error(`Unknown entity key for manager.save: ${JSON.stringify(x)}`);
        }
        const row = { ...x, id: saved[key].length + 1 };
        saved[key].push(row);
        return row;
      },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeadsService,
        { provide: getDataSourceToken(), useValue: { transaction: async (fn: any) => fn(manager) } },
        { provide: getDataSourceToken('site'), useValue: {} },
        { provide: NotificationsService, useValue: {} },
        { provide: TasksService, useValue: {} },
      ],
    }).compile();
    service = module.get<LeadsService>(LeadsService);
  });

  it('stores the property link on the inquiry for a new enquiry lead', async () => {
    await service.createLead({
      name: 'Rahul', mobile: '9876543210', source: 'Manual',
      propertyType: 'apartment', propertyId: 18, propertyCode: 'AP018',
      propertySlug: 'some-villa-ap018', intent: 'enquiry',
    } as any);
    expect(saved.Lead[0]).toEqual(expect.objectContaining({ status: 'New Lead' }));
    expect(saved.LeadInquiry[0]).toEqual(expect.objectContaining({
      property_id: 18, property_code: 'AP018', property_slug: 'some-villa-ap018', intent: 'enquiry',
    }));
    expect(saved.LeadInquiry[0]).toEqual(expect.objectContaining({
      source: 'website',
      is_new_lead: true,
    }));
    expect(saved.LeadFollowUp).toEqual([]);
  });

  it('marks a new visit lead Site Visit Scheduled with a dated follow-up', async () => {
    await service.createLead({
      name: 'Rahul', mobile: '9876543210', source: 'Manual',
      propertyType: 'apartment', propertyId: 18, intent: 'site_visit',
      visitDate: '2026-10-05', visitSlot: '11:00',
    } as any);
    expect(saved.Lead[0]).toEqual(expect.objectContaining({ status: 'Site Visit Scheduled' }));
    expect(saved.LeadFollowUp[0]).toEqual(expect.objectContaining({
      next_follow_up_date: '2026-10-05', next_follow_up_time: '11:00', purpose: 'Site Visit',
    }));
    // A visit lays down its enquiry first, then the visit on top of it.
    expect(saved.LeadInquiry).toHaveLength(2);
    expect(saved.LeadInquiry[0]).toEqual(expect.objectContaining({
      source: 'website',
      is_new_lead: true,
      intent: 'enquiry',
      property_id: 18,
      visit_date: null,
      visit_slot: null,
    }));
    expect(saved.LeadInquiry[1]).toEqual(expect.objectContaining({
      source: 'website',
      is_new_lead: true,
      intent: 'site_visit',
      property_id: 18,
      visit_date: '2026-10-05',
      visit_slot: '11:00',
    }));
  });

  it('appends inquiries without moving status for a repeat mobile', async () => {
    // findOne returns the already-saved lead, exercising the dedupe branch:
    const body = {
      name: 'Rahul', mobile: '9999999999', source: 'Manual',
      propertyType: 'villa', propertyId: 19, propertyCode: 'VL009', intent: 'site_visit',
      visitDate: '2026-10-06', visitSlot: '12:00',
    } as any;
    await service.createLead(body);
    await service.createLead({ ...body, propertyId: 20, propertyCode: 'VL010' });
    expect(saved.Lead).toHaveLength(1);
    // Each visit writes enquiry + visit rows: [enquiry(19), visit(19), enquiry(20), visit(20)].
    expect(saved.LeadInquiry).toHaveLength(4);
    expect(saved.LeadInquiry[2]).toEqual(expect.objectContaining({ property_id: 20, intent: 'enquiry' }));
    expect(saved.LeadInquiry[3]).toEqual(expect.objectContaining({ property_id: 20, intent: 'site_visit' }));
    // status was set once by the first call and never rewritten:
    expect(saved.Lead[0].status).toBe('Site Visit Scheduled');
  });

  it('does not overwrite an advanced status when a repeat mobile books a visit', async () => {
    // Pre-seed a lead already at 'Negotiation' so findOne returns it on the very first call.
    const existingLead = {
      id: 1, _entityKey: 'Lead',
      name: 'Priya', mobile_number: '8888888888', status: 'Negotiation',
    };
    saved.Lead.push(existingLead);

    await service.createLead({
      name: 'Priya', mobile: '8888888888', source: 'Manual',
      propertyType: 'apartment', propertyId: 55, propertyCode: 'AP055', intent: 'site_visit',
      visitDate: '2026-10-10', visitSlot: '14:00',
    } as any);

    // Dedupe branch: no new Lead should have been created
    expect(saved.Lead).toHaveLength(1);
    // Status must remain untouched — dedupe branch never writes lead.status
    expect(saved.Lead[0].status).toBe('Negotiation');
    // Enquiry first, then the visit on top of it
    expect(saved.LeadInquiry).toHaveLength(2);
    expect(saved.LeadInquiry[0]).toEqual(expect.objectContaining({ property_id: 55, intent: 'enquiry' }));
    expect(saved.LeadInquiry[1]).toEqual(expect.objectContaining({ property_id: 55, intent: 'site_visit' }));
  });

  it('stamps repeat enquiries with source website and is_new_lead false', async () => {
    const body = {
      name: 'Rahul', mobile: '9999999999', source: 'Manual',
      propertyType: 'villa', propertyId: 19, intent: 'enquiry',
    } as any;
    await service.createLead(body);
    await service.createLead({ ...body, propertyId: 20 });
    expect(saved.LeadInquiry[1]).toEqual(expect.objectContaining({
      source: 'website',
      is_new_lead: false,
      property_id: 20,
    }));
  });

  it('holds a fresh website enquiry as an open event without creating a lead', async () => {
    const result = await service.createLead({
      name: 'Rahul', mobile: '9876543210', email: 'rahul@example.com',
      source: 'Website – Property page',
      propertyType: 'apartment', propertyId: 18, propertyCode: 'AP018',
      propertySlug: 'some-villa-ap018', intent: 'enquiry',
    } as any);
    // Decide-first intake: nothing auto-creates.
    expect(saved.Lead).toEqual([]);
    expect(saved.LeadInquiry).toEqual([]);
    expect(saved.LeadFollowUp).toEqual([]);
    expect(saved.WebsiteEnquiryEvent).toHaveLength(1);
    expect(saved.WebsiteEnquiryEvent[0]).toEqual(expect.objectContaining({
      mobile_number: '9876543210',
      email: 'rahul@example.com',
      property_id: 18,
      property_code: 'AP018',
      intent: 'enquiry',
      matched_lead_id: null,
      status: 'open',
    }));
    expect(result.lead).toBeNull();
    expect(result.isExistingCustomer).toBe(false);
    expect(result.existingStaff).toBe('Unassigned');
    expect(result.eventId).toBe(1);
  });

  it('holds a repeat website enquiry as an open event linked to the matched lead', async () => {
    const existingLead = {
      id: 1, _entityKey: 'Lead',
      name: 'Priya', mobile_number: '8888888888',
      assigned_staff: { name: 'Asha' },
    };
    saved.Lead.push(existingLead);

    const result = await service.createLead({
      name: 'Priya', mobile: '8888888888', source: 'Website – Property page',
      propertyType: 'apartment', propertyId: 55, propertyCode: 'AP055', intent: 'site_visit',
      visitDate: '2026-10-10', visitSlot: '14:00',
    } as any);

    // Matched by mobile: no new Lead, no inquiries, no follow-ups.
    expect(saved.Lead).toHaveLength(1);
    expect(saved.LeadInquiry).toEqual([]);
    expect(saved.LeadFollowUp).toEqual([]);
    expect(saved.WebsiteEnquiryEvent).toHaveLength(1);
    expect(saved.WebsiteEnquiryEvent[0]).toEqual(expect.objectContaining({
      matched_lead_id: 1,
      status: 'open',
      intent: 'site_visit',
      property_id: 55,
      visit_date: '2026-10-10',
      visit_slot: '14:00',
    }));
    expect(result.lead).toEqual(expect.objectContaining({ id: 1 }));
    expect(result.isExistingCustomer).toBe(true);
    expect(result.existingStaff).toBe('Asha');
    expect(result.eventId).toBe(1);
  });

  it('prefers the mobile match when mobile and email point at different leads', async () => {
    saved.Lead.push(
      { id: 1, _entityKey: 'Lead', name: 'Asha', mobile_number: '1111111111', email: 'a@example.com' },
      { id: 2, _entityKey: 'Lead', name: 'Bala', mobile_number: '2222222222', email: 'b@example.com' },
    );

    await service.createLead({
      name: 'X', mobile: '1111111111', email: 'b@example.com',
      source: 'Website – Property page', propertyId: 18, intent: 'enquiry',
    } as any);

    expect(saved.Lead).toHaveLength(2);
    expect(saved.WebsiteEnquiryEvent).toHaveLength(1);
    expect(saved.WebsiteEnquiryEvent[0]).toEqual(expect.objectContaining({
      matched_lead_id: 1,
      status: 'open',
    }));
  });
});
