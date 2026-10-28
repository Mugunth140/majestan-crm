import { commonVariables } from '../../mail/core/mail-composer.service';
import type { MailEventDefinition } from '../../mail/core/mail-event';
import { MailScheduler } from '../../mail/core/mail-scheduler.service';
import { fillHtml, fillText } from '../../mail/render/template';
import type { LeadMailData } from './lead.mail-entity';
import {
  bookingConfirmedMail, enquiryReceivedMail, hourInIndia, SALES_MAIL_EVENTS, siteVisitConfirmedMail,
  siteVisitReminderMail, tomorrowInIndia,
} from './sales-mails';

function render(event: MailEventDefinition<LeadMailData>, d: LeadMailData) {
  const vars = { ...commonVariables(event.identity, null), ...event.entity.variables(d) };
  const subject = fillText(event.template.subject, vars);
  const body = fillHtml(event.template.body, vars);
  return { subject: subject.text, html: body.html, unknown: [...subject.unknown, ...body.unknown] };
}

const lead = (over: Partial<LeadMailData> = {}): LeadMailData => ({
  id: 5, name: 'Karthik <i>S</i>', email: 'karthik@example.com', status: 'Site Visit Scheduled',
  advisor: { name: 'Priya Raman', phone: '+91 98765 43210' },
  project: { name: 'Emerald Heights', url: 'https://www.majestanrealty.com/emerald-heights-coimbatore-pa0006', brochureUrl: 'https://cdn.majestanrealty.com/uploads/b.pdf', address: 'Kgisl Campus, Coimbatore', mapsUrl: 'https://www.google.com/maps/search/?api=1&query=11.08,76.99' },
  projectText: 'Emerald Heights', propertyUrl: null,
  visit: { date: '2099-11-07', time: '10:30', location: null },
  ...over,
});

describe('sales@ mail events', () => {
  it('registers five emails from sales@, one automatic with a schedule', () => {
    expect(SALES_MAIL_EVENTS.map((e) => e.key)).toEqual([
      'sales.enquiry_received', 'sales.site_visit_confirmed', 'sales.site_visit_reminder', 'sales.visit_thank_you', 'sales.booking_confirmed',
    ]);
    expect(SALES_MAIL_EVENTS.every((e) => e.identity === 'sales' && e.entityType === 'lead')).toBe(true);
    expect(SALES_MAIL_EVENTS.filter((e) => e.mode === 'auto').map((e) => e.key)).toEqual(['sales.site_visit_reminder']);
    expect(siteVisitReminderMail.schedule?.expiresAfterHours).toBe(12);
  });

  it('only uses fields the lead provides, with and without a matched project', () => {
    for (const event of SALES_MAIL_EVENTS) {
      expect(render(event, lead()).unknown).toEqual([]);
      expect(render(event, lead({ project: null, projectText: null, advisor: null, visit: null })).unknown).toEqual([]);
    }
  });

  it('renders the visit confirmation with card, maps button and escaped name', () => {
    const mail = render(siteVisitConfirmedMail, lead());
    expect(mail.subject).toBe('Your site visit is confirmed – Saturday, 7 November 2099');
    expect(mail.html).toContain('Dear Karthik,');
    expect(mail.html).toContain('10:30 AM (IST)');
    expect(mail.html).toContain('Kgisl Campus, Coimbatore');
    expect(mail.html).toContain('Open in Google Maps');
    expect(mail.html).toContain('Priya Raman · +91 98765 43210');
    expect(render(siteVisitConfirmedMail, lead({ name: '<i>K</i> S' })).html).toContain('&lt;i&gt;K&lt;/i&gt;');
  });

  it('falls back gracefully without a project or advisor', () => {
    const mail = render(enquiryReceivedMail, lead({ project: null, projectText: null, advisor: null }));
    expect(mail.html).toContain('your interest in our properties');
    expect(mail.html).toContain('Our property advisor');
    expect(mail.html).not.toContain('View ');
  });

  it('checks a visit has a future date, a time and somewhere to meet', () => {
    expect(siteVisitConfirmedMail.check!(lead())).toEqual([]);
    expect(siteVisitConfirmedMail.check!(lead({ visit: null }))[0]).toMatch(/Site visit date is not set/);
    expect(siteVisitConfirmedMail.check!(lead({ visit: { date: '2001-01-01', time: '10:00', location: 'x' } }))).toContain('Site visit date is in the past');
    expect(siteVisitConfirmedMail.check!(lead({ project: null, visit: { date: '2099-01-01', time: null, location: null } }))).toEqual([
      'Site visit time is not set', 'Meeting point is not set and the project has no address',
    ]);
  });

  it("only reminds about tomorrow's still-scheduled visits", () => {
    const tomorrow = tomorrowInIndia();
    expect(siteVisitReminderMail.check!(lead({ visit: { date: tomorrow, time: '10:00', location: null } }))).toEqual([]);
    expect(siteVisitReminderMail.check!(lead({ status: 'Dropped', visit: { date: tomorrow, time: '10:00', location: null } }))).toEqual(['The visit is no longer scheduled']);
    expect(siteVisitReminderMail.check!(lead())).toEqual(['The visit is not tomorrow']);
  });

  it('works out tomorrow and the hour in India, not server time', () => {
    const lateUtc = new Date('2026-10-28T20:00:00Z'); // 01:30 on 29 Oct in India
    expect(tomorrowInIndia(lateUtc)).toBe('2026-10-30');
    expect(hourInIndia(lateUtc)).toBe(1);
  });

  it('does not look for reminders before 9 AM in India', async () => {
    const query = jest.fn().mockResolvedValue([{ id: 3 }]);
    expect(await siteVisitReminderMail.schedule!.due({ dataSource: { query } as any, now: new Date('2026-10-28T01:00:00Z') })).toEqual([]);
    expect(query).not.toHaveBeenCalled();
    expect(await siteVisitReminderMail.schedule!.due({ dataSource: { query } as any, now: new Date('2026-10-28T05:00:00Z') })).toEqual([3]);
    expect(query.mock.calls[0][1]).toEqual(['2026-10-29', ['Site Visit Scheduled', 'Re Visit Scheduled']]);
  });

  it('skips "enquiry received" for leads who booked a visit', () => {
    const when = enquiryReceivedMail.triggers![0].when!;
    expect(when({ entityId: 1, withVisit: false })).toBe(true);
    expect(when({ entityId: 1, withVisit: true })).toBe(false);
  });

  it('never puts money amounts in the booking email', () => {
    expect(render(bookingConfirmedMail, lead({ status: 'Booking Advance' })).html).not.toMatch(/₹|rs\.?\s?\d|lakh|amount|advance of/i);
  });

  it('the scheduler creates due reminders with an expiry', async () => {
    const createFromTrigger = jest.fn().mockResolvedValue(undefined);
    const definition: any = { key: 'x', schedule: { everyMinutes: 60, expiresAfterHours: 12, due: async () => [4, 9] } };
    const scheduler = new MailScheduler({ all: () => [] } as any, { createFromTrigger } as any, {} as any, { enabled: true } as any);
    const now = new Date('2026-10-28T05:00:00Z');
    await scheduler.run(definition, now);
    expect(createFromTrigger).toHaveBeenCalledTimes(2);
    expect(createFromTrigger).toHaveBeenCalledWith(definition, { entityId: 4 }, 'schedule', { expiresAt: new Date('2026-10-28T17:00:00Z') });
  });
});
