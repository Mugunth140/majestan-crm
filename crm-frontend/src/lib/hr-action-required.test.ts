import { describe, expect, it } from 'vitest';
import { matchesHrActionFilter, formatHrFollowUp } from './hr-action-required';

const now = new Date('2026-10-28T08:00:00Z');
const matches = (candidate: Parameters<typeof matchesHrActionFilter>[0], filter: string, mode = 'pending') =>
  matchesHrActionFilter(candidate, filter, mode, now);

describe('HR Action Required', () => {
  it.each(['Overdue', 'Yesterday', 'Today', 'Tomorrow', 'All Scheduled'])('excludes unscheduled candidates from %s', filter => {
    expect(matches({}, filter)).toBe(false);
  });
  it.each([['Overdue', '2026-10-27'], ['Today', '2026-10-28'], ['Tomorrow', '2026-10-29'], ['All Scheduled', '2026-10-30']])('matches the %s schedule', (filter, date) => {
    expect(matches({ nextFollowUpDate: date }, filter)).toBe(true);
  });
  it('keeps Later separate from tomorrow and overdue separate from today', () => {
    expect(matches({ nextFollowUpDate: '2026-10-29' }, 'All Scheduled')).toBe(false);
    expect(matches({ nextFollowUpDate: '2026-10-28' }, 'Overdue')).toBe(false);
  });
  it('finds yesterday even after an additional follow-up today', () => {
    expect(matches({ followedUpDates: ['2026-10-28', '2026-10-27'] }, 'Yesterday')).toBe(true);
  });
  it('shows completed today only when not due again today', () => {
    const candidate = { followedUpDates: ['2026-10-28'], nextFollowUpDate: '2026-10-29' };
    expect(matches(candidate, 'Today', 'completed')).toBe(true);
    expect(matches({ ...candidate, nextFollowUpDate: '2026-10-28' }, 'Today', 'completed')).toBe(false);
    expect(matches({ ...candidate, nextFollowUpDate: '2026-10-28' }, 'Today')).toBe(true);
  });
  it('does not let a hidden completed toggle affect Tomorrow', () => {
    expect(matches({ nextFollowUpDate: '2026-10-29' }, 'Tomorrow', 'completed')).toBe(true);
  });
  it('uses India midnight for the queue date', () => {
    expect(matchesHrActionFilter({ nextFollowUpDate: '2026-10-29' }, 'Today', 'pending', new Date('2026-10-28T20:00:00Z'))).toBe(true);
  });
  it('formats date and time, with a safe empty state', () => {
    expect(formatHrFollowUp('2026-10-28', '11:30:00')).toBe('28 Oct 2026 11:30');
    expect(formatHrFollowUp(null)).toBe('Not Scheduled');
  });
});
