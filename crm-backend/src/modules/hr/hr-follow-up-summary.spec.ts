import { summarizeHrFollowUps } from './hr-follow-up-summary';
import { HrFollowUp } from '../../database/entities/hr-follow-up.entity';

const entry = (id: number, values: Partial<HrFollowUp> = {}) => ({
  id, created_at: new Date('2026-10-28T06:00:00Z'),
  follow_up_date: null, next_follow_up_date: null, ...values,
} as HrFollowUp);

describe('HR follow-up summary', () => {
  it('returns an empty schedule for candidates without history', () => {
    expect(summarizeHrFollowUps([])).toEqual({ nextFollowUpDate: null, nextFollowUpTime: null,
      lastFollowedUpDate: null, lastFollowedUpTime: null, followedUpDates: [] });
  });
  it('uses the latest entry and breaks creation ties by ID', () => {
    expect(summarizeHrFollowUps([
      entry(1, { next_follow_up_date: '2026-10-28' }),
      entry(2, { next_follow_up_date: '2026-10-30', next_follow_up_time: '11:00:00' }),
    ])).toMatchObject({ nextFollowUpDate: '2026-10-30', nextFollowUpTime: '11:00:00' });
  });
  it('allows a newer record to clear the current schedule', () => {
    expect(summarizeHrFollowUps([entry(2), entry(1, { next_follow_up_date: '2026-10-28' })]).nextFollowUpDate).toBeNull();
  });
  it('orders actual follow-ups by date then creation and ID, retaining history dates', () => {
    expect(summarizeHrFollowUps([
      entry(5, { follow_up_date: '2026-10-27', follow_up_time: '09:00:00' }),
      entry(2, { follow_up_date: '2026-10-28', follow_up_time: '10:00:00' }),
      entry(3, { follow_up_date: '2026-10-28', follow_up_time: '12:00:00' }),
    ])).toMatchObject({ lastFollowedUpDate: '2026-10-28', lastFollowedUpTime: '12:00:00', followedUpDates: ['2026-10-28', '2026-10-27'] });
  });
});
