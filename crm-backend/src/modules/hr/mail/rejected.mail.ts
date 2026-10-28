import { HrCandidateStatus } from '../../../database/entities/hr-candidate.entity';
import { defineMailEvent } from '../../mail/core/mail-event';
import { type CandidateMailData, loadCandidateMailData, positionPhrase } from './candidate-mail-data';

export const rejectedMail = defineMailEvent<CandidateMailData>({
  key: 'hr.rejected',
  module: 'hr',
  entityType: 'hr_candidate',
  identity: 'hr',
  label: 'Application update (not selected)',
  description: 'Politely lets the candidate know they were not selected this time.',
  mode: 'confirm',
  version: 1,
  triggers: [{ on: 'hr.candidate.status_changed', when: (p) => p.to === HrCandidateStatus.REJECTED }],
  load: loadCandidateMailData,
  recipients: (d) => ({ to: [d.email ?? ''] }),
  check: (d) => (d.status === HrCandidateStatus.REJECTED ? [] : ['Candidate status is not "Rejected"']),
  idempotencyKey: (_d, id) => `hr.rejected:${id}`,
  render: (d, { layout, html }) =>
    layout({
      subject: `Your application to Majestan Realty – ${positionPhrase(d)}`,
      preheader: 'An update on your application.',
      body: html`<p>Dear ${d.name},</p>
<p>Thank you for your interest in the <strong>${positionPhrase(d)}</strong> role at Majestan Realty and for the time you gave us.</p>
<p>After careful consideration, we have decided not to move forward with your application at this time. This was not an easy decision, and we will keep your details on file for future openings that may suit you.</p>
<p>We wish you every success in your career.</p>`,
      text: `Dear ${d.name},

Thank you for your interest in the ${positionPhrase(d)} role at Majestan Realty and for the time you gave us.

After careful consideration, we have decided not to move forward with your application at this time. This was not an easy decision, and we will keep your details on file for future openings that may suit you.

We wish you every success in your career.`,
    }),
});
