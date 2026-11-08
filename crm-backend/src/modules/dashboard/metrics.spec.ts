import { DEPT_METRICS, HEADLINE, SCORE_METRICS, addCounters, compute, deptKeyOf, median, percentile, type DeptKey } from './metrics';

describe('dashboard metrics', () => {
  it('maps department names to their team', () => {
    expect(deptKeyOf('Telecalling Department')).toBe('telecalling');
    expect(deptKeyOf('Sales Department')).toBe('sales');
    for (const name of ['Finance', 'CRM', 'Collection', 'Collections']) expect(deptKeyOf(name)).toBe('collection');
    expect(deptKeyOf('Digital Marketing')).toBe('digital');
    expect(deptKeyOf('Inbound Sourcing')).toBe('sourcing');
    expect(deptKeyOf('HR')).toBe('hr');
    expect(deptKeyOf(null)).toBe('other');
  });

  it('only headlines and scores metrics that the department defines', () => {
    for (const dept of Object.keys(DEPT_METRICS) as DeptKey[]) {
      const keys = new Set(DEPT_METRICS[dept].map(d => d.key));
      for (const k of HEADLINE[dept]) expect(`${dept}:${k}:${keys.has(k)}`).toBe(`${dept}:${k}:true`);
      for (const [k] of SCORE_METRICS[dept]) expect(`${dept}:${k}:${keys.has(k)}`).toBe(`${dept}:${k}:true`);
    }
  });

  it('returns null instead of NaN for an empty ratio', () => {
    const rate = DEPT_METRICS.telecalling.find(d => d.fmt === 'pct')!;
    expect(compute(rate, {}, 6)).toBeNull();
    expect(compute(rate, undefined, 6)).toBeNull();
  });

  it('ranks against peers in the direction that is better', () => {
    expect(percentile(10, [10, 5, 1], 'up')).toBe(100);
    expect(percentile(1, [10, 5, 1], 'up')).toBe(0);
    expect(percentile(1, [10, 5, 1], 'down')).toBe(100);
    expect(percentile(5, [5, 5], 'up')).toBe(50);
    expect(percentile(5, [5], 'up')).toBeNull();
  });

  it('takes the median and sums counters', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    expect(median([])).toBeNull();
    expect(addCounters({ a: 1 }, { a: 2, b: '3' as unknown as number })).toEqual({ a: 3, b: 3 });
  });
});
