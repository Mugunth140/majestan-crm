import { defineMailEvent } from '../../mail/core/mail-event';
import { partnerMailEntity } from './partner.mail-entity';

export const PARTNER_APPROVED_STATUS = 'Approved';

export const partnerIntroductionMail = defineMailEvent({
  key: 'partners.introduction',
  entity: partnerMailEntity,
  label: 'Thanks for connecting',
  description: 'Thanks a new partner for connecting and introduces Majestan Realty and their contact person.',
  mode: 'confirm',
  version: 2,
  triggers: [{ on: 'partners.agent.created' }],
  idempotencyKey: (_d, id) => `partners.introduction:${id}`,
  template: {
    subject: 'Thank you for connecting – Majestan Realty',
    preheader: 'Working together on property deals in {{partner.city}}.',
    body: `<p>Dear {{partner.first_name}},</p>
<p>Thank you for taking the time to connect with Majestan Realty. We work with brokers, referral partners and builders to bring the right buyers, tenants and properties together, and we would be glad to work with you.</p>
<p>Your point of contact will be {{manager.name}}, who will share our current projects and explain how our partner programme works.</p>
<p>If you already have a client or property in mind, reply to this email or call {{manager.phone}}.</p>`,
  },
});

export const partnerWelcomeMail = defineMailEvent({
  key: 'partners.welcome',
  entity: partnerMailEntity,
  label: 'Welcome partner',
  description: 'Welcomes an approved partner and confirms the agreed commission terms.',
  mode: 'confirm',
  version: 2,
  triggers: [{ on: 'partners.agent.status_changed', when: (p) => p.to === PARTNER_APPROVED_STATUS }],
  check: (d) => {
    const issues: string[] = [];
    if (d.status !== PARTNER_APPROVED_STATUS) issues.push(`Partner status is not "${PARTNER_APPROVED_STATUS}"`);
    if (!d.commission) issues.push('Commission terms are not set (edit the partner and fill in commission)');
    return issues;
  },
  idempotencyKey: (_d, id) => `partners.welcome:${id}`,
  template: {
    subject: 'Welcome to the Majestan Realty partner network',
    preheader: 'Your partnership is confirmed.',
    body: `<p>Dear {{partner.first_name}},</p>
<p>We are pleased to confirm your partnership with Majestan Realty. A summary of what we agreed is below.</p>
<p>{{partner_details}}</p>
<p>To refer a client or a property, reply to this email or call {{manager.phone}}. We will keep you updated at every stage, and commission is settled once the deal closes.</p>
<p>We look forward to working with you.</p>`,
  },
});

/** partners@ emails registered with the central mail service (MailModule.forFeature). */
export const PARTNER_MAIL_EVENTS = [partnerIntroductionMail, partnerWelcomeMail];
