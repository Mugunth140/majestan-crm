import { DuckDBInstance } from '@duckdb/node-api';
import { parseRange } from './range';
import { categoryOf, requirementCounters, sourcingDetail, sourcingFacts, type Ctx } from './sql';
import { sourcingDetailBlocks, type DetailRow } from './sourcing-detail';

const ctx: Ctx = { ids: '7', range: parseRange('30d', new Date('2026-11-20T06:00:00Z')), now: "TIMESTAMP '2026-11-20 06:00:00'" };
const num = (r: Record<string, unknown>) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === 'bigint' ? Number(v) : v]));

async function db(statements: string[]) {
  const conn = await (await DuckDBInstance.create(':memory:')).connect();
  for (const q of statements) await conn.run(q);
  return conn;
}

describe('residential or commercial', () => {
  it('uses the category, else the property type', async () => {
    const conn = await db([]);
    const pick = async (cat: string, type: string) =>
      String((await conn.runAndReadAll(`SELECT ${categoryOf(cat, type)} AS c`)).getRowObjects()[0].c);
    expect(await pick("'Residential'", "'office'")).toBe('residential');
    expect(await pick("'industrial'", 'NULL')).toBe('commercial');
    expect(await pick('NULL', "'Independent House'")).toBe('residential');
    expect(await pick('NULL', "'warehouse'")).toBe('commercial');
    expect(await pick('NULL', 'NULL')).toBe('unknown');
    conn.closeSync();
  });

  it('splits the average rent budget into homes and business space', async () => {
    const conn = await db([
      'CREATE TABLE lead_inquiries (id INT, purchase_type VARCHAR, property_type VARCHAR, property_category VARCHAR, preferences VARCHAR, sub_locations VARCHAR, city_id BIGINT, created_at TIMESTAMP)',
      `INSERT INTO lead_inquiries VALUES
        (1, 'rental', 'apartment', 'residential', '{"maxBudget":20000}', NULL, NULL, TIMESTAMP '2026-11-10 05:00:00'),
        (2, 'rental', 'apartment', NULL, '{"maxBudget":30000}', NULL, NULL, TIMESTAMP '2026-11-10 05:00:00'),
        (3, 'rental', 'office', 'commercial', '{"maxBudget":150000}', NULL, NULL, TIMESTAMP '2026-11-10 05:00:00'),
        (4, 'buy', 'shop', NULL, '{"maxBudget":9000000}', NULL, NULL, TIMESTAMP '2026-11-10 05:00:00')`,
    ]);
    const cur = (await conn.runAndReadAll(requirementCounters(ctx))).getRowObjects().map(num).find(r => r.p === 'cur')!;
    conn.closeSync();
    expect(cur).toMatchObject({ commercial: 2, rent_res_n: 2, rent_com_n: 1 });
    expect(Number(cur.rent_res_sum) / Number(cur.rent_res_n)).toBe(25000);
    expect(Number(cur.rent_com_sum)).toBe(150000);
  });
});

describe('sourcing detail', () => {
  const at = "TIMESTAMP '2026-11-10 05:00:00'";
  const setup = () => db([
    `CREATE TABLE inbounds (id INT, uploaded_by_id INT, property_category VARCHAR, property_type VARCHAR, purpose VARCHAR, total_rent DOUBLE, sale_price DOUBLE,
      status VARCHAR, inbound_status VARCHAR, source VARCHAR, image_url VARCHAR, latitude DOUBLE, google_map_location VARCHAR, brokerage_accepted VARCHAR, created_at TIMESTAMP)`,
    `INSERT INTO inbounds VALUES
      (1, 7, 'residential', 'apartment', 'Rent', 20000, NULL, 'Contacting Owner', 'available', 'Olx', 'x.webp', 11.0, NULL, 'Yes', ${at}),
      (2, 7, 'residential', 'individual_portion', NULL, 30000, NULL, 'New Inbound', NULL, NULL, NULL, NULL, NULL, 'No', ${at}),
      (3, 7, 'commercial', 'office', 'Sale', NULL, 9000000, 'Closed', 'verification_done', 'Olx', 'y.webp', NULL, 'https://maps', NULL, ${at}),
      (4, 8, NULL, 'warehouse', 'Rent', 120000, NULL, 'Rejected', 'not_available', 'Housing.com', NULL, NULL, NULL, NULL, ${at}),
      (5, 7, 'residential', 'villa', 'Sale', NULL, 20000000, 'New Inbound', NULL, NULL, NULL, NULL, NULL, NULL, TIMESTAMP '2026-10-05 05:00:00')`,
  ]);

  it('breaks sourced inbounds down by segment, type, status and source', async () => {
    const conn = await setup();
    const all = (await conn.runAndReadAll(sourcingDetail(ctx, true))).getRowObjects().map(num) as DetailRow[];
    const mine = (await conn.runAndReadAll(sourcingDetail(ctx))).getRowObjects().map(num) as DetailRow[];
    conn.closeSync();
    const pick = (rows: DetailRow[], dim: string) => rows.filter(r => r.dim === dim).map(r => `${r.label} ${r.sourced}`);
    expect(pick(all, 'segment')).toEqual(['residential|rent 2', 'commercial|rent 1', 'commercial|sale 1']);
    expect(pick(all, 'type')).toEqual(['commercial|office 1', 'commercial|warehouse 1', 'residential|apartment 1', 'residential|individual_portion 1']);
    expect(pick(all, 'source')).toEqual(['Olx 2', 'Housing.com 1', 'Not recorded 1']);
    expect(all.find(r => r.dim === 'source' && r.label === 'Olx')).toMatchObject({ validated: 1, verified: 1 });
    expect(pick(mine, 'segment')).toEqual(['residential|rent 2', 'commercial|sale 1']);
  });

  it('builds the shared blocks with readable labels and headline facts', async () => {
    const conn = await setup();
    const rows = (await conn.runAndReadAll(sourcingDetail(ctx, true))).getRowObjects().map(num) as DetailRow[];
    const facts = (await conn.runAndReadAll(sourcingFacts(ctx, true))).getRowObjects().map(num) as Record<string, number | string | null>[];
    conn.closeSync();
    const blocks = sourcingDetailBlocks('t', rows, facts);
    const kpis = blocks[0] as Extract<(typeof blocks)[number], { kind: 'kpis' }>;
    const v = Object.fromEntries(kpis.metrics.map(m => [m.key, [m.value, m.prev]]));
    expect(v).toMatchObject({
      src_res: [2, 1], src_com: [2, 0], src_rent_res: [25000, null], src_rent_com: [120000, null], src_sale_avg: [9000000, 20000000],
      src_photo: [50, 0], src_located: [50, 0], src_brokerage: [50, null],
    });
    const stacked = (id: string) => (blocks.find(b => b.id === id) as Extract<(typeof blocks)[number], { kind: 'stacked' }>).rows.map(r => r.label);
    expect(stacked('t-segments')).toEqual(['Residential · Rent', 'Commercial · Rent', 'Commercial · Sale']);
    expect(stacked('t-res-types')).toEqual(['Apartment', 'Individual / Portion house']);
    expect(stacked('t-com-types')).toEqual(['Office', 'Warehouse']);
  });
});
