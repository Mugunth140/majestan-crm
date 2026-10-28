import { defineMailEntity } from '../../mail/core/mail-event';
import { button, detailsCard, link, mapsUrl } from '../../mail/render/blocks';
import { safeUrl } from '../../mail/render/html';
import {
  type CandidateMailData,
  formatLongDate,
  formatTime,
  INTERVIEW_MODE_LABELS,
  loadCandidateMailData,
  positionPhrase,
} from './candidate-mail-data';

/** HR candidates: the record behind every hr@ email. Salary and ID documents are never exposed. */
export const candidateMailEntity = defineMailEntity<CandidateMailData>({
  entityType: 'hr_candidate',
  module: 'hr',
  identity: 'hr',
  label: 'Candidate',
  load: loadCandidateMailData,
  recipients: (d) => ({ to: [d.email ?? ''] }),
  variables: (d) => {
    const when = d.interviewDate ? formatLongDate(d.interviewDate) : null;
    const time = d.interviewTime ? `${formatTime(d.interviewTime)} (IST)` : null;
    const meeting = d.interviewMode === 'video' ? safeUrl(d.interviewLink) : null;
    const venue = d.interviewMode === 'in_person' ? d.interviewLocation : null;
    return {
      'candidate.name': d.name,
      'candidate.first_name': d.name.split(/\s+/)[0] || d.name,
      'candidate.position': positionPhrase(d),
      'candidate.email': d.email ?? '',
      'interview.date': when ?? '',
      'interview.time': time ?? '',
      'interview.mode': d.interviewMode ? INTERVIEW_MODE_LABELS[d.interviewMode] : '',
      'interview.venue': venue ?? '',
      'interview.link': meeting ?? '',
      'interview.round': d.interviewRound ?? '',
      'interview.interviewer': d.interviewer ?? '',
      'interview.instructions':
        d.interviewMode === 'phone'
          ? 'We will call you on your registered mobile number at the scheduled time.'
          : d.interviewMode === 'video'
            ? 'Please join a few minutes early and check your camera and microphone beforehand.'
            : 'Please arrive 10 minutes early and bring a copy of your resume.',
      interview_details: detailsCard([
        ['Date', when],
        ['Time', time],
        ['Mode', d.interviewMode ? INTERVIEW_MODE_LABELS[d.interviewMode] : null],
        ['Venue', venue],
        ['Meeting link', link(meeting ?? '', meeting)],
        ['Round', d.interviewRound],
        ['Interviewer', d.interviewer],
      ]),
      interview_button: meeting
        ? button('Join the interview', meeting)
        : venue
          ? button('Open in Google Maps', mapsUrl(venue))
          : '',
    };
  },
  variableDocs: [
    { key: 'candidate.name', label: 'Candidate full name', sample: 'Priya Raman' },
    { key: 'candidate.first_name', label: 'Candidate first name', sample: 'Priya' },
    { key: 'candidate.position', label: 'Position applied for', sample: 'Sales Executive' },
    { key: 'interview.date', label: 'Interview date', sample: 'Monday, 2 November 2026' },
    { key: 'interview.time', label: 'Interview time', sample: '11:30 AM (IST)' },
    { key: 'interview.mode', label: 'Interview mode', sample: 'Video call' },
    { key: 'interview.venue', label: 'Interview venue (in person)', sample: 'Majestan Realty, Coimbatore' },
    { key: 'interview.link', label: 'Meeting link (video)', sample: 'https://meet.google.com/abc-defg-hij' },
    { key: 'interview.round', label: 'Interview round', sample: 'Round 1' },
    { key: 'interview.interviewer', label: 'Interviewer', sample: 'Anand' },
    { key: 'interview.instructions', label: 'What to do (depends on mode)', sample: 'Please arrive 10 minutes early and bring a copy of your resume.' },
    { key: 'interview_details', label: 'Interview details card', sample: '[date, time, mode, venue/link]', block: true },
    { key: 'interview_button', label: 'Join / directions button', sample: '[Join the interview]', block: true },
  ],
});
