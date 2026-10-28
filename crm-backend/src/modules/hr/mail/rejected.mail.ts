import { HrCandidateStatus } from '../../../database/entities/hr-candidate.entity';
import { defineMailEvent } from '../../mail/core/mail-event';
import { candidateMailEntity } from './candidate.mail-entity';

export const rejectedMail = defineMailEvent({
  key: 'hr.rejected',
  entity: candidateMailEntity,
  label: 'Application update (not selected)',
  description: 'Politely lets the candidate know they were not selected this time.',
  mode: 'confirm',
  version: 2,
  triggers: [{ on: 'hr.candidate.status_changed', when: (p) => p.to === HrCandidateStatus.REJECTED }],
  check: (d) => (d.status === HrCandidateStatus.REJECTED ? [] : ['Candidate status is not "Rejected"']),
  idempotencyKey: (_d, id) => `hr.rejected:${id}`,
  template: {
    subject: 'Your application to Majestan Realty – {{candidate.position}}',
    preheader: 'An update on your application.',
    body: `<p>Dear {{candidate.first_name}},</p>
<p>Thank you for your interest in the <strong>{{candidate.position}}</strong> role at Majestan Realty, and for the time you gave us during the process.</p>
<p>After careful consideration, we have decided not to move forward with your application at this time. This was not an easy decision.</p>
<p>We will keep your details on file and may reach out if a suitable opening comes up. We wish you every success in your career.</p>`,
  },
});
