/**
 * Query string of the paged HR list (`GET /api/v1/hr?page=…`), turned into
 * SQL conditions on `hr_candidates` aliased as `c`. The rules match what the
 * HR page used to do in the browser over the full list.
 */
export interface HrListQuery {
  page?: unknown;
  limit?: unknown;
  /** "Rejected" shows rejected candidates; anything else shows the rest. */
  tab?: unknown;
  search?: unknown;
  /** YYYY-MM-DD, compared with the India calendar day the candidate was created. */
  dateFrom?: unknown;
  dateTo?: unknown;
  department?: unknown;
  status?: unknown;
  /** A user id, or `unassigned`. */
  staff?: unknown;
  position?: unknown;
}

export const HR_UNASSIGNED = 'unassigned';
export const HR_MAX_PAGE_SIZE = 200;

export type HrCondition = { sql: string; params: Record<string, unknown> };

const text = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const escapeLike = (value: string) => value.replace(/[\\%_]/g, (c) => '\\' + c);
// Rows are stored in UTC; staff work on the India calendar (as the page did in the browser).
const IST_DAY = "DATE(CONVERT_TZ(c.createdAt, '+00:00', '+05:30'))";
// The page shows ids as HRC0001; JS padStart never truncates, so neither may LPAD.
const FORMATTED_ID = "CONCAT('hrc', IF(c.id < 1000, LPAD(c.id, 4, '0'), c.id))";

export function hrPage(query: HrListQuery): { page: number; limit: number } {
  const page = Math.max(1, Math.floor(Number(text(query.page)) || 1));
  const limit = Math.min(
    HR_MAX_PAGE_SIZE,
    Math.max(1, Math.floor(Number(text(query.limit)) || 20)),
  );
  return { page, limit };
}

export function hrListConditions(query: HrListQuery): HrCondition[] {
  const conditions: HrCondition[] = [];

  conditions.push(
    text(query.tab) === 'Rejected'
      ? { sql: "c.status = 'Rejected'", params: {} }
      : { sql: "c.status <> 'Rejected'", params: {} },
  );

  const search = text(query.search).toLowerCase();
  if (search) {
    conditions.push({
      sql: `(LOWER(c.name) LIKE :search OR ${FORMATTED_ID} LIKE :search OR c.mobile LIKE :search OR LOWER(c.department) LIKE :search OR LOWER(c.position) LIKE :search)`,
      params: { search: `%${escapeLike(search)}%` },
    });
  }

  const dateFrom = text(query.dateFrom);
  if (DAY.test(dateFrom))
    conditions.push({ sql: `${IST_DAY} >= :dateFrom`, params: { dateFrom } });
  const dateTo = text(query.dateTo);
  if (DAY.test(dateTo))
    conditions.push({ sql: `${IST_DAY} <= :dateTo`, params: { dateTo } });

  const department = text(query.department);
  if (department)
    conditions.push({
      sql: 'c.department = :department',
      params: { department },
    });

  const status = text(query.status);
  if (status)
    conditions.push({ sql: 'c.status = :status', params: { status } });

  const staff = text(query.staff);
  if (staff === HR_UNASSIGNED) {
    // A candidate whose staff account is gone shows as unassigned too.
    conditions.push({
      sql: 'NOT EXISTS (SELECT 1 FROM users u WHERE u.id = c.assignedStaffId)',
      params: {},
    });
  } else if (/^\d+$/.test(staff)) {
    conditions.push({
      sql: 'c.assignedStaffId = :staff',
      params: { staff: Number(staff) },
    });
  }

  const position = text(query.position).toLowerCase();
  if (position)
    conditions.push({
      sql: 'LOWER(c.position) LIKE :position',
      params: { position: `%${escapeLike(position)}%` },
    });

  return conditions;
}
