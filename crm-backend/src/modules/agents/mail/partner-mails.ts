import { defineMailEvent } from '../../mail/core/mail-event';
import { partnerMailEntity } from './partner.mail-entity';

export const PARTNER_APPROVED_STATUS = 'Approved';

export const partnerIntroductionMail = defineMailEvent({
  key: 'partners.introduction',
  entity: partnerMailEntity,
  label: 'Thanks for connecting',
  description: 'Thanks a new partner for connecting and introduces Majestan Realty and their contact person.',
  mode: 'confirm',
  version: 1,
  triggers: [{ on: 'partners.agent.created' }],
  idempotencyKey: (_d, id) => `partners.introduction:${id}`,
  template: {
    subject: 'Great to connect with you – Majestan Realty',
    preheader: 'Working together on property deals in {{partner.city}}.',
    body: `<p>Dear {{partner.first_name}},</p>
<p>Thank you for taking the time to connect with Majestan Realty. We work with brokers, referral partners and builders to bring the right buyers, tenants and properties together, and we would be glad to work with you.</p>
<p><strong>{{manager.name}}</strong> will be your point of contact and will share our current projects and how our partner programme works.</p>
<p>If you have a client or property in mind already, just reply to this email or call {{manager.phone}}.</p>`,
  },
});

export const partnerWelcomeMail = defineMailEvent({
  key: 'partners.welcome',
  entity: partnerMailEntity,
  label: 'Welcome partner',
  description: 'Welcomes an approved partner and confirms the agreed commission terms.',
  mode: 'confirm',
  version: 1,
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
<p>Welcome aboard! We are pleased to confirm you as a Majestan Realty partner. Here is a summary of what we agreed:</p>
<p>{{partner_details}}</p>
<p>To refer a client or a property, reply to this email or call {{manager.name}} on {{manager.phone}}. We will keep you updated at every step, and commission is settled once the deal closes.</p>
<p>We look forward to a long and successful partnership.</p>`,
  },
});

/** partners@ emails registered with the central mail service (MailModule.forFeature). */
export const PARTNER_MAIL_EVENTS = [partnerIntroductionMail, partnerWelcomeMail];
