import { DuckDBInstance } from '@duckdb/node-api';
import { parseRange } from './range';
import { leadCohort, type Ctx } from './sql';

const ctx: Ctx = { ids: '7', range: parseRange('30d', new Date('2026-11-20T06:00:00Z')), now: "TIMESTAMP '2026-11-20 06:00:00'" };

describe('lead-to-booking funnel', () => {
  it('counts a lead as contacted only when someone reached the customer', async () => {
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
    expect({ leads: Number(row.leads), contacted: Number(row.contacted), qualified: Number(row.qualified) }).toEqual({ leads: 8, contacted: 4, qualified: 1 });
  });
});
