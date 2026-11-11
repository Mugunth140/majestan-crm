import { DuckDBInstance } from '@duckdb/node-api';
import { workMinutesBetween } from './range';

/** Runs the SQL in DuckDB, as the dashboard does. Times are IST. */
async function between(from: string, to: string) {
  const db = await DuckDBInstance.create(':memory:');
  const conn = await db.connect();
  const ts = (ist: string) => `(TIMESTAMP '${ist}' - INTERVAL 330 MINUTE)`;
  const reader = await conn.runAndReadAll(
    `SELECT CAST(${workMinutesBetween(ts(from), ts(to))} AS INTEGER) AS m`,
  );
  const value = Number(reader.getRowObjects()[0].m);
  conn.closeSync();
  return value;
}

describe('working minutes between two times', () => {
  it('counts plain minutes within one working day', async () => {
    expect(await between('2026-11-10 10:00:00', '2026-11-10 10:45:00')).toBe(
      45,
    );
  });
  it('skips the night: 6 PM to 10 AM next day is 90 minutes', async () => {
    expect(await between('2026-11-10 18:00:00', '2026-11-11 10:00:00')).toBe(
      90,
    );
  });
  it('starts at 9 AM for a lead that came in overnight', async () => {
    expect(await between('2026-11-10 23:30:00', '2026-11-11 09:20:00')).toBe(
      20,
    );
  });
  it('skips Sunday: Saturday 6 PM to Monday 9:30 AM is an hour', async () => {
    // 14 Nov 2026 is a Saturday.
    expect(await between('2026-11-14 18:00:00', '2026-11-16 09:30:00')).toBe(
      60,
    );
  });
  it('is zero for a call before the working day starts', async () => {
    expect(await between('2026-11-10 07:00:00', '2026-11-10 08:30:00')).toBe(0);
  });
});
