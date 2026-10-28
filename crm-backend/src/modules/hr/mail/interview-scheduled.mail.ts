import { HrCandidateStatus } from '../../../database/entities/hr-candidate.entity';
import { defineMailEvent } from '../../mail/core/mail-event';
import { safeUrl } from '../../mail/render/html';
import { todayInIndia } from './candidate-mail-data';
import { candidateMailEntity } from './candidate.mail-entity';

export const interviewScheduledMail = defineMailEvent({
  key: 'hr.interview_scheduled',
  entity: candidateMailEntity,
  label: 'Interview invitation',
  description: 'Invites the candidate with the date, time, mode and venue or meeting link. Created again when the interview changes.',
  mode: 'confirm',
  version: 2,
  triggers: [
    { on: 'hr.candidate.status_changed', when: (p) => p.to === HrCandidateStatus.INTERVIEW_SCHEDULED },
    { on: 'hr.candidate.interview_rescheduled' },
  ],
  check: (d) => {
    const issues: string[] = [];
    if (d.status !== HrCandidateStatus.INTERVIEW_SCHEDULED) issues.push('Candidate status is not "Interview Scheduled"');
    if (!d.interviewDate) issues.push('Interview date is not set');
    else if (d.interviewDate < todayInIndia()) issues.push('Interview date is in the past');
    if (!d.interviewTime) issues.push('Interview time is not set');
    if (!d.interviewMode) issues.push('Interview mode (in person, phone or video) is not set');
    if (d.interviewMode === 'in_person' && !d.interviewLocation) issues.push('In-person interview needs a location');
    if (d.interviewMode === 'video' && !safeUrl(d.interviewLink)) issues.push('Video interview needs a valid meeting link (https://…)');
    return issues;
  },
  // A changed date, time, mode or place makes a new invitation.
  idempotencyKey: (d, id) =>
    `hr.interview_scheduled:${id}:${d.interviewDate}T${d.interviewTime}:${d.interviewMode}:${d.interviewLocation ?? ''}:${d.interviewLink ?? ''}`.slice(0, 255),
  template: {
    subject: 'Interview invitation – {{candidate.position}} at Majestan Realty',
    preheader: '{{interview.date}}, {{interview.time}}',
    body: `<p>Dear {{candidate.first_name}},</p>
<p>Thank you for your interest in the <strong>{{candidate.position}}</strong> role. We are pleased to invite you for an interview.</p>
<p>{{interview_details}}</p>
<p>{{interview_button}}</p>
<p>{{interview.instructions}}</p>
<p>Please reply to this email to confirm that you can attend, or let us know if you need a different time.</p>`,
  },
});
