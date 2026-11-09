/**
 * The leads a user may see, as an SQL condition on alias `l` (starts with AND).
 * Shared by the Leads list and the global search so both show the same leads.
 */
export function leadScopeSql(user?: { id?: number; role?: string; department?: string; department_id?: number } | null): string {
  if (user && user.role === 'Staff') return `AND l.assigned_staff_id = ${Number(user.id)}`;
  if (user && user.role === 'Team Lead') {
    // A Team Lead owns a pipeline, not a staff list: a lead moved to Sales
    // keeps its old owner, so filtering by the owner's department would hide
    // it from Sales. Unknown departments keep the old owner-based scope.
    const deptName = String(user.department ?? '');
    const leadDept = /sales/i.test(deptName) ? 'sales'
      : /telecalling/i.test(deptName) ? 'telecalling'
      : null;
    return leadDept
      ? `AND l.department = '${leadDept}' AND l.assigned_staff_id IS NOT NULL`
      : `AND l.assigned_staff_id IN (SELECT id FROM users WHERE department_id = ${Number(user.department_id)})`;
  }
  return `AND l.assigned_staff_id IS NOT NULL`;
}
