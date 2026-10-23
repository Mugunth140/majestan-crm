import { describe, expect, it } from 'vitest';
import { normalizeDepartment } from './department';

describe('normalizeDepartment', () => {
  it('maps the seeded Sales department name to the sales pipeline', () => {
    expect(normalizeDepartment('Sales Department')).toBe('sales');
    expect(normalizeDepartment('sales')).toBe('sales');
    expect(normalizeDepartment('SALES DEPARTMENT')).toBe('sales');
  });

  it('maps the seeded Telecalling department name to telecalling', () => {
    expect(normalizeDepartment('Telecalling Department')).toBe('telecalling');
    expect(normalizeDepartment('telecalling')).toBe('telecalling');
  });

  it('falls back to telecalling when the department is missing', () => {
    expect(normalizeDepartment('')).toBe('telecalling');
    expect(normalizeDepartment(null)).toBe('telecalling');
    expect(normalizeDepartment(undefined)).toBe('telecalling');
  });
});
