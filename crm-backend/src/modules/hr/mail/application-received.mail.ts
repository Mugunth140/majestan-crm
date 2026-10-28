import { defineMailEvent } from '../../mail/core/mail-event';
import { type CandidateMailData, loadCandidateMailData, positionPhrase } from './candidate-mail-data';

export const applicationReceivedMail = defineMailEvent<CandidateMailData>({
  key: 'hr.application_received',
  module: 'hr',
  entityType: 'hr_candidate',
  identity: 'hr',
  label: 'Application received',
  description: 'Thanks the candidate and confirms the application is being reviewed.',
  mode: 'confirm',
  version: 1,
  triggers: [{ on: 'hr.candidate.created' }],
  load: loadCandidateMailData,
  recipients: (d) => ({ to: [d.email ?? ''] }),
  idempotencyKey: (_d, id) => `hr.application_received:${id}`,
  render: (d, { layout, html }) =>
    layout({
      subject: `We have received your application – ${positionPhrase(d)}`,
      preheader: 'Thank you for applying to Majestan Realty.',
      body: html`<p>Dear ${d.name},</p>
<p>Thank you for your interest in the <strong>${positionPhrase(d)}</strong> role at Majestan Realty. We have received your application and our HR team is reviewing it.</p>
<p>If your profile matches what we are looking for, we will contact you about the next steps. You do not need to do anything for now.</p>`,
      text: `Dear ${d.name},

Thank you for your interest in the ${positionPhrase(d)} role at Majestan Realty. We have received your application and our HR team is reviewing it.

If your profile matches what we are looking for, we will contact you about the next steps. You do not need to do anything for now.`,
    }),
});
