import { DuckDBInstance } from '@duckdb/node-api';
import { parseRange } from './range';
import { inboundStatusCounters, journeyMix, journeySeries, repeatCounters, statusCounters, type Ctx } from './sql';
import { STATUS_JOURNEYS } from './metrics';

/** The Progress tab's status section, run in DuckDB as the dashboard does. */
const ctx: Ctx = { ids: '7', range: parseRange('30d', new Date('2026-11-20T06:00:00Z')), now: "TIMESTAMP '2026-11-20 06:00:00'" };

async function run(setup: string[], sql: string) {
  const db = await DuckDBInstance.create(':memory:');
  const conn = await db.connect();
  for (const s of setup) await conn.run(s);
  const rows = (await conn.runAndReadAll(sql)).getRowObjects();
  conn.closeSync();
  return Object.fromEntries(rows.map(r => [String(r.p), Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === 'bigint' ? Number(v) : v]))]));
}

describe('status counts on the Progress tab', () => {
  it('counts each lead once per status the person moved it to, splitting Qualified from Interested', async () => {
    const ev = (lead: number, to: string, at: string, actor = 7) => `(${lead}, ${actor}, 'status_changed', '${to}', TIMESTAMP '${at}')`;
    const rows = await run([
      'CREATE TABLE lead_events (lead_id INT, actor_id INT, type VARCHAR, to_value VARCHAR, created_at TIMESTAMP)',
      `INSERT INTO lead_events VALUES ${[
        ev(1, 'Contacted', '2026-11-10 05:00:00'), ev(1, 'Contacted', '2026-11-11 05:00:00'),
        ev(2, 'Qualified', '2026-11-12 05:00:00'), ev(3, 'Interested', '2026-11-12 06:00:00'),
        ev(2, 'Property Shared', '2026-11-13 05:00:00'), ev(2, 'Site Visit Scheduled', '2026-11-14 05:00:00'),
        ev(2, 'Site Visit Completed', '2026-11-15 05:00:00'),
        ev(2, 'Re Visit Scheduled', '2026-11-16 05:00:00'), ev(2, 'Re Visit Completed', '2026-11-17 05:00:00'),
        ev(4, 'Contacted', '2026-11-12 05:00:00', 8),
        ev(5, 'Contacted', '2026-10-05 05:00:00'),
      ].join(',')}`,
    ], statusCounters(ctx));
    expect(rows.cur).toMatchObject({
      ev_contacted: 1, ev_qualified_only: 1, ev_interested: 1, ev_qualified: 2, ev_shared: 1,
      ev_sv_sched: 1, ev_sv_done: 1, ev_revisit: 1,
    });
    expect(rows.prev).toMatchObject({ ev_contacted: 1 });

    const leads = STATUS_JOURNEYS.telecalling!;
    expect(leads.stages.map(m => m.label)).toEqual([
      'New leads', 'Contacted', 'Qualified', 'Property shared', 'Interested', 'Site visit scheduled', 'Site visit done', 'Revisit', 'Negotiation', 'Booked',
    ]);
    const counters = { ...rows.cur, assigned_n: 6 } as Record<string, number>;
    expect(leads.stages.map(m => counters[m.counter] ?? 0)).toEqual([6, 1, 1, 1, 1, 1, 1, 1, 0, 0]);
    expect(leads.exits.map(m => m.label)).toEqual(['Not interested', 'Dropped', 'Lost']);
    expect(leads.parked!.map(m => m.label)).toEqual(['Future follow-up', 'Other location']);
    expect(leads.extras!.map(m => m.counter)).toEqual(['repeat_n']);
    expect(STATUS_JOURNEYS.sales).toBe(leads);
  });

  it('counts inbound availability moves by the person', async () => {
    const ev = (id: number, to: string, at: string, field = 'inbound_status') => `('inbound', ${id}, 7, '${field}', '${to}', TIMESTAMP '${at}')`;
    const rows = await run([
      'CREATE TABLE record_events (entity VARCHAR, entity_id INT, actor_id INT, field VARCHAR, to_value VARCHAR, created_at TIMESTAMP)',
      `INSERT INTO record_events VALUES ${[
        ev(1, 'available', '2026-11-10 05:00:00'), ev(1, 'fixed_verification', '2026-11-11 05:00:00'),
        ev(1, 'verification_done', '2026-11-12 05:00:00'), ev(2, 'not_available', '2026-11-12 05:00:00'),
        ev(3, 'available', '2026-11-12 05:00:00', 'status'),
      ].join(',')}`,
    ], inboundStatusCounters(ctx));
    expect(rows.cur).toMatchObject({ inb_available: 1, inb_fixed: 1, inb_done: 1, inb_na: 1 });
  });

  it('gives Sourcing and HR their own journey and none to departments without statuses', () => {
    expect(STATUS_JOURNEYS.sourcing!.stages.map(m => m.label)).toEqual(['New inbounds', 'Available', 'Sent for verification', 'Verification done']);
    expect(STATUS_JOURNEYS.sourcing!.exits.map(m => m.counter)).toEqual(['inb_na']);
    expect(STATUS_JOURNEYS.hr!.stages.map(m => m.label)).toContain('Interview scheduled');
    for (const dept of ['collection', 'digital', 'design', 'other'] as const) expect(STATUS_JOURNEYS[dept]).toBeUndefined();
  });

  it('puts each journey step on its day for the trend chart', async () => {
    const db = await DuckDBInstance.create(':memory:');
    const conn = await db.connect();
    for (const q of [
      'CREATE TABLE routing_histories (lead_id INT, to_user_id INT, from_user_id INT, created_at TIMESTAMP)',
      'CREATE TABLE leads (id INT, assigned_staff_id INT, status VARCHAR, created_at TIMESTAMP)',
      'CREATE TABLE lead_events (lead_id INT, actor_id INT, type VARCHAR, to_value VARCHAR, created_at TIMESTAMP)',
      "INSERT INTO routing_histories VALUES (1, 7, 3, TIMESTAMP '2026-11-10 05:00:00')",
      "INSERT INTO leads VALUES (1, 7, 'Contacted', TIMESTAMP '2026-11-01 05:00:00'), (2, 7, 'New Lead', TIMESTAMP '2026-11-10 06:00:00'), (3, 7, 'Dropped', TIMESTAMP '2026-10-01 05:00:00')",
      `INSERT INTO lead_events VALUES (1, 7, 'status_changed', 'Contacted', TIMESTAMP '2026-11-10 07:00:00'), (1, 7, 'status_changed', 'Contacted', TIMESTAMP '2026-11-10 08:00:00'),
        (1, 7, 'status_changed', 'Re Visit Scheduled', TIMESTAMP '2026-11-11 05:00:00'), (3, 7, 'status_changed', 'Dropped', TIMESTAMP '2026-11-11 06:00:00'),
        (1, 7, 'status_changed', 'Negotiation', TIMESTAMP '2026-11-12 05:00:00')`,
    ]) await conn.run(q);
    const rows = (await conn.runAndReadAll(journeySeries(ctx, 'lead'))).getRowObjects().map(r => `${r.t} ${r.k} ${Number(r.n)}`).sort();
    expect(rows).toEqual(['2026-11-10 contacted 1', '2026-11-10 new 2', '2026-11-11 dropped 1', '2026-11-11 revisit 1']);
    const mix = (await conn.runAndReadAll(journeyMix(ctx, 'lead'))).getRowObjects().map(r => `${r.label} ${Number(r.value)}`).sort();
    expect(mix).toEqual(['Contacted 1', 'Dropped 1', 'New Lead 1']);
    conn.closeSync();
  });

  it('runs the inbound and hiring chart queries', async () => {
    const db = await DuckDBInstance.create(':memory:');
    const conn = await db.connect();
    for (const q of [
      'CREATE TABLE inbounds (id INT, uploaded_by_id INT, assigned_staff_id INT, inbound_status VARCHAR, created_at TIMESTAMP)',
      'CREATE TABLE record_events (entity VARCHAR, entity_id INT, actor_id INT, type VARCHAR, field VARCHAR, to_value VARCHAR, created_at TIMESTAMP)',
      'CREATE TABLE hr_candidates (id INT, "assignedStaffId" INT, status VARCHAR, "createdAt" TIMESTAMP)',
      "INSERT INTO inbounds VALUES (1, 7, NULL, 'available', TIMESTAMP '2026-11-10 05:00:00'), (2, 9, 7, NULL, TIMESTAMP '2026-11-10 05:00:00')",
      "INSERT INTO record_events VALUES ('inbound', 1, 7, 'field_changed', 'inbound_status', 'available', TIMESTAMP '2026-11-11 05:00:00'), ('hr', 5, 7, 'status_changed', 'status', 'Joined', TIMESTAMP '2026-11-11 05:00:00')",
      "INSERT INTO hr_candidates VALUES (5, 7, 'Joined', TIMESTAMP '2026-11-01 05:00:00')",
    ]) await conn.run(q);
    const read = async (sql: string) => (await conn.runAndReadAll(sql)).getRowObjects().map(r => Object.values(r).map(String).join(' ')).sort();
    expect(await read(journeySeries(ctx, 'inbound'))).toEqual(['2026-11-10 added 1', '2026-11-11 available 1']);
    expect(await read(journeyMix(ctx, 'inbound'))).toEqual(['available 1', 'none 1']);
    expect(await read(journeySeries(ctx, 'hr'))).toEqual(['2026-11-01 apps 1', '2026-11-11 joined 1']);
    expect(await read(journeyMix(ctx, 'hr'))).toEqual(['Joined 1']);
    conn.closeSync();
  });

  it('splits dropped-out and on-hold statuses and counts repeat leads once per owner', async () => {
    const ev = (lead: number, type: string, to: string, at: string) => `(${lead}, 7, '${type}', '${to}', TIMESTAMP '${at}')`;
    const setup = [
      'CREATE TABLE lead_events (lead_id INT, actor_id INT, type VARCHAR, to_value VARCHAR, created_at TIMESTAMP)',
      `INSERT INTO lead_events VALUES ${[
        ev(1, 'status_changed', 'Not Interested', '2026-11-10 05:00:00'), ev(2, 'status_changed', 'Lost', '2026-11-10 05:00:00'),
        ev(3, 'status_changed', 'Dropped', '2026-11-10 05:00:00'), ev(4, 'status_changed', 'Future Follow-up', '2026-11-10 05:00:00'),
        ev(5, 'status_changed', 'Other Location', '2026-11-10 05:00:00'),
        ev(6, 'repeat_enquiry', '99acres', '2026-11-10 05:00:00'), ev(6, 'repeat_enquiry', 'Magicbricks', '2026-11-12 05:00:00'),
        ev(8, 'repeat_enquiry', 'Website', '2026-11-12 05:00:00'), ev(6, 'repeat_enquiry', '99acres', '2026-10-10 05:00:00'),
      ].join(',')}`,
      'CREATE TABLE leads (id INT, assigned_staff_id INT)',
      'INSERT INTO leads VALUES (6, 7), (8, 9)',
    ];
    const status = await run(setup, statusCounters(ctx));
    expect(status.cur).toMatchObject({ ev_dropped: 3, ev_not_interested: 1, ev_dropped_only: 1, ev_lost: 1, ev_future: 1, ev_other_loc: 1 });
    const repeats = await run(setup, repeatCounters(ctx));
    expect(repeats.cur).toMatchObject({ repeat_n: 1 });
    expect(repeats.prev).toMatchObject({ repeat_n: 1 });
  });
});
