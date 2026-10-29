import { describe, expect, it } from 'vitest';
import { matchesInboundActionFilter } from './inbound-action-required';
const now = new Date('2026-10-29T08:00:00Z');
const matches = (record: Parameters<typeof matchesInboundActionFilter>[0], filter: string, mode: 'pending' | 'completed' = 'pending') =>
  matchesInboundActionFilter(record, filter, mode, now);

describe('Inbound Action Required', () => {
  it.each(['New Inbound', 'Contacting Owner', 'Pending Verification'])('never includes unscheduled %s in every sub-tab', status => {
    for (const filter of ['Overdue', 'Yesterday', 'Today', 'Tomorrow', 'All Scheduled']) {
      expect(matches({ status }, filter)).toBe(false);
      expect(matches({ status }, filter, 'completed')).toBe(false);
    }
  });
  it.each([['Overdue','2026-10-28'], ['Today','2026-10-29'], ['Tomorrow','2026-10-30'], ['All Scheduled','2026-10-31']])('matches only the scheduled %s bucket', (expectedFilter, nextFollowUpDate) => {
    for (const filter of ['Overdue','Today','Tomorrow','All Scheduled']) {
      expect(matches({ nextFollowUpDate }, filter)).toBe(filter === expectedFilter);
    }
  });
  it('separates Today Follow Up and Followed Up', () => {
    const completed = { nextFollowUpDate: '2026-10-30', follow_ups: [{ follow_up_date: '2026-10-29' }] };
    expect(matches(completed, 'Today')).toBe(false);
    expect(matches(completed, 'Today', 'completed')).toBe(true);
    expect(matches({ ...completed, nextFollowUpDate: '2026-10-29' }, 'Today', 'completed')).toBe(false);
    expect(matches({ ...completed, nextFollowUpDate: '2026-10-29' }, 'Today')).toBe(true);
  });
  it('includes completed follow-ups without another scheduled date', () => {
    expect(matches({ follow_ups: [{ follow_up_date: '2026-10-29' }] }, 'Today', 'completed')).toBe(true);
  });
  it('checks all actual history for Yesterday, even after following up again today', () => {
    expect(matches({ lastFollowedUpDate: '2026-10-29', follow_ups: [{ follow_up_date: '2026-10-29' }, { follow_up_date: '2026-10-28' }] }, 'Yesterday')).toBe(true);
  });
  it('ignores the hidden Today toggle in other buckets', () => {
    expect(matches({ nextFollowUpDate: '2026-10-30' }, 'Tomorrow', 'completed')).toBe(true);
  });
  it.each(['Closed','Rejected'])('excludes %s unless explicitly filtered', status => {
    expect(matches({ status, nextFollowUpDate: '2026-10-29' }, 'Today')).toBe(false);
    expect(matchesInboundActionFilter({ status, nextFollowUpDate: '2026-10-29' }, 'Today', 'pending', now, status)).toBe(true);
  });
  it('keeps Queue records out of Action Required', () => {
    expect(matches({ is_queued: true, nextFollowUpDate: '2026-10-29' }, 'Today')).toBe(false);
  });
  it('uses India calendar dates across UTC midnight', () => {
    expect(matchesInboundActionFilter({ nextFollowUpDate: '2026-10-30' }, 'Today', 'pending', new Date('2026-10-29T19:00:00Z'))).toBe(true);
  });
});
