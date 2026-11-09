import { HrCandidateStatus } from '../../../database/entities/hr-candidate.entity';
import { defineMailEvent } from '../../mail/core/mail-event';
import { candidateMailEntity } from './candidate.mail-entity';

/** Announces the offer only. Salary and terms go in the formal offer letter, never in this email. */
export const offerSentMail = defineMailEvent({
  key: 'hr.offer_sent',
  entity: candidateMailEntity,
  label: 'Offer notification',
  description: 'Tells the candidate they have been selected and that the formal offer letter will follow.',
  mode: 'auto',
  version: 3,
  triggers: [{ on: 'hr.candidate.status_changed', when: (p) => p.to === HrCandidateStatus.OFFER_SENT }],
  check: (d) => (d.status === HrCandidateStatus.OFFER_SENT ? [] : ['Candidate status is not "Offer Sent"']),
  idempotencyKey: (_d, id) => `hr.offer_sent:${id}`,
  template: {
    subject: 'Offer of employment – {{candidate.position}}',
    preheader: 'Congratulations from Majestan Realty.',
    body: `<p>Dear {{candidate.first_name}},</p>
<p>Congratulations. We are delighted to offer you the position of <strong>{{candidate.position}}</strong> at Majestan Realty.</p>
<p>Your formal offer letter, with the complete terms, will follow shortly. Our HR team will also guide you through the joining formalities.</p>
<p>If you have any questions, reply to this email. We look forward to welcoming you to the team.</p>`,
  },
});
