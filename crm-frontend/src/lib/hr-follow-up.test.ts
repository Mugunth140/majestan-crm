import { describe, expect, it } from 'vitest';
import { toHrFollowUpPayload } from './hr-follow-up';
import { matchesHrActionFilter } from './hr-action-required';

const now = new Date('2026-10-30T08:00:00Z');

describe('HR follow-up API payload', () => {
  it('sends the date fields accepted by HR validation instead of the Leads names', () => {
    expect(toHrFollowUpPayload({ nextFollowUpDate: '2026-10-31', nextFollowUpTime: '10:30', contactedVia: 'call', priority: 'high', rnr: 'rnr1', notes: 'Discuss interview availability' }, now)).toEqual({
      follow_up_date: '2026-10-30', follow_up_time: '13:30:00', contacted_via: 'call',
      next_follow_up_date: '2026-10-31', next_follow_up_time: '10:30', priority: 'high', rnr: 'rnr1', notes: 'Discuss interview availability',
    });
  });
  it('uses India midnight when recording the actual follow-up', () => {
    expect(toHrFollowUpPayload({ notes: 'Called' }, new Date('2026-10-30T19:00:00Z'))).toMatchObject({ follow_up_date: '2026-10-31', follow_up_time: '00:30:00' });
  });
  it('keeps edited contact dates instead of replacing them with today', () => {
    expect(toHrFollowUpPayload({ followUpDate: '2026-10-28', followUpTime: '09:00', nextFollowUpDate: '2026-11-02' })).toEqual({ follow_up_date: '2026-10-28', follow_up_time: '09:00', next_follow_up_date: '2026-11-02' });
  });
  it('supports clearing a schedule without writing invalid empty DATE values', () => {
    expect(toHrFollowUpPayload({ nextFollowUpDate: '', nextFollowUpTime: '' })).toEqual({ next_follow_up_date: null, next_follow_up_time: null });
  });
  it('leaves omitted edit fields untouched', () => {
    expect(toHrFollowUpPayload({ notes: 'Corrected notes' })).toEqual({ notes: 'Corrected notes' });
  });
  it.each([['Overdue', '2026-10-29'], ['Today', '2026-10-30'], ['Tomorrow', '2026-10-31'], ['All Scheduled', '2026-11-02']])('retains a schedule needed for the %s queue', (filter, date) => {
    const saved = toHrFollowUpPayload({ nextFollowUpDate: date }, now);
    expect(matchesHrActionFilter({ nextFollowUpDate: saved.next_follow_up_date }, filter, 'pending', now)).toBe(true);
  });
  it('records actual contact so completed and yesterday queues can find it', () => {
    const saved = toHrFollowUpPayload({ nextFollowUpDate: '2026-11-02' }, now);
    const candidate = { nextFollowUpDate: saved.next_follow_up_date, lastFollowedUpDate: saved.follow_up_date };
    expect(matchesHrActionFilter(candidate, 'Today', 'completed', now)).toBe(true);
    expect(matchesHrActionFilter(candidate, 'Yesterday', 'pending', new Date('2026-10-31T08:00:00Z'))).toBe(true);
  });
});
