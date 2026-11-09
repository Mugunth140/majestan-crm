// The sidebar modules an admin can show or hide per user, with the defaults
// for each role and department. Keep in step with
// crm-frontend/src/lib/nav-access.ts, which draws the same sidebar.
export const NAV_KEYS = [
  'analytics', 'scheduler', 'leads', 'routing', 'inbound', 'agent-network', 'projects', 'properties', 'builders',
  'ads', 'blog', 'showcases', 'asset-inventory', 'hr', 'tasks', 'logger', 'activity-logs', 'users', 'master',
] as const;
export type NavKey = (typeof NAV_KEYS)[number];

const MANAGEMENT_ONLY: Record<string, NavKey[]> = {
  'Team Lead': ['analytics', 'users', 'tasks', 'activity-logs'],
  Staff: ['analytics', 'users', 'tasks', 'activity-logs', 'logger'],
};
const BASE: NavKey[] = ['scheduler'];
const INVENTORY: NavKey[] = ['agent-network', 'builders', 'projects', 'properties', 'asset-inventory'];
const DEPARTMENT_MODULES: [RegExp, NavKey[]][] = [
  [/telecall/i, ['leads', 'routing', ...INVENTORY]],
  [/sales/i, ['leads', 'routing', 'inbound', ...INVENTORY]],
  [/sourcing/i, ['inbound', 'routing', 'agent-network', 'projects', 'properties', 'asset-inventory']],
  [/collection/i, ['leads', 'projects', 'properties', 'agent-network', 'asset-inventory']],
  [/design/i, ['ads', 'showcases', 'blog']],
  [/digital/i, ['blog']],
  [/\bhr\b/i, ['hr']],
];

const isAdminRole = (role: string) => role === 'Admin' || role === 'Super Admin';

/** Modules this role can never be given. */
export const lockedFor = (role: string): NavKey[] =>
  MANAGEMENT_ONLY[role] ?? (isAdminRole(role) || role === 'Manager' ? [] : MANAGEMENT_ONLY.Staff);

/** What a user sees before an admin picks for them. `legacyBlog` keeps blog writers granted before the sidebar picks. */
export function defaultNavAccess(role: string, department: string, legacyBlog = false): NavKey[] {
  if (isAdminRole(role) || role === 'Manager') return [...NAV_KEYS];
  if (role === 'Team Lead') return NAV_KEYS.filter((k) => k !== 'master' && !lockedFor(role).includes(k));
  const keys = new Set<NavKey>(BASE);
  for (const [match, modules] of DEPARTMENT_MODULES) if (match.test(department)) modules.forEach((k) => keys.add(k));
  if (legacyBlog) keys.add('blog');
  return NAV_KEYS.filter((k) => keys.has(k));
}

/** Whether the user's sidebar has this module. */
export function hasNavAccess(
  user: { role: string; department: string; nav_access: string[] | null; legacyBlog?: boolean },
  key: NavKey,
): boolean {
  if (isAdminRole(user.role)) return true;
  if (lockedFor(user.role).includes(key)) return false;
  return (user.nav_access ?? defaultNavAccess(user.role, user.department, user.legacyBlog)).includes(key);
}

/** The known keys from a request, deduplicated; null clears the choice back to the defaults. */
export function cleanNavAccess(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  return [...new Set(value.filter((k): k is string => (NAV_KEYS as readonly string[]).includes(k)))];
}
