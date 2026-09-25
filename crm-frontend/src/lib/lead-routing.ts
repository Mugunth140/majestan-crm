// lead-routing.ts
const SELF_CLAIM_ROLES = ['Staff', 'Team Lead', 'Manager'];

export function canTakeLeadFromQueue(role: string | null | undefined): boolean {
  return !!role && SELF_CLAIM_ROLES.includes(role);
}

export interface BulkAssignResult {
  assigned: number;
  failed: number;
}

export async function assignRoutingLeads(
  assignOne: (leadId: number) => Promise<void>,
  leadIds: number[],
): Promise<BulkAssignResult> {
  const outcomes = await Promise.all(
    leadIds.map(async (leadId) => {
      try {
        await assignOne(leadId);
        return true;
      } catch {
        return false;
      }
    }),
  );
  return {
    assigned: outcomes.filter(Boolean).length,
    failed: outcomes.filter((ok) => !ok).length,
  };
}
