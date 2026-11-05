// Which sidebar modules a user sees. Admins see everything. Everyone else gets
// a default from their role (and, for Staff, their department) until an admin
// picks modules on the user's Access tab; that list then replaces the default.
// Keep NAV_KEYS in step with crm-backend/src/modules/users/nav-access.ts.

export const NAV_KEYS = [
  "scheduler", "leads", "routing", "inbound", "agent-network", "projects", "properties", "builders",
  "ads", "blog", "showcases", "asset-inventory", "hr", "tasks", "logger", "activity-logs", "users", "master",
] as const;
export type NavKey = (typeof NAV_KEYS)[number];

/** Only Admins and Managers get these, whatever is ticked; the Team Lead may also have the Logger. */
const MANAGEMENT_ONLY: Record<string, NavKey[]> = {
  "Team Lead": ["users", "tasks", "activity-logs"],
  Staff: ["users", "tasks", "activity-logs", "logger"],
};
/** Everyone below Manager starts with these, whatever their department. */
const BASE: NavKey[] = ["scheduler"];
const INVENTORY: NavKey[] = ["agent-network", "builders", "projects", "properties", "asset-inventory"];
const DEPARTMENT_MODULES: [RegExp, NavKey[]][] = [
  [/telecall/i, ["leads", "routing", ...INVENTORY]],
  [/sales/i, ["leads", "routing", "inbound", ...INVENTORY]],
  [/sourcing/i, ["inbound", "routing", "agent-network", "projects", "properties", "asset-inventory"]],
  [/collection/i, ["leads", "projects", "properties", "agent-network", "asset-inventory"]],
  [/design/i, ["ads", "showcases", "blog"]],
  [/digital/i, ["blog"]],
  [/\bhr\b/i, ["hr"]],
];

/** Modules this role can never be given (Admins and Managers have none). */
export const lockedFor = (role: string): NavKey[] => MANAGEMENT_ONLY[role] ?? (isAdminRole(role) || role === "Manager" ? [] : MANAGEMENT_ONLY.Staff);

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
  if (role === "Team Lead") return NAV_KEYS.filter((k) => k !== "master" && !lockedFor(role).includes(k));
  const keys = new Set<NavKey>(BASE);
  for (const [match, modules] of DEPARTMENT_MODULES) if (match.test(department)) modules.forEach((k) => keys.add(k));
  if (blogAccess) keys.add("blog");
  return NAV_KEYS.filter((k) => keys.has(k));
}

/** The modules this user sees. */
export function visibleNav(viewer: NavAccessViewer | null): Set<string> {
  if (!viewer) return new Set();
  if (isAdminRole(viewer.role)) return new Set(NAV_KEYS);
  const locked = lockedFor(viewer.role);
  const picked = viewer.navAccess ?? defaultNavAccess(viewer.role, viewer.department, viewer.blogAccess);
  return new Set(picked.filter((k) => !locked.includes(k as NavKey)));
}
