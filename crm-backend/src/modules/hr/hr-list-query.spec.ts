import { HR_MAX_PAGE_SIZE, hrListConditions, hrPage } from './hr-list-query';

const sqlOf = (query: Parameters<typeof hrListConditions>[0]) =>
  hrListConditions(query).map((c) => c.sql);
const paramsOf = (
  query: Parameters<typeof hrListConditions>[0],
): Record<string, unknown> =>
  Object.assign({}, ...hrListConditions(query).map((c) => c.params)) as Record<
    string,
    unknown
  >;

describe('HR list query', () => {
  it('pages from 1 with 20 rows by default and caps the page size', () => {
    expect(hrPage({})).toEqual({ page: 1, limit: 20 });
    expect(hrPage({ page: '3', limit: '50' })).toEqual({ page: 3, limit: 50 });
    expect(hrPage({ page: '0', limit: '100000' })).toEqual({
      page: 1,
      limit: HR_MAX_PAGE_SIZE,
    });
    expect(hrPage({ page: 'x', limit: ['5'] })).toEqual({ page: 1, limit: 20 });
  });

  it('splits rejected candidates from the rest by tab', () => {
    expect(sqlOf({})).toEqual(["c.status <> 'Rejected'"]);
    expect(sqlOf({ tab: 'All Candidates' })).toEqual([
      "c.status <> 'Rejected'",
    ]);
    expect(sqlOf({ tab: 'Rejected' })).toEqual(["c.status = 'Rejected'"]);
  });

  it('searches name, HRC id, mobile, department and position, escaping LIKE wildcards', () => {
    const [, search] = hrListConditions({ search: '  HRC0012 ' });
    expect(search.sql).toContain('LOWER(c.name) LIKE :search');
    expect(search.sql).toContain(
      "CONCAT('hrc', IF(c.id < 1000, LPAD(c.id, 4, '0'), c.id)) LIKE :search",
    );
    expect(search.sql).toContain('c.mobile LIKE :search');
    expect(search.params).toEqual({ search: '%hrc0012%' });
    expect(paramsOf({ search: '50%_off\\' }).search).toBe('%50\\%\\_off\\\\%');
  });

  it('filters by India calendar days, ignoring malformed dates', () => {
    expect(sqlOf({ dateFrom: '2026-11-01', dateTo: '2026-11-13' })).toEqual([
      "c.status <> 'Rejected'",
      "DATE(CONVERT_TZ(c.createdAt, '+00:00', '+05:30')) >= :dateFrom",
      "DATE(CONVERT_TZ(c.createdAt, '+00:00', '+05:30')) <= :dateTo",
    ]);
    expect(sqlOf({ dateFrom: "2026-11-01' OR 1=1" })).toEqual([
      "c.status <> 'Rejected'",
    ]);
  });

  it('matches department and status exactly and position by substring', () => {
    expect(
      paramsOf({ department: 'Sales', status: 'Hold', position: ' Tele ' }),
    ).toEqual({
      department: 'Sales',
      status: 'Hold',
      position: '%tele%',
    });
  });

  it('filters by staff id, or by unassigned including removed staff accounts', () => {
    expect(hrListConditions({ staff: '12' })[1]).toEqual({
      sql: 'c.assignedStaffId = :staff',
      params: { staff: 12 },
    });
    expect(sqlOf({ staff: 'unassigned' })[1]).toBe(
      'NOT EXISTS (SELECT 1 FROM users u WHERE u.id = c.assignedStaffId)',
    );
    expect(sqlOf({ staff: '12 OR 1=1' })).toHaveLength(1);
  });
});
