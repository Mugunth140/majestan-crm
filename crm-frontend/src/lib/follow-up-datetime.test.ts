// follow-up-datetime.test.ts
import { describe, expect, it } from 'vitest';
import { formatFollowUpDateTime } from './follow-up-datetime';

describe('formatFollowUpDateTime', () => {
  it('renders date only when no time is stored', () => {
    expect(formatFollowUpDateTime('2026-09-25', null)).toBe('25 Sept 2026');
    expect(formatFollowUpDateTime('2026-09-25', '')).toBe('25 Sept 2026');
  });

  it('renders stored time alongside the date', () => {
    expect(formatFollowUpDateTime('2026-09-25', '14:30:00')).toBe('25 Sept 2026 · 2:30 PM');
    expect(formatFollowUpDateTime('2026-09-25', '09:05')).toBe('25 Sept 2026 · 9:05 AM');
  });

  it('handles midnight and noon', () => {
    expect(formatFollowUpDateTime('2026-09-25', '00:15')).toBe('25 Sept 2026 · 12:15 AM');
    expect(formatFollowUpDateTime('2026-09-25', '12:00')).toBe('25 Sept 2026 · 12:00 PM');
  });

  it('falls back to date only for invalid time values', () => {
    expect(formatFollowUpDateTime('2026-09-25', 'not-a-time')).toBe('25 Sept 2026');
  });
});
