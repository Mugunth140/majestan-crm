// The sidebar modules an admin can show or hide per user. Keep in step with
// crm-frontend/src/lib/nav-access.ts, which also holds the role defaults.
export const NAV_KEYS = [
  'scheduler', 'leads', 'routing', 'inbound', 'agent-network', 'projects', 'properties', 'builders',
  'ads', 'blog', 'showcases', 'asset-inventory', 'hr', 'tasks', 'logger', 'activity-logs', 'users', 'master',
] as const;

/** The known keys from a request, deduplicated; null clears the choice back to the defaults. */
export function cleanNavAccess(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  return [...new Set(value.filter((k): k is string => (NAV_KEYS as readonly string[]).includes(k)))];
}
