import { HrCandidateStatus } from '../../../database/entities/hr-candidate.entity';
import { html, safeUrl } from '../../mail/render/html';
import { renderLayout } from '../../mail/render/layout';
import { CandidateMailData, formatLongDate, formatTime, toDateOnly } from './candidate-mail-data';
import { HR_MAIL_EVENTS } from '.';
import { interviewScheduledMail } from './interview-scheduled.mail';
import { offerSentMail } from './offer-sent.mail';

const ctx = { layout: (input: any) => renderLayout(input, { signature: 'HR Team' }), html, safeUrl };
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
    expect(interviewScheduledMail.check!(candidate({ status: HrCandidateStatus.REJECTED }))).toContain(
      'Candidate status is not "Interview Scheduled"');
  });

  it('renders the invitation with escaped candidate data and the meeting link', () => {
    const mail = interviewScheduledMail.render(candidate(), ctx);
    expect(mail.subject).toBe('Interview invitation – Sales Executive at Majestan Realty');
    expect(mail.html).toContain('Priya &lt;b&gt;S&lt;/b&gt;');
    expect(mail.html).toContain('href="https://meet.google.com/abc-defg-hij"');
    expect(mail.html).toContain('11:30 AM (IST)');
    expect(mail.text).toContain('Meeting link: https://meet.google.com/abc-defg-hij');
  });

  it('makes a new invitation key when the interview changes', () => {
    const a = interviewScheduledMail.idempotencyKey(candidate(), 12);
    expect(interviewScheduledMail.idempotencyKey(candidate({ interviewTime: '15:00' }), 12)).not.toBe(a);
    expect(interviewScheduledMail.idempotencyKey(candidate(), 12)).toBe(a);
  });

  it('never puts salary in the offer email', () => {
    const mail = offerSentMail.render(candidate({ status: HrCandidateStatus.OFFER_SENT }), ctx);
    expect(mail.html).not.toMatch(/salary|ctc|₹|lakh/i);
    expect(offerSentMail.check!(candidate({ status: HrCandidateStatus.OFFER_SENT }))).toEqual([]);
  });

  it('formats dates and times without timezone drift', () => {
    expect(formatLongDate('2026-11-03')).toBe('Tuesday, 3 November 2026');
    expect(formatTime('00:05')).toBe('12:05 AM');
    expect(formatTime('13:00')).toBe('1:00 PM');
    expect(toDateOnly(new Date(2026, 10, 3))).toBe('2026-11-03');
    expect(toDateOnly('2026-11-03T00:00:00.000Z')).toBe('2026-11-03');
  });
});
