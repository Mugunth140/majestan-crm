import { describe, expect, it } from 'vitest';
import { calculateRentPerSqft } from './rental-pricing';

describe('rent per sqft', () => {
  it('derives the rate from current monthly rent and area', () => {
    expect(calculateRentPerSqft(30000, 1200)).toBe(25);
    expect(calculateRentPerSqft(36000, 1200)).toBe(30);
    expect(calculateRentPerSqft(36000, 2400)).toBe(15);
  });
  it('converts every area unit offered by the form', () => {
    expect(calculateRentPerSqft(30000, 111.483648, 'Sq M')).toBeCloseTo(25, 6);
    expect(calculateRentPerSqft(43560, 1, 'Acres')).toBe(1);
    expect(calculateRentPerSqft(4356, 10, 'Cents')).toBe(1);
  });
  it.each([[0, 1200], [30000, 0], [-100, 1200], [30000, -1], [NaN, 1200], [30000, Infinity]])('leaves the rate empty for invalid inputs (%s, %s)', (rent, area) => {
    expect(calculateRentPerSqft(rent, area)).toBeNull();
  });
  it('does not assume a conversion for an unsupported legacy unit', () => {
    expect(calculateRentPerSqft(30000, 1200, 'unknown')).toBeNull();
  });
});
