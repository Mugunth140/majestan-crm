import { defineMailEvent } from '../../mail/core/mail-event';
import { candidateMailEntity } from './candidate.mail-entity';

export const applicationReceivedMail = defineMailEvent({
  key: 'hr.application_received',
  entity: candidateMailEntity,
  label: 'Application received',
  description: 'Thanks the candidate and confirms the application is being reviewed.',
  mode: 'confirm',
  version: 2,
  triggers: [{ on: 'hr.candidate.created' }],
  idempotencyKey: (_d, id) => `hr.application_received:${id}`,
  template: {
    subject: 'Thank you for applying – {{candidate.position}}',
    preheader: 'We have received your application to Majestan Realty.',
    body: `<p>Dear {{candidate.first_name}},</p>
<p>Thank you for applying for the <strong>{{candidate.position}}</strong> role at Majestan Realty. We have received your application and our HR team is reviewing it now.</p>
<p>If your profile is a good match, we will contact you within the next few working days about the next steps.</p>
<p>If you have any questions in the meantime, simply reply to this email.</p>`,
  },
});
