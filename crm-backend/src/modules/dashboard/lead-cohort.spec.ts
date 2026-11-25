import { DuckDBInstance } from '@duckdb/node-api';
import { parseRange } from './range';
import { leadCohort, leadPath, repeatsBySource, type Ctx } from './sql';
import { leadPathBlocks, sourcesBlock } from './dashboard.service';

const ctx: Ctx = { ids: '7', range: parseRange('30d', new Date('2026-11-20T06:00:00Z')), now: "TIMESTAMP '2026-11-20 06:00:00'" };

describe('lead-to-booking funnel', () => {
  it('counts a lead as contacted only when someone reached the customer, and leaves out converted leads', async () => {
    const db = await DuckDBInstance.create(':memory:');
    const conn = await db.connect();
    const at = "TIMESTAMP '2026-11-10 05:00:00'";
    for (const q of [
      'CREATE TABLE leads (id INT, lead_source VARCHAR, status VARCHAR, assigned_staff_id INT, created_at TIMESTAMP)',
      'CREATE TABLE lead_follow_ups (lead_id INT, created_by_id INT, created_at TIMESTAMP)',
      'CREATE TABLE lead_events (lead_id INT, actor_id INT, type VARCHAR, to_value VARCHAR, created_at TIMESTAMP)',
      `CREATE VIEW all_contacts AS SELECT * FROM (VALUES
        ('lead', 2, 7, 'call', 0), ('lead', 3, 7, 'call', 45), ('lead', 4, NULL, 'whatsapp', NULL), ('lead', 5, 7, 'whatsapp', NULL)
      ) t(entity, entity_id, sent_by_id, contact_type, call_duration)`,
      // 1: only the automatic follow-up. 2: an unanswered dial. 3: a connected call. 4: an automatic WhatsApp.
      // 5: a WhatsApp from a person. 6: a follow-up written by a person. 7: moved to Qualified. 8: converted to an inbound.
      `INSERT INTO leads VALUES ${[1, 2, 3, 4, 5, 6].map(i => `(${i}, 'Web', 'New Lead', 7, ${at})`).join(',')},
        (7, 'Web', 'Qualified', 7, ${at}), (8, 'Web', 'Converted', NULL, ${at})`,
      `INSERT INTO lead_follow_ups VALUES ${[1, 2, 3, 4, 5, 6, 7, 8].map(i => `(${i}, NULL, ${at})`).join(',')}, (6, 7, ${at})`,
      `INSERT INTO lead_events VALUES (7, 7, 'status_changed', 'Qualified', ${at})`,
    ]) await conn.run(q);
    const [row] = (await conn.runAndReadAll(leadCohort(ctx))).getRowObjects();
    conn.closeSync();
    expect({ leads: Number(row.leads), contacted: Number(row.contacted), qualified: Number(row.qualified) }).toEqual({ leads: 7, contacted: 4, qualified: 1 });
  });
});

describe('where funnel leads go', () => {
  it('puts each lead at the furthest step it reached and splits the ones that stopped', async () => {
    const db = await DuckDBInstance.create(':memory:');
    const conn = await db.connect();
    const at = "TIMESTAMP '2026-11-10 05:00:00'";
    const lead = (id: number, status: string) => `(${id}, 'Web', '${status}', 7, ${at})`;
    const ev = (id: number, to: string) => `(${id}, 7, 'status_changed', '${to}', ${at})`;
    for (const q of [
      'CREATE TABLE leads (id INT, lead_source VARCHAR, status VARCHAR, assigned_staff_id INT, created_at TIMESTAMP)',
      'CREATE TABLE lead_follow_ups (lead_id INT, created_by_id INT, created_at TIMESTAMP)',
      'CREATE TABLE lead_events (lead_id INT, actor_id INT, type VARCHAR, to_value VARCHAR, created_at TIMESTAMP)',
      "CREATE VIEW all_contacts AS SELECT * FROM (VALUES ('lead', 0, 7, 'call', 0)) t(entity, entity_id, sent_by_id, contact_type, call_duration)",
      `INSERT INTO leads VALUES ${[
        lead(1, 'New Lead'), lead(2, 'Contacted'), lead(3, 'Not Interested'), lead(4, 'Future Follow-up'),
        lead(5, 'Property Shared'), lead(6, 'Re Visit Completed'), lead(7, 'Not Interested'), lead(8, 'Agreement'), lead(9, 'Converted'),
      ].join(',')}`,
      'INSERT INTO lead_follow_ups VALUES (1, NULL, TIMESTAMP \'2026-11-10 05:00:00\')',
      // 7 reached Site Visit Scheduled before dropping out.
      `INSERT INTO lead_events VALUES ${[ev(2, 'Contacted'), ev(3, 'Not Interested'), ev(4, 'Qualified'), ev(4, 'Future Follow-up'), ev(7, 'Site Visit Scheduled'), ev(7, 'Not Interested')].join(',')}`,
    ]) await conn.run(q);
    const rows = (await conn.runAndReadAll(leadPath(ctx))).getRowObjects()
      .map(r => ({ step: Number(r.step), outcome: r.outcome as 'lost' | 'parked' | 'open', status: String(r.status), n: Number(r.n) }));
    conn.closeSync();
    expect(rows.map(r => `${r.status} ${r.step} ${r.outcome}`).sort()).toEqual([
      'Agreement 8 open', 'Contacted 1 open', 'Future Follow-up 2 parked', 'New Lead 0 open', 'Not Interested 1 lost',
      'Not Interested 5 lost', 'Property Shared 3 open', 'Re Visit Completed 6 open',
    ]);

    const { funnel, leakage, now } = leadPathBlocks(rows);
    expect(funnel.map(f => `${f.label} ${f.value}`)).toEqual([
      'Leads created 8', 'Contacted 7', 'Qualified 5', 'Property shared 4', 'Interested 3', 'Visit scheduled 3', 'Visit completed 2', 'Negotiation 1', 'Booked 1',
    ]);
    expect(leakage[1]).toEqual({ from: 'Contacted', to: 'Qualified', base: 7, lost: 1, parked: 0, open: 1 });
    expect(leakage[2]).toMatchObject({ from: 'Qualified', parked: 1 });
    expect(leakage[5]).toMatchObject({ from: 'Visit scheduled', lost: 1 });
    expect(now.map(b => b.label)).toEqual(['New Lead', 'Contacted', 'Property Shared', 'Re Visit Completed', 'Agreement', 'Future Follow-up', 'Not Interested']);
    expect(now.find(b => b.label === 'Not Interested')).toMatchObject({ value: 2, tone: 'bad' });
  });
});

describe('leads by source', () => {
  it('adds repeats per source and gives each source its own funnel', async () => {
    const db = await DuckDBInstance.create(':memory:');
    const conn = await db.connect();
    const at = "TIMESTAMP '2026-11-10 05:00:00'";
    for (const q of [
      'CREATE TABLE leads (id INT, lead_source VARCHAR, status VARCHAR, assigned_staff_id INT, created_at TIMESTAMP)',
      'CREATE TABLE lead_events (lead_id INT, actor_id INT, type VARCHAR, to_value VARCHAR, created_at TIMESTAMP)',
      `INSERT INTO leads VALUES (1, '99acres', 'Qualified', 7, ${at}), (2, '99acres', 'New Lead', 7, ${at}), (3, 'Olx', 'Agreement', 8, ${at}), (4, 'Old', 'Contacted', 7, TIMESTAMP '2026-01-01 05:00:00')`,
      `INSERT INTO lead_events VALUES (4, NULL, 'repeat_enquiry', '99Acres', ${at}), (4, NULL, 'repeat_enquiry', '99Acres', ${at}), (3, NULL, 'repeat_enquiry', 'Magic Bricks', ${at})`,
    ]) await conn.run(q);
    const repeats = (await conn.runAndReadAll(repeatsBySource(ctx))).getRowObjects().map(r => ({ source: String(r.source), repeats: Number(r.repeats) }));
    const mine = (await conn.runAndReadAll(repeatsBySource(ctx, '7'))).getRowObjects().map(r => `${r.source} ${Number(r.repeats)}`);
    conn.closeSync();
    expect(mine).toEqual(['99Acres 1']);

    const path = [
      { source: '99acres', step: 2, outcome: 'open' as const, status: 'Qualified', n: 1 },
      { source: '99acres', step: 0, outcome: 'open' as const, status: 'New Lead', n: 1 },
      { source: 'Olx', step: 8, outcome: 'open' as const, status: 'Agreement', n: 1 },
    ];
    const block = sourcesBlock('src', path, repeats) as Extract<ReturnType<typeof sourcesBlock>, { kind: 'sources' }>;
    expect(block.steps[0]).toBe('Leads created');
    expect(block.rows.map(r => `${r.label} ${r.leads} ${r.repeats} ${r.booked}`)).toEqual(['99acres 2 1 0', 'Olx 1 0 1', 'Magic Bricks 0 1 0']);
    expect(block.rows[0].funnel.slice(0, 4)).toEqual([2, 1, 1, 0]);
    expect(block.rows[1].funnel.every(v => v === 1)).toBe(true);
  });
});
