import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { LeadRoutingService } from './lead-routing.service';
import { NotificationsService } from '../notifications/notifications.service';
import { getDataSourceToken } from '@nestjs/typeorm';

jest.mock('bun', () => ({
  S3Client: class {}
}), { virtual: true });

function openEvent(overrides: any = {}) {
  return {
    id: 1,
    name: 'Rahul',
    mobile_number: '9999999999',
    email: 'rahul@example.com',
    city: 'Pune',
    whatsapp_number: null,
    property_id: 18,
    property_code: 'AP018',
    property_slug: 'some-villa-ap018',
    property_type: 'apartment',
    intent: 'enquiry',
    visit_date: null,
    visit_slot: null,
    preferences: null,
    matched_lead_id: null,
    status: 'open',
    resolved_lead_id: null,
    decided_by: null,
    decided_at: null,
    ...overrides,
  };
}

describe('enquiry events: convert/accept/acknowledge', () => {
  let service: LeadRoutingService;
  let notifyMock: jest.Mock;
  const saved: Record<string, any[]> = {};

  const repoFor = (key: string) => ({
    findOne: async (args?: any) => {
      const rows = saved[key] ?? [];
      const w = args?.where ?? {};
      const keys = Object.keys(w);
      if (keys.length === 0) return rows[0] ?? null;
      return rows.find((r: any) => keys.every((k) => r[k] === w[k])) ?? null;
    },
    find: async (args?: any) => {
      const rows = saved[key] ?? [];
      const w = args?.where ?? {};
      const keys = Object.keys(w);
      if (keys.length === 0) return [...rows];
      return rows.filter((r: any) => keys.every((k) => r[k] === w[k]));
    },
    create: (x: any) => ({ ...x }),
    save: async (x: any) => {
      const rows = saved[key] ?? (saved[key] = []);
      if (Array.isArray(x)) {
        const out: any[] = [];
        for (const item of x) out.push(await (repoFor(key).save as any)(item));
        return out;
      }
      if (x.id == null) {
        const row = { ...x, id: rows.length + 1 };
        rows.push(row);
        return row;
      }
      const idx = rows.findIndex((r: any) => r.id === x.id);
      if (idx >= 0) {
        rows[idx] = { ...rows[idx], ...x };
        return rows[idx];
      }
      rows.push({ ...x });
      return x;
    },
  });

  const manager = {
    query: async (sql: string, params?: any[]) => {
      if (String(sql).includes('website_enquiry_events') && String(sql).includes('FOR UPDATE')) {
        return (saved.WebsiteEnquiryEvent ?? []).filter((e: any) => e.id === params?.[0]);
      }
      return [];
    },
    getRepository: (e: any) => repoFor(e?.name ?? String(e)),
    save: async () => {
      throw new Error('manager.save not stubbed — use repo.save');
    },
  };

  beforeEach(async () => {
    for (const k of ['Lead', 'LeadInquiry', 'LeadFollowUp', 'WebsiteEnquiryEvent', 'RoutingHistory', 'User']) {
      saved[k] = [];
    }
    notifyMock = jest.fn().mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeadRoutingService,
        {
          provide: getDataSourceToken(),
          useValue: {
            transaction: async (fn: any) => fn(manager),
            query: jest.fn().mockResolvedValue([]),
            getRepository: (e: any) => repoFor(e?.name ?? String(e)),
          },
        },
        {
          provide: getDataSourceToken('site'),
          useValue: { query: jest.fn().mockResolvedValue([]) },
        },
        {
          provide: NotificationsService,
          useValue: { createNotification: notifyMock },
        },
      ],
    }).compile();

    service = module.get<LeadRoutingService>(LeadRoutingService);
  });

  it('convert creates an unassigned lead + inquiry + Queued history + resolves the event', async () => {
    saved.WebsiteEnquiryEvent.push(openEvent());

    const result = await service.convertEvent(1, 10, 'Staff');

    expect(result).toEqual({ leadId: 1, converted: 1 });
    expect(saved.Lead).toHaveLength(1);
    expect(saved.Lead[0]).toEqual(expect.objectContaining({
      mobile_number: '9999999999',
      email: 'rahul@example.com',
      city: 'Pune',
      status: 'New Lead',
      lead_source: 'Website – Property page',
    }));
    expect(saved.Lead[0].assigned_staff_id ?? null).toBeNull();
    expect(saved.LeadInquiry).toHaveLength(1);
    expect(saved.LeadInquiry[0]).toEqual(expect.objectContaining({
      lead_id: 1,
      property_id: 18,
      property_code: 'AP018',
      intent: 'enquiry',
      source: 'website',
      is_new_lead: true,
    }));
    expect(saved.LeadFollowUp).toEqual([]);
    expect(saved.RoutingHistory).toHaveLength(1);
    expect(saved.RoutingHistory[0]).toEqual(expect.objectContaining({
      lead_id: 1,
      event_type: 'Queued',
      to_user_id: null,
      actioned_by_id: 10,
    }));
    expect(saved.WebsiteEnquiryEvent[0]).toEqual(expect.objectContaining({
      status: 'converted',
      resolved_lead_id: 1,
      decided_by: 10,
    }));
  });

  it('convert 409s on a non-open event, naming the decider', async () => {
    saved.User.push({ id: 5, name: 'Ravi' });
    saved.WebsiteEnquiryEvent.push(openEvent({ status: 'converted', decided_by: 5 }));

    const err = await service.convertEvent(1, 10, 'Staff').catch((e) => e);
    expect(err).toBeInstanceOf(ConflictException);
    expect(err.getResponse()).toEqual(expect.objectContaining({ handledBy: 5 }));
    expect(JSON.stringify(err.getResponse())).toContain('Ravi');
  });

  it('convert 404s on a missing event', async () => {
    await expect(service.convertEvent(999, 10, 'Staff')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('convert rejects an unknown role', async () => {
    saved.WebsiteEnquiryEvent.push(openEvent());
    await expect(service.convertEvent(1, 10, 'Viewer')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('convert redirects to attach when the mobile now exists (no new lead)', async () => {
    saved.Lead.push({ id: 1, name: 'Priya', mobile_number: '9999999999', status: 'New Lead', department: 'telecalling', assigned_staff_id: null });
    saved.WebsiteEnquiryEvent.push(openEvent({ property_id: 20, property_code: 'VL010' }));

    const result = await service.convertEvent(1, 10, 'Manager');

    expect(result).toEqual({ leadId: 1, converted: 1 });
    expect(saved.Lead).toHaveLength(1);
    expect(saved.LeadInquiry).toHaveLength(1);
    expect(saved.LeadInquiry[0]).toEqual(expect.objectContaining({
      lead_id: 1,
      property_id: 20,
      source: 'website',
      is_new_lead: false,
    }));
    expect(saved.RoutingHistory).toHaveLength(1);
    expect(saved.RoutingHistory[0]).toEqual(expect.objectContaining({
      lead_id: 1,
      event_type: 'Enquiry Attached',
    }));
    expect(saved.WebsiteEnquiryEvent[0]).toEqual(expect.objectContaining({
      status: 'attached',
      resolved_lead_id: 1,
    }));
  });

  it('accept creates an inquiry without touching status + history + notifies a different owner', async () => {
    saved.Lead.push({ id: 1, name: 'Priya', mobile_number: '8888888888', status: 'Dropped', department: 'telecalling', assigned_staff_id: 20 });
    saved.User.push({ id: 20, name: 'Asha' });
    saved.WebsiteEnquiryEvent.push(openEvent({
      id: 1,
      mobile_number: '8888888888',
      intent: 'site_visit',
      visit_date: '2026-10-10',
      visit_slot: '14:00',
      matched_lead_id: 1,
    }));

    const result = await service.acceptEvent(1, 30, 'Team Lead');

    expect(result).toEqual({ leadId: 1, inquiryId: 1 });
    expect(saved.LeadInquiry).toHaveLength(1);
    expect(saved.LeadInquiry[0]).toEqual(expect.objectContaining({
      lead_id: 1,
      property_id: 18,
      intent: 'site_visit',
      visit_date: '2026-10-10',
      visit_slot: '14:00',
      source: 'website',
      is_new_lead: false,
    }));
    expect(saved.LeadFollowUp).toHaveLength(1);
    expect(saved.LeadFollowUp[0]).toEqual(expect.objectContaining({
      lead_id: 1,
      next_follow_up_date: '2026-10-10',
      purpose: 'Site Visit',
    }));
    // Status untouched even though the lead is Dropped.
    expect(saved.Lead[0].status).toBe('Dropped');
    expect(saved.RoutingHistory).toHaveLength(1);
    expect(saved.RoutingHistory[0]).toEqual(expect.objectContaining({
      lead_id: 1,
      event_type: 'Enquiry Attached',
    }));
    expect(saved.WebsiteEnquiryEvent[0]).toEqual(expect.objectContaining({
      status: 'attached',
      resolved_lead_id: 1,
      decided_by: 30,
    }));
    expect(notifyMock).toHaveBeenCalledTimes(1);
    expect(notifyMock).toHaveBeenCalledWith(
      20,
      expect.any(String),
      expect.stringContaining('AP018'),
      'lead_enquiry_attached',
      1,
      'lead',
    );
  });

  it('accept 403s for Staff', async () => {
    saved.WebsiteEnquiryEvent.push(openEvent({ matched_lead_id: 1 }));
    await expect(service.acceptEvent(1, 10, 'Staff')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('acknowledge writes no inquiry + history, and notifies a different owner', async () => {
    saved.Lead.push({ id: 1, name: 'Priya', mobile_number: '8888888888', status: 'New Lead', department: 'telecalling', assigned_staff_id: 20 });
    saved.User.push({ id: 20, name: 'Asha' });
    saved.WebsiteEnquiryEvent.push(openEvent({ mobile_number: '8888888888', matched_lead_id: 1 }));

    const result = await service.acknowledgeEvent(1, 30, 'Manager');

    expect(result).toEqual({ leadId: 1, acknowledged: 1 });
    expect(saved.LeadInquiry).toEqual([]);
    expect(saved.LeadFollowUp).toEqual([]);
    expect(saved.WebsiteEnquiryEvent[0]).toEqual(expect.objectContaining({
      status: 'acknowledged',
      decided_by: 30,
    }));
    expect(saved.RoutingHistory).toHaveLength(1);
    expect(saved.RoutingHistory[0]).toEqual(expect.objectContaining({
      lead_id: 1,
      event_type: 'Enquiry Acknowledged',
    }));
    expect(notifyMock).toHaveBeenCalledTimes(1);
    expect(notifyMock).toHaveBeenCalledWith(
      20,
      expect.any(String),
      expect.any(String),
      'lead_enquiry_acknowledged',
      1,
      'lead',
    );
  });

  it('acknowledge 403s for Staff', async () => {
    saved.WebsiteEnquiryEvent.push(openEvent({ matched_lead_id: 1 }));
    await expect(service.acknowledgeEvent(1, 10, 'Staff')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('acknowledge on an UNMATCHED event succeeds with no inquiry row, no history, no notification', async () => {
    saved.WebsiteEnquiryEvent.push(openEvent({ matched_lead_id: null }));

    const result = await service.acknowledgeEvent(1, 30, 'Manager');

    expect(result).toEqual({ leadId: null, acknowledged: 1 });
    expect(saved.LeadInquiry).toEqual([]);
    expect(saved.LeadFollowUp).toEqual([]);
    expect(saved.RoutingHistory).toEqual([]);
    expect(saved.WebsiteEnquiryEvent[0]).toEqual(expect.objectContaining({
      status: 'acknowledged',
      resolved_lead_id: null,
      decided_by: 30,
    }));
    expect(notifyMock).not.toHaveBeenCalled();
  });

  it('accept 409s when the event is already attached, naming the decider', async () => {
    saved.User.push({ id: 7, name: 'Meera' });
    saved.WebsiteEnquiryEvent.push(openEvent({ matched_lead_id: 1, status: 'attached', decided_by: 7 }));

    const err = await service.acceptEvent(1, 30, 'Team Lead').catch((e) => e);
    expect(err).toBeInstanceOf(ConflictException);
    expect(err.getResponse()).toEqual(expect.objectContaining({ handledBy: 7 }));
    expect(JSON.stringify(err.getResponse())).toContain('Meera');
  });

  it('accept sends no owner notification when the decider IS the owner', async () => {
    saved.Lead.push({ id: 1, name: 'Priya', mobile_number: '8888888888', status: 'New Lead', department: 'telecalling', assigned_staff_id: 30 });
    saved.WebsiteEnquiryEvent.push(openEvent({ mobile_number: '8888888888', matched_lead_id: 1 }));

    const result = await service.acceptEvent(1, 30, 'Team Lead');

    expect(result).toEqual({ leadId: 1, inquiryId: 1 });
    expect(saved.WebsiteEnquiryEvent[0]).toEqual(expect.objectContaining({
      status: 'attached',
      resolved_lead_id: 1,
    }));
    expect(notifyMock).not.toHaveBeenCalled();
  });

  it('accept is fail-open with an undefined role', async () => {
    saved.Lead.push({ id: 1, name: 'Priya', mobile_number: '8888888888', status: 'New Lead', department: 'telecalling', assigned_staff_id: 20 });
    saved.WebsiteEnquiryEvent.push(openEvent({ mobile_number: '8888888888', matched_lead_id: 1 }));

    const result = await service.acceptEvent(1, 30, undefined);

    expect(result).toEqual({ leadId: 1, inquiryId: 1 });
  });
});
