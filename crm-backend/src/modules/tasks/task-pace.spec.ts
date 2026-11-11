import { computePace, fittedWeeks } from './task-pace';

const days = (entries: Record<string, number>) => new Map(Object.entries(entries));
const target = { monthly: 400, weeks: [100, 100, 100, 100] };

describe('computePace', () => {
  it('carries an earlier week’s shortfall into this week and splits it over the days left', () => {
    // Week 1 (1–7 Nov) made 60 of 100; Wednesday 11 Nov is in week 2.
    const pace = computePace(target, days({ '2026-11-03': 60, '2026-11-09': 20, '2026-11-11': 5 }), '2026-11', '2026-11-11');
    expect(pace.week).toMatchObject({ number: 2, base: 100, carried: 40, target: 140, achieved: 25, remaining: 115 });
    // 140 − 20 done before today, over Wed–Sat (4 working days) = 30.
    expect(pace.today).toEqual({ goal: 30, achieved: 5, remaining: 25 });
    expect(pace.achieved).toBe(85);
    expect(pace.byWeek.slice(1)).toEqual([60, 25, 0, 0]);
  });

  it('judges pace on finished days, so an empty morning is not behind', () => {
    // 25 working days in November: 48 by the end of the 4th is exactly on pace.
    const steady = computePace(target, days({ '2026-11-02': 16, '2026-11-03': 16, '2026-11-04': 16 }), '2026-11', '2026-11-05');
    expect(steady.status).toBe('on_pace');
    expect(computePace(target, days({ '2026-11-02': 60 }), '2026-11', '2026-11-05').status).toBe('ahead');
    const slow = computePace(target, days({ '2026-11-02': 2 }), '2026-11', '2026-11-05');
    expect(slow.status).toBe('behind');
  });

  it('sets no goal on Sunday', () => {
    expect(computePace(target, days({}), '2026-11', '2026-11-08').today.goal).toBe(0);
  });

  it('closes past months and leaves planned ones untouched', () => {
    expect(computePace(target, days({ '2026-10-05': 400 }), '2026-10', '2026-11-11').status).toBe('done');
    const missed = computePace(target, days({ '2026-10-05': 120 }), '2026-10', '2026-11-11');
    expect(missed).toMatchObject({ status: 'missed', remaining: 280, expected: 400 });
    expect(missed.today.goal).toBe(0);
    const planned = computePace(target, days({}), '2026-12', '2026-11-11');
    expect(planned).toMatchObject({ status: 'upcoming', expected: 0, daily: [] });
  });

  it('ignores days outside the month', () => {
    expect(computePace(target, days({ '2026-10-31': 50, '2026-11-02': 10 }), '2026-11', '2026-11-03').achieved).toBe(10);
  });
});

describe('weekly split that no longer matches the month', () => {
  it('uses the even split, so today has a goal', () => {
    expect(fittedWeeks(4160, [1, 1, 1, 2])).toEqual([1040, 1040, 1040, 1040]);
    expect(fittedWeeks(1950, [487, 487, 487, 489])).toEqual([487, 487, 487, 489]);
    expect(fittedWeeks(10, [0, 0, 0, 10])).toEqual([0, 0, 0, 10]);
    // 66 calls before today, in week 2 of November 2026, with the bad split stored
    const days = new Map([['2026-11-09', 66], ['2026-11-11', 89]]);
    const pace = computePace({ monthly: 4160, weeks: [1, 1, 1, 2] }, days, '2026-11', '2026-11-11');
    expect(pace.week.target).toBeGreaterThan(1000);
    expect(pace.today.goal).toBeGreaterThan(0);
  });
});
