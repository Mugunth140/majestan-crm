import { defineMailEvent } from '../../mail/core/mail-event';
import { todayInIndia } from '../../hr/mail/candidate-mail-data';
import { leadMailEntity, type LeadMailData } from './lead.mail-entity';

export const VISIT_SCHEDULED_STATUSES = ['Site Visit Scheduled', 'Re Visit Scheduled'];
const VISIT_DONE_STATUSES = ['Site Visit Completed', 'Re Visit Completed'];

/** Tomorrow's date in India, YYYY-MM-DD. */
export function tomorrowInIndia(now = new Date()): string {
  return todayInIndia(new Date(now.getTime() + 24 * 3600_000));
}

/** Current hour in India (0–23). */
export function hourInIndia(now = new Date()): number {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', hour12: false }).format(now));
}

function visitIssues(d: LeadMailData): string[] {
  const issues: string[] = [];
  if (!d.visit) return ['Site visit date is not set (use "Schedule site visit" on the lead)'];
  if (d.visit.date < todayInIndia()) issues.push('Site visit date is in the past');
  if (!d.visit.time) issues.push('Site visit time is not set');
  if (!d.visit.location && !d.project?.address) issues.push('Meeting point is not set and the project has no address');
  return issues;
}

const visitKey = (d: LeadMailData) => `${d.visit?.date}T${d.visit?.time}:${d.visit?.location ?? ''}`;

export const enquiryReceivedMail = defineMailEvent({
  key: 'sales.enquiry_received',
  entity: leadMailEntity,
  label: 'Enquiry received',
  description: 'Thanks a new lead for their enquiry and introduces their advisor.',
  mode: 'confirm',
  version: 2,
  // A lead who booked a visit gets the visit confirmation instead.
  triggers: [{ on: 'leads.lead.created', when: (p) => !p.withVisit }],
  idempotencyKey: (_d, id) => `sales.enquiry_received:${id}`,
  template: {
    subject: 'Thank you for your enquiry – Majestan Realty',
    preheader: 'We have received your enquiry and will call you shortly.',
    body: `<p>Dear {{lead.first_name}},</p>
<p>Thank you for {{project.interest}}. We have received your enquiry, and {{advisor.name}} will call you shortly to understand your requirements.</p>
<p>{{project_button}}</p>
<p>If you would like to speak with us sooner, reply to this email or call {{advisor.phone}}.</p>`,
  },
});

export const siteVisitConfirmedMail = defineMailEvent({
  key: 'sales.site_visit_confirmed',
  entity: leadMailEntity,
  label: 'Site visit confirmation',
  description: 'Confirms the date, time and meeting point of a site visit. Created again when the visit is moved.',
  mode: 'confirm',
  version: 2,
  triggers: [{ on: 'leads.site_visit.scheduled' }],
  check: visitIssues,
  idempotencyKey: (d, id) => `sales.site_visit_confirmed:${id}:${visitKey(d)}`.slice(0, 255),
  template: {
    subject: 'Site visit confirmed – {{visit.date}}',
    preheader: '{{visit.date}}, {{visit.time}} · {{project.title}}',
    body: `<p>Dear {{lead.first_name}},</p>
<p>Thank you for scheduling a site visit with Majestan Realty. Your visit is confirmed for the date and time below.</p>
<p>{{visit_details}}</p>
<p>{{map_button}}</p>
<p>You will be met at the location by {{advisor.name}}. If you need to reschedule, reply to this email or call {{advisor.phone}}.</p>`,
  },
});

export const siteVisitReminderMail = defineMailEvent({
  key: 'sales.site_visit_reminder',
  entity: leadMailEntity,
  label: 'Site visit reminder (automatic)',
  description: 'Sent automatically on the morning before a scheduled site visit.',
  mode: 'auto',
  version: 2,
  schedule: {
    everyMinutes: 60,
    expiresAfterHours: 12,
    // From 9 AM IST, leads whose visit is tomorrow and still scheduled.
    due: async ({ dataSource, now }) => {
      if (hourInIndia(now) < 9) return [];
      const rows: { id: number }[] = await dataSource.query(
        `SELECT DISTINCT l.id FROM leads l
           JOIN lead_inquiries i ON i.lead_id = l.id
          WHERE i.visit_date = ? AND i.visit_slot IS NOT NULL
            AND l.status IN (?) AND l.email IS NOT NULL AND l.email <> ''
            AND i.id = (SELECT MAX(i2.id) FROM lead_inquiries i2 WHERE i2.lead_id = l.id AND i2.visit_date IS NOT NULL)`,
        [tomorrowInIndia(now), VISIT_SCHEDULED_STATUSES],
      );
      return rows.map((r) => Number(r.id));
    },
  },
  check: (d) => {
    if (!VISIT_SCHEDULED_STATUSES.includes(d.status)) return ['The visit is no longer scheduled'];
    if (d.visit?.date !== tomorrowInIndia()) return ['The visit is not tomorrow'];
    return visitIssues(d);
  },
  idempotencyKey: (d, id) => `sales.site_visit_reminder:${id}:${d.visit?.date}`,
  template: {
    subject: 'Site visit reminder – tomorrow at {{visit.time}}',
    preheader: '{{project.title}} · {{visit.location}}',
    body: `<p>Dear {{lead.first_name}},</p>
<p>This is a reminder of your site visit tomorrow. The details are below.</p>
<p>{{visit_details}}</p>
<p>{{map_button}}</p>
<p>We look forward to meeting you. If your plans change, reply to this email or call {{advisor.phone}}.</p>`,
  },
});

export const visitThankYouMail = defineMailEvent({
  key: 'sales.visit_thank_you',
  entity: leadMailEntity,
  label: 'Thank you for visiting',
  description: 'Thanks the customer after a site visit, with the brochure and project page.',
  mode: 'confirm',
  version: 2,
  triggers: [{ on: 'leads.lead.status_changed', when: (p) => VISIT_DONE_STATUSES.includes(String(p.to)) }],
  idempotencyKey: (d, id) => `sales.visit_thank_you:${id}:${d.visit?.date ?? d.status}`,
  template: {
    subject: 'Thank you for visiting – {{project.title}}',
    preheader: 'It was a pleasure to meet you.',
    body: `<p>Dear {{lead.first_name}},</p>
<p>Thank you for visiting {{project.title}}. It was a pleasure to show you around, and we hope the visit was useful.</p>
<p>{{brochure_button}}</p>
<p>{{project_button}}</p>
<p>You will hear from {{advisor.name}} shortly to answer any questions and help with the next steps. In the meantime, reply to this email or call {{advisor.phone}}.</p>`,
  },
});

/** No amounts or payment details in the email: the receipt comes separately. */
export const bookingConfirmedMail = defineMailEvent({
  key: 'sales.booking_confirmed',
  entity: leadMailEntity,
  label: 'Booking congratulations',
  description: 'Congratulates the customer on their booking and explains the next steps.',
  mode: 'confirm',
  version: 2,
  triggers: [{ on: 'leads.lead.status_changed', when: (p) => p.to === 'Booking Advance' }],
  check: (d) => (d.status === 'Booking Advance' ? [] : ['Lead status is not "Booking Advance"']),
  idempotencyKey: (_d, id) => `sales.booking_confirmed:${id}`,
  template: {
    subject: 'Booking confirmed – {{project.title}}',
    preheader: 'Thank you for choosing Majestan Realty.',
    body: `<p>Dear {{lead.first_name}},</p>
<p>Congratulations, and thank you for choosing Majestan Realty. We are pleased to confirm your booking at <strong>{{project.title}}</strong>.</p>
<p>Your booking receipt will follow separately, and {{advisor.name}} will guide you through the documentation and agreement.</p>
<p>If you have any questions, reply to this email or call {{advisor.phone}}.</p>`,
  },
});

/** sales@ emails registered with the central mail service (MailModule.forFeature). */
export const SALES_MAIL_EVENTS = [enquiryReceivedMail, siteVisitConfirmedMail, siteVisitReminderMail, visitThankYouMail, bookingConfirmedMail];
