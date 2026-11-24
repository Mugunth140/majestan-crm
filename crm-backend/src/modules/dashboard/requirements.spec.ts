import { DuckDBInstance } from '@duckdb/node-api';
import { parseRange } from './range';
import { requirementCounters, requirementMix, requirementSeries, type Ctx } from './sql';

/** The Overview's requirements section, run in DuckDB over shapes seen in production. */
const ctx: Ctx = { ids: '7', range: parseRange('30d', new Date('2026-11-20T06:00:00Z')), now: "TIMESTAMP '2026-11-20 06:00:00'" };

async function db() {
  const instance = await DuckDBInstance.create(':memory:');
  const conn = await instance.connect();
  await conn.run(`CREATE TABLE lead_inquiries (id INT, purchase_type VARCHAR, property_type VARCHAR, property_category VARCHAR,
    preferences VARCHAR, sub_locations VARCHAR, city_id BIGINT, purchase_timeline VARCHAR, created_at TIMESTAMP)`);
  const row = (id: number, type: string | null, ptype: string | null, prefs: object | null, locs: string[] | null, timeline: string | null, at: string) =>
    `(${id}, ${type ? `'${type}'` : 'NULL'}, ${ptype ? `'${ptype}'` : 'NULL'}, 'residential', ${prefs ? `'${JSON.stringify(prefs)}'` : 'NULL'},
      ${locs ? `'${JSON.stringify(locs)}'` : 'NULL'}, NULL, ${timeline ? `'${timeline}'` : 'NULL'}, TIMESTAMP '${at}')`;
  await conn.run(`INSERT INTO lead_inquiries VALUES ${[
    row(1, 'buy', 'apartment', { maxBudget: 6000000, bhk: ['2', '3'], roadName: 'Avinashi Road' }, ['Peelamedu', 'Saravanampatti'], 'immediate', '2026-11-10 05:00:00'),
    row(2, 'buy', 'villa', { minBudget: 25000000, bhk: '3' }, ['Peelamedu'], null, '2026-11-11 05:00:00'),
    row(3, 'rental', 'apartment', { maxBudget: 18000 }, null, 'within_30_days', '2026-11-12 05:00:00'),
    row(4, null, null, null, null, null, '2026-11-12 06:00:00'),
    row(5, 'buy', 'plot', { maxBudget: 0 }, null, null, '2026-10-05 05:00:00'),
  ].join(',')}`);
  return conn;
}
const read = async (conn: Awaited<ReturnType<typeof db>>, sql: string) =>
  (await conn.runAndReadAll(sql)).getRowObjects().map(r => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === 'bigint' ? Number(v) : v])));

describe('requirements on the Overview', () => {
  it('counts requirements, their completeness and average budgets per period', async () => {
    const conn = await db();
    const rows = await read(conn, requirementCounters(ctx));
    const cur = rows.find(r => r.p === 'cur')!;
    expect(cur).toMatchObject({ n: 4, buy: 2, rent: 1, budget_n: 3, loc_n: 2, complete_n: 2, buy_budget_n: 2, rent_budget_n: 1 });
    expect(Number(cur.buy_budget_sum)).toBe(31000000);
    expect(rows.find(r => r.p === 'prev')).toMatchObject({ n: 1, buy: 1, budget_n: 0 });
    conn.closeSync();
  });

  it('breaks the period down by purpose, type, budget band, location, BHK, timeline and road', async () => {
    const conn = await db();
    const rows = (await read(conn, requirementMix(ctx))).map(r => `${r.dim}:${r.label}:${r.value}`).sort();
    expect(rows).toEqual([
      'bhk:2:1', 'bhk:3:2',
      'buy_budget:2|₹50 L–1 Cr:1', 'buy_budget:4|₹2 Cr+:1',
      'location:Peelamedu:2', 'location:Saravanampatti:1',
      'purpose:buy:2', 'purpose:rental:1', 'purpose:unknown:1',
      'rent_budget:1|₹15–25k:1',
      'road:Avinashi Road:1',
      'timeline:immediate:1', 'timeline:within_30_days:1',
      'type:apartment:2', 'type:residential:1', 'type:villa:1',
    ]);
    const series = (await read(conn, requirementSeries(ctx))).map(r => `${r.t}:${r.k}:${r.n}`).sort();
    expect(series).toEqual(['2026-11-10:buy:1', '2026-11-11:buy:1', '2026-11-12:other:1', '2026-11-12:rent:1']);
    conn.closeSync();
  });
});
