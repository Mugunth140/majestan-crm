// lead-import.test.ts
import { describe, expect, it } from 'vitest';
import { getBulkImportDestination } from './lead-import';

describe('getBulkImportDestination', () => {
  it('sends a successful bulk import to the routing queue, not the dashboard', () => {
    expect(getBulkImportDestination()).toBe('/lead-routing');
  });
});
