// lead-routing.ts
const SELF_CLAIM_ROLES = ['Staff', 'Team Lead', 'Manager'];

export function canTakeLeadFromQueue(role: string | null | undefined): boolean {
  return !!role && SELF_CLAIM_ROLES.includes(role);
}
