jest.mock('bun', () => ({ S3Client: jest.fn() }), { virtual: true });
import { combineTargets } from './dashboard.service';
import type { TargetRow } from './types';

const row = (personId: number, metric: string, n: number): TargetRow => ({
  personId, name: `P${personId}`, metric, label: metric, unit: 'count', monthly: 100 * n, achieved: 50 * n, expected: 60 * n,
  week: { target: 25 * n, achieved: 10 * n, number: 4 }, today: { goal: 5 * n, achieved: 2 * n }, forecast: 90 * n,
});

describe('department targets', () => {
  it('adds everyone’s targets up per metric instead of listing each person', () => {
    const out = combineTargets([row(1, 'calls', 1), row(2, 'calls', 2), row(1, 'talk', 1)]);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ personId: 0, metric: 'calls', monthly: 300, achieved: 150, expected: 180, forecast: 270,
      week: { target: 75, achieved: 30, number: 4 }, today: { goal: 15, achieved: 6 } });
    expect(out[1]).toMatchObject({ metric: 'talk', monthly: 100 });
  });
});
