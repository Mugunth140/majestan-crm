// lead-routing-bulk-assign.test.ts
import { describe, expect, it, vi } from 'vitest';
import { assignRoutingLeads } from './lead-routing';

describe('assignRoutingLeads', () => {
  it('assigns every selected lead, not just the first', async () => {
    const assignOne = vi.fn(async (_leadId: number) => {});

    const result = await assignRoutingLeads(assignOne, [11, 22, 33]);

    expect(assignOne).toHaveBeenCalledTimes(3);
    expect(assignOne).toHaveBeenNthCalledWith(1, 11);
    expect(assignOne).toHaveBeenNthCalledWith(2, 22);
    expect(assignOne).toHaveBeenNthCalledWith(3, 33);
    expect(result).toEqual({ assigned: 3, failed: 0 });
  });

  it('counts partial failures without aborting the rest', async () => {
    const assignOne = vi.fn(async (leadId: number) => {
      if (leadId === 22) throw new Error('gone');
    });

    const result = await assignRoutingLeads(assignOne, [11, 22, 33]);

    expect(assignOne).toHaveBeenCalledTimes(3);
    expect(result).toEqual({ assigned: 2, failed: 1 });
  });
});
