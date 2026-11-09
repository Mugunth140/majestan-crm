import { describe, expect, it } from 'vitest';
import { HR_ENTITY } from '@/components/record/conversation';

describe('HR conversation entity', () => {
  it('sends follow-ups in the snake_case shape the HR API takes', () => {
    const body = HR_ENTITY.followUpBody!({
      followUpDate: '2026-11-04', followUpTime: '10:30', contactedVia: 'call', rnr: '', notes: 'Spoke about the offer',
      priority: 'high', nextFollowUpDate: '2026-11-06', nextFollowUpTime: '',
    });
    expect(body).toEqual({
      follow_up_date: '2026-11-04', follow_up_time: '10:30', contacted_via: 'call', rnr: null, notes: 'Spoke about the offer',
      priority: 'high', next_follow_up_date: '2026-11-06', next_follow_up_time: null,
    });
  });

  it('uses the HR API and the candidate mail entity', () => {
    expect(HR_ENTITY).toMatchObject({ api: 'hr', mail: 'hr_candidate', editMethod: 'PUT' });
  });
});
