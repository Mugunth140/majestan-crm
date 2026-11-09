import { INBOUND_CALL_TRACKING, VIEW_PROPERTY_CONTACTS } from "./permissions";

// Role ids as seeded: 1 Admin, 2 Manager, 3 Team Lead, 4 Staff.
/** Team Leads and Staff work inside one department; Admins and Managers see all of them. */
export const needsDepartment = (roleId?: string | number | null) => ["3", "4"].includes(String(roleId ?? ""));

/** Fine-grained access an admin can switch on per user. Other granted keys are left alone. */
export const USER_PERMISSIONS = [
  {
    key: VIEW_PROPERTY_CONTACTS,
    title: "See property owner and agent contacts",
    description: "Anyone can enter them on a new property; this lets them see and edit them afterwards. Admins always can.",
  },
  {
    key: INBOUND_CALL_TRACKING,
    title: "See inbound owner contacts",
    description: "Anyone can enter them on a new inbound; this lets them see them afterwards and logs calls to active inbounds from the call logger. Admins and Managers always can.",
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
