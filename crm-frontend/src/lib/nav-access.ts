// Which sidebar modules a user sees. Admins see everything. Everyone else gets
// a default from their role (and, for Staff, their department) until an admin
// picks modules on the user's Access tab; that list then replaces the default.
// Keep NAV_KEYS in step with crm-backend/src/modules/users/nav-access.ts.

export const NAV_KEYS = [
  "scheduler", "leads", "routing", "inbound", "agent-network", "projects", "properties", "builders",
  "ads", "blog", "showcases", "asset-inventory", "hr", "tasks", "logger", "activity-logs", "users", "master",
] as const;
export type NavKey = (typeof NAV_KEYS)[number];

/** Oversight modules a Team Lead doesn't get by default. */
const MANAGEMENT: NavKey[] = ["logger", "activity-logs", "users", "master"];
/** Every Staff member has these, whatever their department. */
const STAFF_BASE: NavKey[] = ["scheduler", "tasks"];
const DEPARTMENT_MODULES: [RegExp, NavKey[]][] = [
  [/telecall/i, ["leads", "routing"]],
  [/sales/i, ["leads", "routing", "agent-network", "projects", "properties", "builders"]],
  [/collection/i, ["leads", "projects", "properties"]],
  [/design/i, ["ads", "showcases"]],
  [/digital/i, ["leads", "ads", "blog", "showcases"]],
  [/\bhr\b/i, ["hr", "asset-inventory"]],
  [/sourcing/i, ["routing", "inbound", "agent-network", "projects", "properties", "builders"]],
];

export const isAdminRole = (role?: string | null) => role === "Admin" || role === "Super Admin";

export interface NavAccessViewer {
  role: string;
  department: string;
  /** The admin's pick for this user; null keeps the default. */
  navAccess: string[] | null;
  /** Blog writers keep the Blog module by default. */
  blogAccess?: boolean;
}

/** What a user sees before an admin picks for them. */
export function defaultNavAccess(role: string, department: string, blogAccess = false): NavKey[] {
  if (isAdminRole(role) || role === "Manager") return [...NAV_KEYS];
  if (role === "Team Lead") return NAV_KEYS.filter((k) => !MANAGEMENT.includes(k));
  const keys = new Set<NavKey>(STAFF_BASE);
  for (const [match, modules] of DEPARTMENT_MODULES) if (match.test(department)) modules.forEach((k) => keys.add(k));
  if (blogAccess) keys.add("blog");
  return NAV_KEYS.filter((k) => keys.has(k));
}

/** The modules this user sees. */
export function visibleNav(viewer: NavAccessViewer | null): Set<string> {
  if (!viewer) return new Set();
  if (isAdminRole(viewer.role)) return new Set(NAV_KEYS);
  return new Set(viewer.navAccess ?? defaultNavAccess(viewer.role, viewer.department, viewer.blogAccess));
}
