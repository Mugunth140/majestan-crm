// lead-import.test.ts
import { describe, expect, it } from 'vitest';
import {
  getBulkImportDestination,
  normalizeStaffId,
  partitionPendingImports,
  resolveStaffAssignments,
} from './lead-import';

describe('getBulkImportDestination', () => {
  it('sends a successful bulk import to the routing queue, not the dashboard', () => {
    expect(getBulkImportDestination()).toBe('/lead-routing');
  });
});

describe('partitionPendingImports', () => {
  const existing = {
    '9876543210': { id: 12, displayId: 'L00012', name: 'Old Buyer', staff: 'Asha' },
  };

  it('splits duplicate rows from fresh rows by normalized mobile', () => {
    const { dupes, fresh } = partitionPendingImports(
      [{ mobile: '9876543210' }, { mobile: '9999999999' }],
      existing,
    );
    expect(dupes).toHaveLength(1);
    expect(dupes[0].existing.displayId).toBe('L00012');
    expect(fresh).toHaveLength(1);
  });

  it('returns everything fresh when nothing matches', () => {
    const { dupes, fresh } = partitionPendingImports([{ mobile: '9999999999' }], {});
    expect(dupes).toHaveLength(0);
    expect(fresh).toHaveLength(1);
  });
});

describe('normalizeStaffId', () => {
  it('accepts numeric strings, numbers, and Excel float artifacts', () => {
    expect(normalizeStaffId('12')).toBe(12);
    expect(normalizeStaffId(12)).toBe(12);
    expect(normalizeStaffId('12.0')).toBe(12);
    expect(normalizeStaffId(' 7 ')).toBe(7);
  });

  it('returns undefined for empty, non-numeric, zero, and negative values', () => {
    expect(normalizeStaffId('')).toBeUndefined();
    expect(normalizeStaffId(undefined)).toBeUndefined();
    expect(normalizeStaffId(null)).toBeUndefined();
    expect(normalizeStaffId('Ravi')).toBeUndefined();
    expect(normalizeStaffId('0')).toBeUndefined();
    expect(normalizeStaffId('-3')).toBeUndefined();
  });
});

describe('resolveStaffAssignments', () => {
  const staffList = [
    { id: 12, name: 'Ravi' },
    { id: 15, name: 'Anita' },
  ];

  it('maps a known staff id to its name keyed by rawId', () => {
    const res = resolveStaffAssignments([{ rawId: 'import-0', staffId: 12 }], staffList);
    expect(res.assignments).toEqual({ 'import-0': { id: 12, name: 'Ravi' } });
    expect(res.unresolved).toEqual([]);
  });

  it('records unknown ids as unresolved and omits them from assignments', () => {
    const res = resolveStaffAssignments([{ rawId: 'import-0', staffId: 99 }], staffList);
    expect(res.assignments).toEqual({});
    expect(res.unresolved).toEqual([99]);
  });

  it('ignores rows with no staff id and rows with no rawId', () => {
    const res = resolveStaffAssignments(
      [{ rawId: 'import-0' }, { rawId: 'import-1', staffId: 15 }, { staffId: 12 }],
      staffList,
    );
    expect(res.assignments).toEqual({ 'import-1': { id: 15, name: 'Anita' } });
    expect(res.unresolved).toEqual([]);
  });

  // A blank staff name is a directory-data problem, not an unknown id: the row
  // must still import assigned so the lead is not silently orphaned.
  it('resolves a known id whose staff name is an empty string', () => {
    const res = resolveStaffAssignments(
      [{ rawId: 'import-0', staffId: 7 }],
      [{ id: 7, name: '' }],
    );
    expect(res.assignments).toEqual({ 'import-0': { id: 7, name: '' } });
    expect(res.unresolved).toEqual([]);
  });
});
