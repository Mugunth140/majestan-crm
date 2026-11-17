import { DataSource, EntityManager } from 'typeorm';

type Db = DataSource | EntityManager;

/** The lead ID staff see in the CRM: 4488 → "L04488". New notifications name leads this way. */
export const leadRef = (id: number | string) =>
  `L${String(id).padStart(5, '0')}`;

/** "L04488, L04487 and 3 more" — at most `max` IDs, then a count. */
export function leadRefs(ids: (number | string)[], max = 5): string {
  const shown = ids.slice(0, max).map(leadRef);
  const more = ids.length - shown.length;
  if (more > 0) return `${shown.join(', ')} and ${more} more`;
  if (shown.length <= 1) return shown.join('');
  return `${shown.slice(0, -1).join(', ')} and ${shown[shown.length - 1]}`;
}

/** "1 lead" / "3 leads". */
export const plural = (n: number, one: string, many = `${one}s`) =>
  `${n} ${n === 1 ? one : many}`;

const ids = (rows: { id: number | string }[]) => rows.map((r) => Number(r.id));

/** Active team leads of each person's department (people with no department have none). */
export async function teamLeadsOf(
  db: Db,
  userIds: number[],
): Promise<Map<number, number[]>> {
  const out = new Map<number, number[]>();
  const wanted = [...new Set(userIds.filter((id) => Number.isInteger(id)))];
  if (!wanted.length) return out;
  const rows: { userId: number; tlId: number }[] = await db.query(
    `SELECT u.id AS userId, tl.id AS tlId
       FROM users u
       JOIN users tl ON tl.department_id = u.department_id AND tl.is_active = 1 AND tl.id <> u.id
       JOIN roles r ON r.id = tl.role_id AND r.name = 'Team Lead'
      WHERE u.id IN (?) AND u.department_id IS NOT NULL`,
    [wanted],
  );
  for (const row of rows) {
    const list = out.get(Number(row.userId)) ?? [];
    list.push(Number(row.tlId));
    out.set(Number(row.userId), list);
  }
  return out;
}

/** Active team leads of departments whose name contains `dept` (e.g. 'telecalling', 'sales'). */
export async function teamLeadsOfDept(db: Db, dept: string): Promise<number[]> {
  return ids(
    await db.query(
      `SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id AND r.name = 'Team Lead'
       JOIN departments d ON d.id = u.department_id
      WHERE u.is_active = 1 AND LOWER(d.name) LIKE ?`,
      [`%${dept.toLowerCase()}%`],
    ),
  );
}

/** Active users holding any of these roles. */
export async function usersWithRoles(
  db: Db,
  roles: string[],
): Promise<number[]> {
  return ids(
    await db.query(
      `SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id WHERE u.is_active = 1 AND r.name IN (?)`,
      [roles],
    ),
  );
}

/** Who should hear about it, once each, minus whoever did it. */
export function audience(
  people: (number | null | undefined)[],
  exclude: (number | null | undefined)[] = [],
): number[] {
  const skip = new Set(exclude.filter((v) => v != null).map(Number));
  return [...new Set(people.filter((v) => v != null).map(Number))].filter(
    (id) => Number.isInteger(id) && !skip.has(id),
  );
}
