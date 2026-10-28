import { defineMailEvent } from '../../mail/core/mail-event';
import { hourInIndia } from '../../leads/mail/sales-mails';
import { inboundMailEntity } from './inbound.mail-entity';

export const LISTING_APPROVED_STATUS = 'Approved';
/** How often an approved listing's owner is asked whether it is still available. */
export const AVAILABILITY_CHECK_DAYS = 30;
/** At most this many checks are queued per run, so a backlog spreads out over the day. */
const AVAILABILITY_BATCH = 40;

/** Which 30-day period of the listing's life `now` falls in (0 = first month). */
export function availabilityCycle(createdAt: Date, now = new Date()): number {
  return Math.floor((now.getTime() - new Date(createdAt).getTime()) / (AVAILABILITY_CHECK_DAYS * 24 * 3600_000));
}

export const listingReceivedMail = defineMailEvent({
  key: 'listings.listing_received',
  entity: inboundMailEntity,
  label: 'Property received',
  description: 'Thanks the owner for offering their property and explains what happens next.',
  mode: 'confirm',
  version: 1,
  triggers: [{ on: 'listings.inbound.created' }],
  idempotencyKey: (_d, id) => `listings.listing_received:${id}`,
  template: {
    subject: 'We have received your property details – {{listing.reference}}',
    preheader: 'Thank you for listing your property with Majestan Realty.',
    body: `<p>Dear {{owner.first_name}},</p>
<p>Thank you for choosing Majestan Realty to market your property. We have recorded the details below under reference <strong>{{listing.reference}}</strong>.</p>
<p>{{listing_details}}</p>
<p>Our team will verify the details and may visit the property to take photos. We will let you know once it is approved for listing.</p>
<p>If anything above is incorrect, reply to this email or call {{advisor.phone}}.</p>`,
  },
});

export const listingApprovedMail = defineMailEvent({
  key: 'listings.listing_approved',
  entity: inboundMailEntity,
  label: 'Listing approved',
  description: 'Tells the owner their property has been verified and we have started finding buyers or tenants.',
  mode: 'confirm',
  version: 1,
  triggers: [{ on: 'listings.inbound.status_changed', when: (p) => p.to === LISTING_APPROVED_STATUS }],
  check: (d) => (d.status === LISTING_APPROVED_STATUS ? [] : [`Inbound status is not "${LISTING_APPROVED_STATUS}"`]),
  idempotencyKey: (_d, id) => `listings.listing_approved:${id}`,
  template: {
    subject: 'Your property is approved for listing – {{listing.reference}}',
    preheader: 'We have started finding the right buyer or tenant.',
    body: `<p>Dear {{owner.first_name}},</p>
<p>Good news: your property has been verified and approved for listing with Majestan Realty.</p>
<p>{{listing_details}}</p>
<p>We have started sharing it with interested buyers and tenants, and {{advisor.name}} will contact you to arrange visits.</p>
<p>If the property becomes unavailable or the price changes, please reply to this email or call {{advisor.phone}} so we can update the listing.</p>`,
  },
});

export const availabilityCheckMail = defineMailEvent({
  key: 'listings.availability_check',
  entity: inboundMailEntity,
  label: 'Still available? (automatic)',
  description: `Sent automatically every ${AVAILABILITY_CHECK_DAYS} days to owners of approved listings, asking whether the property is still available.`,
  mode: 'auto',
  version: 1,
  schedule: {
    everyMinutes: 60,
    expiresAfterHours: 8,
    // Office hours in India; approved listings with an email that aren't
    // marked unavailable and haven't been asked in this 30-day period.
    due: async ({ dataSource, now }) => {
      const hour = hourInIndia(now);
      if (hour < 10 || hour >= 18) return [];
      const rows: { id: number }[] = await dataSource.query(
        `SELECT i.id FROM inbounds i
          WHERE i.status = ? AND i.email IS NOT NULL AND i.email <> ''
            AND (i.inbound_status IS NULL OR i.inbound_status <> 'not_available')
            AND i.created_at <= ? - INTERVAL ? DAY
            AND NOT EXISTS (
              SELECT 1 FROM mail_outbox o
               WHERE o.idempotency_key = CONCAT('listings.availability_check:', i.id, ':',
                     FLOOR(TIMESTAMPDIFF(SECOND, i.created_at, ?) / ?)))
          ORDER BY i.created_at
          LIMIT ${AVAILABILITY_BATCH}`,
        [LISTING_APPROVED_STATUS, now, AVAILABILITY_CHECK_DAYS, now, AVAILABILITY_CHECK_DAYS * 24 * 3600],
      );
      return rows.map((r) => Number(r.id));
    },
  },
  check: (d) => {
    if (d.status !== LISTING_APPROVED_STATUS) return ['The listing is no longer approved'];
    if (d.availability === 'not_available') return ['The property is marked not available'];
    return [];
  },
  idempotencyKey: (d, id) => `listings.availability_check:${id}:${availabilityCycle(d.createdAt)}`,
  template: {
    subject: 'Is your property still available? – {{listing.reference}}',
    preheader: 'A quick check so we only show buyers and tenants what is available.',
    body: `<p>Dear {{owner.first_name}},</p>
<p>We are still promoting your property with Majestan Realty and want to make sure the details are up to date.</p>
<p>{{listing_details}}</p>
<p><strong>Is it still available at this price?</strong> Just reply to this email with "Yes", or tell us what has changed (sold, rented out, new price). You can also call {{advisor.phone}}.</p>`,
  },
});

/** listings@ emails registered with the central mail service (MailModule.forFeature). */
export const LISTING_MAIL_EVENTS = [listingReceivedMail, listingApprovedMail, availabilityCheckMail];
