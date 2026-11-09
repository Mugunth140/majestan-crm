import { defineMailEvent } from '../../mail/core/mail-event';
import { candidateMailEntity } from './candidate.mail-entity';

export const applicationReceivedMail = defineMailEvent({
  key: 'hr.application_received',
  entity: candidateMailEntity,
  label: 'Application received',
  description: 'Thanks the candidate and confirms the application is being reviewed.',
  mode: 'auto',
  version: 3,
  triggers: [{ on: 'hr.candidate.created' }],
  idempotencyKey: (_d, id) => `hr.application_received:${id}`,
  template: {
    subject: 'Application received – Majestan Realty',
    preheader: 'Thank you for applying to Majestan Realty.',
    body: `<p>Dear {{candidate.first_name}},</p>
<p>Thank you for applying for {{candidate.role}} at Majestan Realty. We have received your application, and our HR team is reviewing it.</p>
<p>If your profile matches what we are looking for, we will contact you within the next few working days about the next steps.</p>
<p>If you have any questions in the meantime, reply to this email.</p>`,
  },
});
