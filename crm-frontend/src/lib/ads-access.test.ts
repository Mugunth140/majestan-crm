// ads-access.test.ts
import { describe, expect, it } from 'vitest';
import { canViewAds } from './ads-access';

describe('canViewAds', () => {
  it.each(['Admin', 'Super Admin', 'Manager'])('allows role %s', (role) => {
    expect(canViewAds({ role })).toBe(true);
    expect(canViewAds({ role: { name: role } })).toBe(true);
  });

  it('allows designing department in all user shapes', () => {
    expect(canViewAds({ role: 'Staff', department: 'Designing' })).toBe(true);
    expect(canViewAds({ role: 'Staff', department: { name: 'Design' } })).toBe(true);
    expect(canViewAds({ role: 'Staff', department: { id: 4, name: 'Design Team' } })).toBe(true);
  });

  it.each(['Sales', 'Telecalling', '', undefined])('denies department %s', (department) => {
    expect(canViewAds({ role: 'Staff', department })).toBe(false);
  });

  it('denies staff with no department info', () => {
    expect(canViewAds({ role: 'Staff' })).toBe(false);
    expect(canViewAds(null)).toBe(false);
  });
});
