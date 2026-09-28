// lead-import.test.ts
import { describe, expect, it } from 'vitest';
import { getBulkImportDestination, partitionPendingImports } from './lead-import';

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
