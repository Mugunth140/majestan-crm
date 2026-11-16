import { workMinutesBetween, waitingSql } from './first-contact';

// Times are UTC; IST is UTC+5:30, so 03:30Z is 9:00 IST and 13:00Z is 18:30 IST.
const at = (iso: string) => new Date(iso);

describe('workMinutesBetween', () => {
  it('counts plain working time within a day', () => {
    expect(workMinutesBetween(at('2026-11-10T04:30:00Z'), at('2026-11-10T05:15:00Z'))).toBe(45);
  });

  it('skips the night between two working days', () => {
    // 18:00 IST Tuesday to 10:00 IST Wednesday: 30 minutes + 60 minutes.
    expect(workMinutesBetween(at('2026-11-10T12:30:00Z'), at('2026-11-11T04:30:00Z'))).toBe(90);
  });

  it('skips Sunday', () => {
    // 18:00 IST Saturday 14 Nov to 9:30 IST Monday 16 Nov: 30 + 0 + 30.
    expect(workMinutesBetween(at('2026-11-14T12:30:00Z'), at('2026-11-16T04:00:00Z'))).toBe(60);
  });

  it('counts nothing for a lead assigned at night until work starts', () => {
    expect(workMinutesBetween(at('2026-11-10T17:00:00Z'), at('2026-11-11T03:30:00Z'))).toBe(0);
  });

  it('is never negative', () => {
    expect(workMinutesBetween(at('2026-11-11T05:00:00Z'), at('2026-11-10T05:00:00Z'))).toBe(0);
  });
});

describe('waitingSql', () => {
  it('leaves out contacted, converted, unqualified and closed leads', () => {
    const sql = waitingSql('l');
    expect(sql).toContain('l.first_contacted_at IS NULL');
    expect(sql).toContain('l.converted_to IS NULL');
    expect(sql).toContain('l.is_unqualified = 0');
    expect(sql).toContain("'Not Interested'");
    expect(sql).toContain("'Converted'");
  });
});
