import { commonVariables } from '../../mail/core/mail-composer.service';
import type { MailEventDefinition } from '../../mail/core/mail-event';
import { fillHtml, fillText } from '../../mail/render/template';
import { askingPrice, humanize, propertyLabel, type InboundMailData } from './inbound.mail-entity';
import {
  availabilityCheckMail, availabilityCycle, LISTING_MAIL_EVENTS, listingApprovedMail, listingReceivedMail,
} from './listing-mails';

function render(event: MailEventDefinition<InboundMailData>, d: InboundMailData) {
  const vars = { ...commonVariables(event.identity, null), ...event.entity.variables(d) };
  const subject = fillText(event.template.subject, vars);
  const body = fillHtml(event.template.body, vars);
  return { subject: subject.text, html: body.html, unknown: [...subject.unknown, ...body.unknown] };
}

const DAY = 24 * 3600_000;

const inbound = (over: Partial<InboundMailData> = {}): InboundMailData => ({
  id: 42, reference: 'I00042', ownerName: 'Lakshmi Narayanan', email: 'lakshmi@example.com', status: 'Approved',
  availability: 'available', property: '3 BHK Apartment', purpose: 'Rent', location: 'Saravanampatti, Coimbatore',
  price: '₹25,000 per month', advisor: { name: 'Priya Raman', phone: '+91 98765 43210' },
  createdAt: new Date(Date.now() - 40 * DAY),
  ...over,
});

describe('listings@ mail events', () => {
  it('registers three emails from listings@, one automatic with a schedule', () => {
    expect(LISTING_MAIL_EVENTS.map((e) => e.key)).toEqual([
      'listings.listing_received', 'listings.listing_approved', 'listings.availability_check',
    ]);
    expect(LISTING_MAIL_EVENTS.every((e) => e.identity === 'listings' && e.entityType === 'inbound' && e.module === 'listings')).toBe(true);
    expect(LISTING_MAIL_EVENTS.filter((e) => e.mode === 'auto').map((e) => e.key)).toEqual(['listings.availability_check']);
  });

  it('only uses fields the inbound provides, with and without optional details', () => {
    for (const event of LISTING_MAIL_EVENTS) {
      expect(render(event, inbound()).unknown).toEqual([]);
      expect(render(event, inbound({ ownerName: '', purpose: null, location: null, price: null, advisor: null })).unknown).toEqual([]);
    }
  });

  it('renders the received email with the details card and escaped owner name', () => {
    const mail = render(listingReceivedMail, inbound());
    expect(mail.subject).toBe('We have received your property details – I00042');
    expect(mail.html).toContain('Dear Lakshmi,');
    expect(mail.html).toContain('3 BHK Apartment');
    expect(mail.html).toContain('For rent');
    expect(mail.html).toContain('Expected rent');
    expect(mail.html).toContain('Priya Raman · +91 98765 43210');
    expect(render(listingReceivedMail, inbound({ ownerName: '<b>X</b> Y' })).html).toContain('&lt;b&gt;X&lt;/b&gt;');
    const sale = render(listingReceivedMail, inbound({ purpose: 'Sale', price: '₹85,00,000' })).html;
    expect(sale).toContain('For sale');
    expect(sale).toContain('Asking price');
  });

  it('never shows brokerage terms or other contacts', () => {
    const html = render(listingApprovedMail, inbound()).html.toLowerCase();
    expect(html).not.toContain('brokerage');
    expect(html).not.toContain('caretaker');
  });

  it('falls back without an owner name or advisor', () => {
    const mail = render(listingApprovedMail, inbound({ ownerName: '', advisor: null }));
    expect(mail.html).toContain('Dear Sir/Madam,');
    expect(mail.html).toContain('Our listings team');
  });

  it('approval email needs the Approved status', () => {
    expect(listingApprovedMail.check!(inbound())).toEqual([]);
    expect(listingApprovedMail.check!(inbound({ status: 'On Hold' }))).toEqual(['Inbound status is not "Approved"']);
    expect(listingApprovedMail.triggers![0].when!({ entityId: 1, to: 'Approved' })).toBe(true);
    expect(listingApprovedMail.triggers![0].when!({ entityId: 1, to: 'Closed' })).toBe(false);
  });

  it('asks about availability once per 30-day period, and not for unavailable listings', () => {
    const created = new Date('2026-01-01T00:00:00Z');
    expect(availabilityCycle(created, new Date('2026-01-29T00:00:00Z'))).toBe(0);
    expect(availabilityCycle(created, new Date('2026-01-31T00:00:00Z'))).toBe(1);
    expect(availabilityCycle(created, new Date('2026-03-02T00:00:00Z'))).toBe(2);
    const d = inbound({ createdAt: new Date(Date.now() - 65 * DAY) });
    expect(availabilityCheckMail.idempotencyKey(d, 42)).toBe('listings.availability_check:42:2');
    expect(availabilityCheckMail.check!(d)).toEqual([]);
    expect(availabilityCheckMail.check!(inbound({ availability: 'not_available' }))).toEqual(['The property is marked not available']);
    expect(availabilityCheckMail.check!(inbound({ status: 'Closed' }))).toEqual(['The listing is no longer approved']);
  });

  it('only looks for due listings during office hours in India', async () => {
    const query = jest.fn().mockResolvedValue([{ id: '7' }, { id: 9 }]);
    const due = availabilityCheckMail.schedule!.due;
    expect(await due({ dataSource: { query } as any, now: new Date('2026-10-28T02:00:00Z') })).toEqual([]); // 07:30 IST
    expect(await due({ dataSource: { query } as any, now: new Date('2026-10-28T13:00:00Z') })).toEqual([]); // 18:30 IST
    expect(query).not.toHaveBeenCalled();
    expect(await due({ dataSource: { query } as any, now: new Date('2026-10-28T06:00:00Z') })).toEqual([7, 9]); // 11:30 IST
    expect(query.mock.calls[0][1][0]).toBe('Approved');
  });
});

describe('inbound mail helpers', () => {
  it('describes the property from its title or type', () => {
    expect(propertyLabel({ property_title: ' Sea View Villa ', bhk: '3', property_type: 'villa', property_category: 'residential' })).toBe('Sea View Villa');
    expect(propertyLabel({ property_title: '', bhk: '2 BHK', property_type: 'apartment', property_category: 'residential' })).toBe('2 BHK Apartment');
    expect(propertyLabel({ property_title: '', bhk: '', property_type: 'training_centre', property_category: 'commercial' })).toBe('Training Centre');
    expect(propertyLabel({ property_title: '', bhk: '', property_type: '', property_category: '' })).toBe('your property');
    expect(humanize('office-space')).toBe('Office Space');
  });

  it('formats the asking price for sale or rent', () => {
    expect(askingPrice({ purpose: 'Sale', sale_price: 8500000, total_rent: null as any })).toBe('₹85,00,000');
    expect(askingPrice({ purpose: 'Rent', sale_price: null as any, total_rent: '25000.00' as any })).toBe('₹25,000 per month');
    expect(askingPrice({ purpose: 'Lease', sale_price: null as any, total_rent: null as any })).toBeNull();
  });
});
