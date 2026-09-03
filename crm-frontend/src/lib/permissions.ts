export const VIEW_PROPERTY_CONTACTS = 'properties.view_contacts';

function currentUser(): any {
  if (typeof window === 'undefined') return null;
  try {
    return JSON.parse(localStorage.getItem('crm_user') || '{}');
  } catch {
    return {};
  }
}

/** Namespaced permission check, e.g. can('properties.view_contacts'). Admin bypasses. */
export function can(key: string, user?: any): boolean {
  const u = user ?? currentUser();
  if (!u) return false;
  const role = u?.role?.name || u?.role || '';
  if (role === 'Admin' || role === 'Super Admin') return true;
  const perms: string[] = u?.permissions ?? [];
  return perms.includes(key);
}

export function canViewPropertyContacts(user?: any): boolean {
  return can(VIEW_PROPERTY_CONTACTS, user);
}
