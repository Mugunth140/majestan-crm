// ads-access.ts
export interface AdsUser {
  role?: string | { name?: string } | null;
  department?: string | { id?: number; name?: string } | null;
}

const BYPASS_ROLES = new Set(['Admin', 'Super Admin', 'Manager']);

function roleName(user: AdsUser | null | undefined): string {
  if (!user) return '';
  return typeof user.role === 'string' ? user.role : user.role?.name ?? '';
}

function departmentName(user: AdsUser | null | undefined): string {
  const d = user?.department;
  if (!d) return '';
  return typeof d === 'string' ? d : d.name ?? '';
}

export function canViewAds(user: AdsUser | null | undefined): boolean {
  if (BYPASS_ROLES.has(roleName(user))) return true;
  return /design/i.test(departmentName(user));
}
