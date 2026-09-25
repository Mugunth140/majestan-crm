// pagination.test.ts
import { describe, expect, it } from 'vitest';
import { resetPageIndex } from './pagination';

describe('resetPageIndex', () => {
  it('returns table state to the first page while preserving page size', () => {
    expect(resetPageIndex({ pageIndex: 3, pageSize: 10 })).toEqual({
      pageIndex: 0,
      pageSize: 10,
    });
  });
});
