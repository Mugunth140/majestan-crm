import { describe, expect, it } from 'vitest';
import { normalizeDepartment, pipelineOf } from './department';

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

describe('pipelineOf', () => {
  it('maps the two lead departments', () => {
    expect(pipelineOf('Sales')).toBe('sales');
    expect(pipelineOf('Sales Department')).toBe('sales');
    expect(pipelineOf('Telecalling')).toBe('telecalling');
    expect(pipelineOf('Telecalling Department')).toBe('telecalling');
  });

  it('returns null for departments without a lead pipeline', () => {
    expect(pipelineOf('HR')).toBeNull();
    expect(pipelineOf('Management')).toBeNull();
    expect(pipelineOf(null)).toBeNull();
    expect(pipelineOf(undefined)).toBeNull();
  });
});
