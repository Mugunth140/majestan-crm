import { BadRequestException } from '@nestjs/common';
import { addDays, istToday, parseRange, taskWeek, taskWeekBounds, workingDaysBetween } from './range';

describe('dashboard range', () => {
  // 2026-11-06 20:00 UTC is already 7 Nov in IST.
  const lateUtc = new Date('2026-11-06T20:00:00Z');

  it('uses the IST calendar day', () => {
    expect(istToday(lateUtc)).toBe('2026-11-07');
    expect(istToday(new Date('2026-11-06T10:00:00Z'))).toBe('2026-11-06');
  });

  it('builds a period and the previous one of the same length', () => {
    const r = parseRange('7d', lateUtc);
    expect(r).toMatchObject({ from: '2026-11-01', to: '2026-11-07', prevFrom: '2026-10-25', prevTo: '2026-10-31', days: 7, bucket: 'day' });
    // 1 Nov 2026 is a Sunday, the one day off.
    expect(r.workingDays).toBe(6);
    expect(r.prevWorkingDays).toBe(6);
  });

  it('buckets today by hour and six months by week', () => {
    expect(parseRange('today', lateUtc)).toMatchObject({ from: '2026-11-07', to: '2026-11-07', prevFrom: '2026-11-06', bucket: 'hour' });
    expect(parseRange('6m', lateUtc).bucket).toBe('week');
    expect(parseRange(undefined, lateUtc).key).toBe('30d');
  });

  it('rejects unknown ranges', () => {
    expect(() => parseRange('1y')).toThrow(BadRequestException);
  });

  it('counts Monday to Saturday as working days', () => {
    expect(workingDaysBetween('2026-11-01', '2026-11-01')).toBe(0);
    expect(workingDaysBetween('2026-11-02', '2026-11-08')).toBe(6);
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
  });

  it('splits months into task weeks with the remainder in week 4', () => {
    expect(['2026-11-01', '2026-11-07', '2026-11-08', '2026-11-21', '2026-11-22', '2026-11-30'].map(taskWeek)).toEqual([1, 1, 2, 3, 4, 4]);
    expect(taskWeekBounds('2026-02-25')).toEqual({ from: '2026-02-22', to: '2026-02-28' });
    expect(taskWeekBounds('2026-11-10')).toEqual({ from: '2026-11-08', to: '2026-11-14' });
  });
});
