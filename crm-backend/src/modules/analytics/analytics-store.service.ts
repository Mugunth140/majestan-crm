import { Injectable, Logger, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { mkdirSync, renameSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { DuckDBInstance, type DuckDBConnection } from '@duckdb/node-api';

/**
 * MySQL tables copied into DuckDB for analytics. MySQL stays the source of
 * truth; the copy is rebuilt every sync, so it can always be deleted safely.
 */
const MIRRORED_TABLES = [
  'leads', 'lead_follow_ups', 'lead_events', 'lead_inquiries', 'routing_histories',
  'contact_logs', 'agent_contact_logs', 'inbound_contact_logs', 'asset_contact_logs', 'hr_contact_logs',
  'users', 'departments', 'inbounds', 'agents', 'assets', 'hr_candidates',
  'task_templates', 'task_metric_targets', 'task_metric_progress', 'task_activity_logs', 'task_receipts',
  'roles', 'record_events', 'inbound_follow_ups', 'logger_devices', 'website_enquiry_events', 'hr_sources',
] as const;

// Columns never needed for analytics (large or binary).
const SKIPPED_TYPES = new Set(['blob', 'tinyblob', 'mediumblob', 'longblob', 'binary', 'varbinary', 'geometry', 'point']);

type Column = { name: string; dataType: string };

const duckType = (mysqlType: string): string => {
  switch (mysqlType) {
    case 'tinyint': case 'smallint': case 'mediumint': case 'int': case 'bigint': case 'year': case 'bit':
      return 'BIGINT';
    case 'decimal': case 'float': case 'double':
      return 'DOUBLE';
    case 'datetime': case 'timestamp':
      return 'TIMESTAMP';
    case 'date':
      return 'DATE';
    default:
      return 'VARCHAR';
  }
};

// Read every value as text so DuckDB parses it exactly as MySQL stored it
// (no driver timezone shifts on DATETIME, no float drift on DECIMAL).
const selectExpr = ({ name, dataType }: Column): string => {
  const col = `\`${name}\``;
  if (dataType === 'datetime' || dataType === 'timestamp') return `IF(YEAR(${col}) = 0, NULL, DATE_FORMAT(${col}, '%Y-%m-%d %H:%i:%s.%f'))`;
  if (dataType === 'date') return `IF(YEAR(${col}) = 0, NULL, DATE_FORMAT(${col}, '%Y-%m-%d'))`;
  return `CAST(${col} AS CHAR)`;
};

const quote = (name: string) => `"${name.replace(/"/g, '""')}"`;

// DuckDB returns BIGINT/HUGEINT as bigint and DATE/TIMESTAMP as objects;
// callers get plain JSON values.
const plain = (v: unknown): unknown => {
  if (typeof v === 'bigint') return Number(v);
  if (v && typeof v === 'object' && 'toString' in v && !Array.isArray(v)) return String(v);
  return v;
};

@Injectable()
export class AnalyticsStoreService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(AnalyticsStoreService.name);
  private instance: DuckDBInstance | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private syncing: Promise<void> | null = null;
  private firstSync: Promise<void> | null = null;
  private lastSyncedAt: Date | null = null;
  private parquetDir: string | null = null;
  private lastExportAt = 0;

  constructor(@InjectDataSource() private readonly mysql: DataSource) {}

  async onModuleInit() {
    const path = process.env.ANALYTICS_DB_PATH || '/data/analytics/crm.duckdb';
    if (path !== ':memory:') {
      mkdirSync(dirname(path), { recursive: true });
      this.parquetDir = join(dirname(path), 'parquet');
      mkdirSync(this.parquetDir, { recursive: true });
    }
    this.instance = await DuckDBInstance.create(path, { threads: '2', memory_limit: '512MB' });
    await this.run(`CREATE TABLE IF NOT EXISTS pipeline_daily (
      day DATE, status VARCHAR, department VARCHAR, leads BIGINT, PRIMARY KEY (day, status, department))`);

    // First sync in the background so boot is never blocked; queries wait for it.
    this.firstSync = this.sync();
    const every = Number(process.env.ANALYTICS_SYNC_MS || 60_000);
    this.timer = setInterval(() => void this.sync(), every);
  }

  onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
    this.instance?.closeSync();
  }

  get syncedAt() {
    return this.lastSyncedAt;
  }

  /** Rows as plain objects. `?` placeholders bind `params` in order. */
  async query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
    await this.firstSync?.catch(() => {});
    const conn = await this.connect();
    try {
      const reader = await conn.runAndReadAll(sql, params as never);
      return reader.getRowObjects().map((row) => {
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(row)) out[k] = plain(v);
        return out as T;
      });
    } finally {
      conn.closeSync();
    }
  }

  /** The first row's `c` column as a number (for COUNT/SUM style queries). */
  async scalar(sql: string, params: unknown[] = []): Promise<number> {
    const [row] = await this.query<{ c: unknown }>(sql, params);
    return Number(row?.c ?? 0);
  }

  /** Copies the mirrored tables from MySQL. Overlapping calls share one run. */
  sync(): Promise<void> {
    if (!this.syncing) {
      this.syncing = this.syncOnce()
        .catch((err) => this.logger.error(`Analytics sync failed: ${(err as Error).message}`))
        .finally(() => { this.syncing = null; });
    }
    return this.syncing;
  }

  private async connect(): Promise<DuckDBConnection> {
    if (!this.instance) throw new Error('Analytics store is not open');
    return this.instance.connect();
  }

  private async run(sql: string) {
    const conn = await this.connect();
    try {
      await conn.run(sql);
    } finally {
      conn.closeSync();
    }
  }

  private async syncOnce() {
    const started = Date.now();
    const schema: { table_name: string; column_name: string; data_type: string }[] = await this.mysql.query(
      `SELECT TABLE_NAME AS table_name, COLUMN_NAME AS column_name, DATA_TYPE AS data_type
         FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (${MIRRORED_TABLES.map(() => '?').join(',')})
        ORDER BY TABLE_NAME, ORDINAL_POSITION`,
      [...MIRRORED_TABLES],
    );
    const columns = new Map<string, Column[]>();
    for (const r of schema) {
      if (SKIPPED_TYPES.has(r.data_type)) continue;
      const list = columns.get(r.table_name) ?? [];
      list.push({ name: r.column_name, dataType: r.data_type });
      columns.set(r.table_name, list);
    }

    const conn = await this.connect();
    try {
      let rows = 0;
      for (const table of MIRRORED_TABLES) {
        const cols = columns.get(table);
        if (!cols?.length) continue; // table not migrated on this database yet
        rows += await this.copyTable(conn, table, cols);
      }

      // Swap every staged table in at once, so readers never see half a sync.
      await conn.run('BEGIN TRANSACTION');
      try {
        for (const table of MIRRORED_TABLES) {
          if (!columns.get(table)?.length) continue;
          await conn.run(`DROP TABLE IF EXISTS ${quote(table)}`);
          await conn.run(`ALTER TABLE ${quote(`stage_${table}`)} RENAME TO ${quote(table)}`);
        }
        await conn.run(CREATE_VIEWS);
        await conn.run(`INSERT OR REPLACE INTO pipeline_daily
          SELECT current_date, COALESCE(status, 'New Lead'), COALESCE(department, ''), COUNT(*) FROM leads GROUP BY ALL`);
        await conn.run('COMMIT');
      } catch (err) {
        await conn.run('ROLLBACK');
        throw err;
      }
      this.lastSyncedAt = new Date();
      this.logger.debug(`Analytics synced ${rows} rows in ${Date.now() - started} ms`);

      const exportEvery = Number(process.env.ANALYTICS_EXPORT_MS || 10 * 60_000);
      if (this.parquetDir && Date.now() - this.lastExportAt >= exportEvery) {
        await this.exportParquet(conn, [...columns.keys()]);
        this.lastExportAt = Date.now();
      }
    } finally {
      conn.closeSync();
    }
  }

  /**
   * Parquet snapshots plus a views.sql, for ad-hoc analysis with the DuckDB
   * shell (`docker compose run --rm duckdb` in infra). The backend holds the
   * database file's lock, so other processes read these files instead.
   */
  private async exportParquet(conn: DuckDBConnection, tables: string[]) {
    const dir = this.parquetDir!;
    const names = [...tables, 'all_contacts', 'pipeline_daily'];
    for (const table of names) {
      const tmp = join(dir, `${table}.parquet.tmp`);
      await conn.run(`COPY (SELECT * FROM ${quote(table)}) TO '${tmp.replace(/'/g, "''")}' (FORMAT parquet)`);
      renameSync(tmp, join(dir, `${table}.parquet`));
    }
    writeFileSync(
      join(dir, 'views.sql'),
      names.map((t) => `CREATE OR REPLACE VIEW ${quote(t)} AS FROM '${t}.parquet';`).join('\n') + '\n',
    );
  }

  private async copyTable(conn: DuckDBConnection, table: string, cols: Column[]): Promise<number> {
    const data: Record<string, string | null>[] = await this.mysql.query(
      `SELECT ${cols.map((c) => `${selectExpr(c)} AS \`${c.name}\``).join(', ')} FROM \`${table}\``,
    );
    const stage = quote(`stage_${table}`);
    await conn.run(`CREATE OR REPLACE TABLE ${stage} (${cols.map((c) => `${quote(c.name)} ${duckType(c.dataType)}`).join(', ')})`);
    const appender = await conn.createAppender(`stage_${table}`);
    for (const row of data) {
      for (const c of cols) {
        const v = row[c.name];
        if (v === null || v === undefined) appender.appendNull();
        else appender.appendVarchar(String(v));
      }
      appender.endRow();
    }
    appender.flushSync();
    appender.closeSync();
    return data.length;
  }
}

/**
 * Views over the mirror. `all_contacts` unions the per-module contact logs so
 * call counts cover leads, partners, listings, assets and HR alike.
 */
const CREATE_VIEWS = `
CREATE OR REPLACE VIEW all_contacts AS
  SELECT 'lead' AS entity, id, lead_id AS entity_id, sent_by_id, contact_type, call_direction, call_duration, source_call_id, created_at FROM contact_logs
  UNION ALL SELECT 'agent', id, agent_id, sent_by_id, contact_type, call_direction, call_duration, source_call_id, created_at FROM agent_contact_logs
  UNION ALL SELECT 'inbound', id, inbound_id, sent_by_id, contact_type, call_direction, call_duration, source_call_id, created_at FROM inbound_contact_logs
  UNION ALL SELECT 'asset', id, asset_id, sent_by_id, contact_type, call_direction, call_duration, source_call_id, created_at FROM asset_contact_logs
  UNION ALL SELECT 'hr', id, hr_candidate_id, sent_by_id, contact_type, call_direction, call_duration, source_call_id, created_at FROM hr_contact_logs;
`;
