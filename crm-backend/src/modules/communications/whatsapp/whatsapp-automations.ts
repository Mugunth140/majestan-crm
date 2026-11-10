import type { DataSource } from 'typeorm';
import {
  leadMailEntity,
  loadLeadMailData,
  type LeadMailData,
} from '../../leads/mail/lead.mail-entity';
import {
  hourInIndia,
  tomorrowInIndia,
  VISIT_SCHEDULED_STATUSES,
} from '../../leads/mail/sales-mails';
import { todayInIndia } from '../../hr/mail/candidate-mail-data';

/**
 * Automatic WhatsApp messages to leads. Each one sends an approved template from
 * WhatsApp Manager; creating the template with this exact name (and getting it
 * approved) is what switches the automation on. Until then it is skipped.
 *
 * Template variables can be numbered ({{1}}, {{2}}…, filled in `order`) or named
 * ({{name}}, {{property_name}}, {{visit_date}}, {{visit_time}}…, filled by the
 * keys of automationValues), whichever the template was created with.
 */
export interface WhatsappAutomation {
  key: string;
  label: string;
  /** Template name in WhatsApp Manager. */
  template: string;
  /** Sent instead when the same automation already went out for an earlier version (a moved visit). */
  changedTemplate?: string;
  triggers?: {
    on: string;
    when?: (payload: Record<string, unknown>) => boolean;
  }[];
  /** Leads to message on a schedule, checked every `everyMinutes`. */
  schedule?: {
    everyMinutes: number;
    due: (ctx: { dataSource: DataSource; now: Date }) => Promise<number[]>;
  };
  /** Reasons not to send right now; empty means go ahead. */
  check?: (d: LeadMailData) => string[];
  /** Same key = same message: it is sent once. */
  dedupeKey: (d: LeadMailData) => string;
  /** Groups messages that are versions of each other (every confirmation for one lead). */
  groupKey?: (d: LeadMailData) => string;
  /** Values for {{1}}, {{2}}… in order. */
  order: string[];
}

const VISIT_DONE_STATUSES = ['Site Visit Completed', 'Re Visit Completed'];
const visitKey = (d: LeadMailData) =>
  `${d.visit?.date}T${d.visit?.time}:${d.visit?.location ?? ''}`;

function visitIssues(d: LeadMailData): string[] {
  if (!d.visit) return ['No site visit date'];
  const issues: string[] = [];
  if (d.visit.date < todayInIndia()) issues.push('The visit date has passed');
  if (!d.visit.time) issues.push('No visit time');
  return issues;
}

export const WHATSAPP_AUTOMATIONS: WhatsappAutomation[] = [
  {
    key: 'enquiry_received',
    label: 'Enquiry received',
    template: 'enquiry_received',
    triggers: [{ on: 'leads.lead.created', when: (p) => !p.withVisit }],
    dedupeKey: (d) => `enquiry_received:${d.id}`,
    order: ['first_name', 'project'],
  },
  {
    key: 'site_visit_confirmed',
    label: 'Site visit confirmation',
    template: 'site_visit_confirmed',
    changedTemplate: 'site_visit_rescheduled',
    triggers: [{ on: 'leads.site_visit.scheduled' }],
    check: visitIssues,
    dedupeKey: (d) =>
      `site_visit_confirmed:${d.id}:${visitKey(d)}`.slice(0, 255),
    groupKey: (d) => `site_visit_confirmed:${d.id}:`,
    order: ['first_name', 'project', 'visit_date', 'visit_time'],
  },
  {
    key: 'site_visit_reminder',
    label: 'Site visit reminder (day before)',
    template: 'site_visit_reminder',
    schedule: {
      everyMinutes: 30,
      // From 9 AM IST, leads whose visit is tomorrow and still scheduled.
      due: async ({ dataSource, now }) => {
        if (hourInIndia(now) < 9) return [];
        const rows: { id: number }[] = await dataSource.query(
          `SELECT DISTINCT l.id FROM leads l
             JOIN lead_inquiries i ON i.lead_id = l.id
            WHERE i.visit_date = ? AND i.visit_slot IS NOT NULL AND l.status IN (?)
              AND i.id = (SELECT MAX(i2.id) FROM lead_inquiries i2 WHERE i2.lead_id = l.id AND i2.visit_date IS NOT NULL)`,
          [tomorrowInIndia(now), VISIT_SCHEDULED_STATUSES],
        );
        return rows.map((r) => Number(r.id));
      },
    },
    check: (d) => {
      if (!VISIT_SCHEDULED_STATUSES.includes(d.status))
        return ['The visit is no longer scheduled'];
      if (d.visit?.date !== tomorrowInIndia())
        return ['The visit is not tomorrow'];
      return visitIssues(d);
    },
    dedupeKey: (d) => `site_visit_reminder:${d.id}:${d.visit?.date}`,
    order: ['first_name', 'project', 'visit_date', 'visit_time'],
  },
  {
    key: 'visit_thank_you',
    label: 'Thank you for visiting',
    template: 'visit_thank_you',
    triggers: [
      {
        on: 'leads.lead.status_changed',
        when: (p) => VISIT_DONE_STATUSES.includes(String(p.to)),
      },
    ],
    dedupeKey: (d) => `visit_thank_you:${d.id}:${d.visit?.date ?? d.status}`,
    order: ['first_name', 'project', 'advisor', 'link'],
  },
  {
    key: 'booking_confirmed',
    label: 'Booking congratulations',
    template: 'booking_confirmed',
    triggers: [
      {
        on: 'leads.lead.status_changed',
        when: (p) => p.to === 'Booking Advance',
      },
    ],
    check: (d) =>
      d.status === 'Booking Advance'
        ? []
        : ['The lead is no longer at Booking Advance'],
    dedupeKey: (d) => `booking_confirmed:${d.id}`,
    order: ['first_name', 'project', 'advisor', 'advisor_phone'],
  },
];

/** WhatsApp variables can't hold line breaks, tabs or long runs of spaces. */
const oneLine = (value: string) =>
  value
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/ {4,}/g, '   ')
    .trim();

/** Every value an automation template may use, by name, from the same data the sales emails use. */
export function automationValues(d: LeadMailData): Record<string, string> {
  const v = leadMailEntity.variables(d) as Record<string, unknown>;
  const text = (key: string) =>
    typeof v[key] === 'string' ? oneLine(v[key]) : '';
  return {
    first_name: text('lead.first_name') || 'there',
    name: text('lead.name') || 'there',
    project: text('project.title'),
    // Names a template may use for the same value.
    property_name: text('project.title'),
    visit_date: text('visit.date'),
    visit_time: text('visit.time'),
    meeting_point:
      text('visit.location') ||
      'the site office (your advisor will share the location)',
    advisor: text('advisor.name'),
    advisor_phone: text('advisor.phone'),
    link: text('project.url') || 'https://www.majestanrealty.com',
  };
}

export { loadLeadMailData };
