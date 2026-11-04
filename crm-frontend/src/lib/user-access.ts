import { INBOUND_CALL_TRACKING, MANAGE_BLOG, VIEW_PROPERTY_CONTACTS } from "./permissions";

// Role ids as seeded: 1 Admin, 2 Manager, 3 Team Lead, 4 Staff.
/** Team Leads and Staff work inside one department; Admins and Managers see all of them. */
export const needsDepartment = (roleId?: string | number | null) => ["3", "4"].includes(String(roleId ?? ""));

/** The extra access an admin can switch on per user. Other granted keys are left alone. */
export const USER_PERMISSIONS = [
  {
    key: VIEW_PROPERTY_CONTACTS,
    title: "Owner and agent contacts",
    description: "See property owner and agent phone numbers and emails. Admins always can.",
  },
  {
    key: MANAGE_BLOG,
    title: "Website blog",
    description: "Write, schedule and publish website articles. Admins always can.",
  },
  {
    key: INBOUND_CALL_TRACKING,
    title: "Inbound calls and owner contacts",
    description: "See inbound owner details and log calls to active inbounds from the call logger. Admins and Managers always can.",
    /** Only offered to these roles; the others have it anyway. */
    roles: ["3", "4"],
  },
] as const;

export type UserPermission = (typeof USER_PERMISSIONS)[number];

/** Whether this permission is offered for the role (it's built in for the others). */
export const offeredFor = (p: UserPermission, roleId?: string | number | null) =>
  !("roles" in p) || (p.roles as readonly string[]).includes(String(roleId ?? ""));

/** The user's permission keys with one switched on or off. */
export const withPermission = (keys: string[], key: string, on: boolean) =>
  on ? (keys.includes(key) ? keys : [...keys, key]) : keys.filter((k) => k !== key);

/** Keys that no longer apply after a role change (inbound tracking is built in for Admin/Manager). */
export const keysForRole = (keys: string[], roleId?: string | number | null) =>
  USER_PERMISSIONS.reduce((acc, p) => (offeredFor(p, roleId) ? acc : withPermission(acc, p.key, false)), keys);

export const userCode = (id: number) => `USR${String(id).padStart(4, "0")}`;
