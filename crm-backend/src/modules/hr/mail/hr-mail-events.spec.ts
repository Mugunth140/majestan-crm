import { HrCandidateStatus } from '../../../database/entities/hr-candidate.entity';
import { commonVariables } from '../../mail/core/mail-composer.service';
import type { MailEventDefinition } from '../../mail/core/mail-event';
import { fillHtml, fillText } from '../../mail/render/template';
import { type CandidateMailData, formatLongDate, formatTime, toDateOnly } from './candidate-mail-data';
import { HR_MAIL_EVENTS } from '.';
import { interviewScheduledMail } from './interview-scheduled.mail';
import { offerSentMail } from './offer-sent.mail';

/** Fills an event's default template the way the composer does. */
function render(event: MailEventDefinition<CandidateMailData>, d: CandidateMailData) {
  const vars = { ...commonVariables(event.identity, null), ...event.entity.variables(d) };
  const subject = fillText(event.template.subject, vars);
  const body = fillHtml(event.template.body, vars);
  return { subject: subject.text, html: body.html, unknown: [...subject.unknown, ...body.unknown] };
}

const candidate = (over: Partial<CandidateMailData> = {}): CandidateMailData => ({
  id: 12, name: 'Priya <b>S</b>', email: 'priya@example.com', position: 'Sales Executive',
  status: HrCandidateStatus.INTERVIEW_SCHEDULED, interviewDate: '2099-11-03', interviewTime: '11:30',
  interviewMode: 'video', interviewLocation: null, interviewLink: 'https://meet.google.com/abc-defg-hij',
  interviewer: 'Anand', interviewRound: 'Round 1', ...over,
});

describe('HR mail events', () => {
  it('registers four HR emails sent from hr@', () => {
    expect(HR_MAIL_EVENTS.map((e) => e.key)).toEqual(['hr.application_received', 'hr.interview_scheduled', 'hr.offer_sent', 'hr.rejected']);
    expect(HR_MAIL_EVENTS.every((e) => e.identity === 'hr' && e.mode === 'confirm' && e.entityType === 'hr_candidate')).toBe(true);
  });

  it('only uses variables the candidate entity provides', () => {
    for (const event of HR_MAIL_EVENTS) {
      const status = { 'hr.offer_sent': HrCandidateStatus.OFFER_SENT, 'hr.rejected': HrCandidateStatus.REJECTED } as Record<string, HrCandidateStatus>;
      expect(render(event, candidate({ status: status[event.key] ?? HrCandidateStatus.INTERVIEW_SCHEDULED })).unknown).toEqual([]);
    }
  });

  it('documents every variable it provides', () => {
    const provided = Object.keys(interviewScheduledMail.entity.variables(candidate()));
    const documented = interviewScheduledMail.entity.variableDocs.map((d) => d.key);
    expect(provided.filter((k) => !documented.includes(k))).toEqual(['candidate.email']);
  });

  it('blocks an interview invitation until it has what the candidate needs', () => {
    expect(interviewScheduledMail.check!(candidate())).toEqual([]);
    expect(interviewScheduledMail.check!(candidate({ interviewTime: null, interviewMode: null }))).toEqual([
      'Interview time is not set', 'Interview mode (in person, phone or video) is not set',
    ]);
    expect(interviewScheduledMail.check!(candidate({ interviewLink: 'javascript:alert(1)' }))).toContain(
      'Video interview needs a valid meeting link (https://…)');
    expect(interviewScheduledMail.check!(candidate({ interviewMode: 'in_person', interviewLink: null }))).toContain(
      'In-person interview needs a location');
    expect(interviewScheduledMail.check!(candidate({ interviewDate: '2001-01-01' }))).toContain('Interview date is in the past');
  });

  it('renders the invitation with escaped data, details card and join button', () => {
    const mail = render(interviewScheduledMail, candidate());
    expect(mail.subject).toBe('Interview invitation – Sales Executive at Majestan Realty');
    expect(mail.html).toContain('Dear Priya,');
    expect(mail.html).toContain('11:30 AM (IST)');
    expect(mail.html).toContain('Join the interview');
    expect(mail.html).toContain('href="https://meet.google.com/abc-defg-hij"');
    expect(render(interviewScheduledMail, candidate({ name: '<b>X</b> Y' })).html).toContain('&lt;b&gt;X&lt;/b&gt;');
  });

  it('gives in-person interviews a Maps button instead of a meeting link', () => {
    const mail = render(interviewScheduledMail, candidate({ interviewMode: 'in_person', interviewLink: null, interviewLocation: 'Majestan Realty, Coimbatore' }));
    expect(mail.html).toContain('Open in Google Maps');
    expect(mail.html).toContain('google.com/maps/search');
    expect(mail.html).not.toContain('meet.google.com');
  });

  it('never puts salary in the offer email', () => {
    const mail = render(offerSentMail, candidate({ status: HrCandidateStatus.OFFER_SENT }));
    expect(mail.html).not.toMatch(/salary|ctc|₹|lakh/i);
  });

  it('formats dates and times without timezone drift', () => {
    expect(formatLongDate('2026-11-03')).toBe('Tuesday, 3 November 2026');
    expect(formatTime('00:05')).toBe('12:05 AM');
    expect(formatTime('13:00')).toBe('1:00 PM');
    expect(toDateOnly(new Date(2026, 10, 3))).toBe('2026-11-03');
    expect(toDateOnly('2026-11-03T00:00:00.000Z')).toBe('2026-11-03');
  });
});
