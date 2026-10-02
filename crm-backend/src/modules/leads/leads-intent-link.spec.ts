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
  const saved: Record<string, any[]> = { Lead: [], LeadInquiry: [], LeadFollowUp: [] };

  beforeEach(async () => {
    saved.Lead = [];
    saved.LeadInquiry = [];
    saved.LeadFollowUp = [];
    const repoFor = (key: string) => ({
      // Lead.findOne returns the already-saved lead, exercising the dedupe branch on repeat mobiles:
      findOne: async () => (key === 'Lead' ? saved.Lead[0] ?? null : null),
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
      name: 'Rahul', mobile: '9876543210', source: 'Website – Property page',
      propertyType: 'apartment', propertyId: 18, propertyCode: 'AP018',
      propertySlug: 'some-villa-ap018', intent: 'enquiry',
    } as any);
    expect(saved.Lead[0]).toEqual(expect.objectContaining({ status: 'New Lead' }));
    expect(saved.LeadInquiry[0]).toEqual(expect.objectContaining({
      property_id: 18, property_code: 'AP018', property_slug: 'some-villa-ap018', intent: 'enquiry',
    }));
    expect(saved.LeadFollowUp).toEqual([]);
  });

  it('marks a new visit lead Site Visit Scheduled with a dated follow-up', async () => {
    await service.createLead({
      name: 'Rahul', mobile: '9876543210', source: 'Website – Property page',
      propertyType: 'apartment', propertyId: 18, intent: 'site_visit',
      visitDate: '2026-10-05', visitSlot: '11:00',
    } as any);
    expect(saved.Lead[0]).toEqual(expect.objectContaining({ status: 'Site Visit Scheduled' }));
    expect(saved.LeadFollowUp[0]).toEqual(expect.objectContaining({
      next_follow_up_date: '2026-10-05', next_follow_up_time: '11:00', purpose: 'Site Visit',
    }));
  });

  it('appends inquiries without moving status for a repeat mobile', async () => {
    // findOne returns the already-saved lead, exercising the dedupe branch:
    const body = {
      name: 'Rahul', mobile: '9999999999', source: 'Website – Property page',
      propertyType: 'villa', propertyId: 19, propertyCode: 'VL009', intent: 'site_visit',
      visitDate: '2026-10-06', visitSlot: '12:00',
    } as any;
    await service.createLead(body);
    await service.createLead({ ...body, propertyId: 20, propertyCode: 'VL010' });
    expect(saved.Lead).toHaveLength(1);
    expect(saved.LeadInquiry).toHaveLength(2);
    expect(saved.LeadInquiry[1]).toEqual(expect.objectContaining({ property_id: 20 }));
    // status was set once by the first call and never rewritten:
    expect(saved.Lead[0].status).toBe('Site Visit Scheduled');
  });
});
