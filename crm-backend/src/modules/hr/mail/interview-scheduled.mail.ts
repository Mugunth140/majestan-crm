import { HrCandidateStatus } from '../../../database/entities/hr-candidate.entity';
import { defineMailEvent } from '../../mail/core/mail-event';
import { safeUrl } from '../../mail/render/html';
import { type CandidateMailData, formatLongDate, formatTime, INTERVIEW_MODE_LABELS, loadCandidateMailData, positionPhrase, todayInIndia } from './candidate-mail-data';

export const interviewScheduledMail = defineMailEvent<CandidateMailData>({
  key: 'hr.interview_scheduled',
  module: 'hr',
  entityType: 'hr_candidate',
  identity: 'hr',
  label: 'Interview invitation',
  description: 'Invites the candidate with the date, time, mode and place or link. Sent again when the interview changes.',
  mode: 'confirm',
  version: 1,
  triggers: [
    { on: 'hr.candidate.status_changed', when: (p) => p.to === HrCandidateStatus.INTERVIEW_SCHEDULED },
    { on: 'hr.candidate.interview_rescheduled' },
  ],
  load: loadCandidateMailData,
  recipients: (d) => ({ to: [d.email ?? ''] }),
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
  render: (d, { layout, html, safeUrl }) => {
    const when = d.interviewDate ? formatLongDate(d.interviewDate) : 'To be confirmed';
    const time = d.interviewTime ? `${formatTime(d.interviewTime)} (IST)` : 'To be confirmed';
    const mode = d.interviewMode ? INTERVIEW_MODE_LABELS[d.interviewMode] : 'To be confirmed';
    const link = safeUrl(d.interviewLink);
    const rows: [string, unknown][] = [
      ['Date', when],
      ['Time', time],
      ['Mode', mode],
    ];
    if (d.interviewMode === 'in_person' && d.interviewLocation) rows.push(['Venue', d.interviewLocation]);
    if (d.interviewMode === 'video' && link) rows.push(['Meeting link', html`<a href="${link}" style="color:#0052FF">${link}</a>`]);
    if (d.interviewRound) rows.push(['Round', d.interviewRound]);
    if (d.interviewer) rows.push(['Interviewer', d.interviewer]);
    const howTo =
      d.interviewMode === 'phone'
        ? 'We will call you on your registered mobile number at the scheduled time.'
        : d.interviewMode === 'video'
          ? 'Please join a few minutes early using the link above and check your camera and microphone beforehand.'
          : 'Please arrive 10 minutes early and bring a copy of your resume.';
    const textRows = rows.map(([k, v]) => `${k}: ${k === 'Meeting link' ? link : String(v)}`).join('\n');
    return layout({
      subject: `Interview invitation – ${positionPhrase(d)} at Majestan Realty`,
      preheader: `${when}, ${time}`,
      body: html`<p>Dear ${d.name},</p>
<p>Thank you for your interest in the <strong>${positionPhrase(d)}</strong> role. We would like to invite you for an interview.</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:16px 0;border-collapse:collapse;font-size:15px">
${rows.map(([k, v]) => html`<tr><td style="padding:6px 16px 6px 0;color:#6b7280;white-space:nowrap;vertical-align:top">${k}</td><td style="padding:6px 0;font-weight:600;color:#111827">${v}</td></tr>`)}
</table>
<p>${howTo}</p>
<p>Please reply to this email to confirm that you can attend, or let us know if you need a different time.</p>`,
      text: `Dear ${d.name},

Thank you for your interest in the ${positionPhrase(d)} role. We would like to invite you for an interview.

${textRows}

${howTo}

Please reply to this email to confirm that you can attend, or let us know if you need a different time.`,
    });
  },
});
