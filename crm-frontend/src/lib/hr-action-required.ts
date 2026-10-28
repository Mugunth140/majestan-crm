export type HrActionCandidate = {
  nextFollowUpDate?: string | null;
  lastFollowedUpDate?: string | null;
  followedUpDates?: string[];
};

function day(value?: string | null): string | null {
  return value?.match(/^\d{4}-\d{2}-\d{2}/)?.[0] || null;
}

export function matchesHrActionFilter(candidate: HrActionCandidate, filter: string, mode: string, now = new Date()) {
  // Match the Leads queue's India calendar, independent of the device timezone.
  const today = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const yesterday = new Date(now.getTime() - 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const tomorrow = new Date(now.getTime() + 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const next = day(candidate.nextFollowUpDate);
  const followed = candidate.followedUpDates ?? (candidate.lastFollowedUpDate ? [candidate.lastFollowedUpDate] : []);
  if (filter === 'Overdue') return next !== null && next < today;
  if (filter === 'Yesterday') return followed.some(value => day(value) === yesterday);
  if (filter === 'Today') return mode === 'completed'
    ? followed.some(value => day(value) === today) && next !== today
    : next === today;
  if (filter === 'Tomorrow') return next === tomorrow;
  if (filter === 'All Scheduled') return next !== null && next > tomorrow;
  return false;
}

export function formatHrFollowUp(date?: string | null, time?: string | null): string {
  const value = day(date);
  if (!value) return 'Not Scheduled';
  const [year, month, dateOfMonth] = value.split('-').map(Number);
  const label = new Date(year, month - 1, dateOfMonth).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
  return `${label}${time ? ` ${time.slice(0, 5)}` : ''}`;
}
