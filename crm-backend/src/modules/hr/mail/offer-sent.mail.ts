import { HrCandidateStatus } from '../../../database/entities/hr-candidate.entity';
import { defineMailEvent } from '../../mail/core/mail-event';
import { type CandidateMailData, loadCandidateMailData, positionPhrase } from './candidate-mail-data';

/** Announces the offer only. Salary and terms go in the formal offer letter, never in this email. */
export const offerSentMail = defineMailEvent<CandidateMailData>({
  key: 'hr.offer_sent',
  module: 'hr',
  entityType: 'hr_candidate',
  identity: 'hr',
  label: 'Offer notification',
  description: 'Tells the candidate they have been selected and that the formal offer letter will follow.',
  mode: 'confirm',
  version: 1,
  triggers: [{ on: 'hr.candidate.status_changed', when: (p) => p.to === HrCandidateStatus.OFFER_SENT }],
  load: loadCandidateMailData,
  recipients: (d) => ({ to: [d.email ?? ''] }),
  check: (d) => (d.status === HrCandidateStatus.OFFER_SENT ? [] : ['Candidate status is not "Offer Sent"']),
  idempotencyKey: (_d, id) => `hr.offer_sent:${id}`,
  render: (d, { layout, html }) =>
    layout({
      subject: `Your offer from Majestan Realty – ${positionPhrase(d)}`,
      preheader: 'Congratulations, we would like you to join our team.',
      body: html`<p>Dear ${d.name},</p>
<p>Congratulations! We are pleased to offer you the position of <strong>${positionPhrase(d)}</strong> at Majestan Realty.</p>
<p>Our HR team will share your formal offer letter with the complete details and will be in touch about the joining formalities.</p>
<p>If you have any questions in the meantime, simply reply to this email.</p>`,
      text: `Dear ${d.name},

Congratulations! We are pleased to offer you the position of ${positionPhrase(d)} at Majestan Realty.

Our HR team will share your formal offer letter with the complete details and will be in touch about the joining formalities.

If you have any questions in the meantime, simply reply to this email.`,
    }),
});
