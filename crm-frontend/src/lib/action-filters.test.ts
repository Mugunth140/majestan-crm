// action-filters.test.ts
import { describe, expect, it } from 'vitest';
import { ACTION_FILTERS, getActionFilterLabel } from './action-filters';

describe('action filters', () => {
  it('keeps the scheduled action-filter value stable for the leads API', () => {
    expect(ACTION_FILTERS).toContain('All Scheduled');
  });

  it('labels the scheduled bucket as later follow-ups', () => {
    expect(getActionFilterLabel('Overdue')).toBe('Overdue');
    expect(getActionFilterLabel('Yesterday')).toBe('Yesterday');
    expect(getActionFilterLabel('Today')).toBe('Today');
    expect(getActionFilterLabel('Tomorrow')).toBe('Tomorrow');
    expect(getActionFilterLabel('All Scheduled')).toBe('Later');
  });
});
