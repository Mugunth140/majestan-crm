import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { REPORT_MODULES, reportModule, type ReportField, type ReportModule } from './report-modules';

/** Rows a preview may show; the page offers 20, 50 or 100. */
export const PREVIEW_SIZES = [20, 50, 100];
export const EXPORT_ROWS = 50_000;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export type ReportRequest = { module: string; fields: string[]; from?: string; to?: string; filters?: Record<string, string[]>; limit?: number };

/** IST midnight of a day, as the UTC timestamp the database stores. */
export function istStart(day: string) {
  return new Date(`${day}T00:00:00+05:30`).toISOString().slice(0, 19).replace('T', ' ');
}
const nextDay = (day: string) => new Date(Date.parse(`${day}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);

/** Checks a request against the registry and turns it into SQL with bound values. Never trusts a key it does not know. */
export function buildQuery(mod: ReportModule, req: ReportRequest, limit: number) {
  if (!Array.isArray(req.fields) || !req.fields.length) throw new BadRequestException('Choose at least one column');
  if (req.fields.length > 120) throw new BadRequestException('Too many columns');
  const fields = req.fields.map(k => {
    const field = mod.fields.find(x => x.key === k);
    if (!field) throw new BadRequestException(`Unknown column: ${String(k).slice(0, 40)}`);
    return field;
  });
  const where: string[] = [];
  const params: unknown[] = [];
  if (req.from) {
    if (!DATE.test(req.from)) throw new BadRequestException('Invalid start date');
    where.push(`${mod.date} >= ?`);
    params.push(istStart(req.from));
  }
  if (req.to) {
    if (!DATE.test(req.to)) throw new BadRequestException('Invalid end date');
    where.push(`${mod.date} < ?`);
    params.push(istStart(nextDay(req.to)));
  }
  for (const [key, values] of Object.entries(req.filters ?? {})) {
    const filter = mod.filters.find(x => x.key === key);
    if (!filter) throw new BadRequestException(`Unknown filter: ${key.slice(0, 40)}`);
    const list = (Array.isArray(values) ? values : []).map(String).filter(v => v.length <= 200).slice(0, 200);
    if (!list.length) continue;
    const blank = list.includes('__blank__');
    const real = list.filter(v => v !== '__blank__');
    const parts = [...(real.length ? [`${filter.sql} IN (${real.map(() => '?').join(', ')})`] : []), ...(blank ? [`NULLIF(TRIM(${filter.sql}), '') IS NULL`] : [])];
    where.push(`(${parts.join(' OR ')})`);
    params.push(...real);
  }
  const cond = where.length ? ` WHERE ${where.join(' AND ')}` : '';
  return {
    fields,
    sql: `SELECT ${fields.map((x, i) => `${x.sql} AS c${i}`).join(', ')} FROM ${mod.from}${cond} ORDER BY ${mod.order} LIMIT ${Math.trunc(limit)}`,
    countSql: `SELECT COUNT(*) AS n FROM ${mod.from}${cond}`,
    params,
  };
}

function cell(field: ReportField, v: unknown) {
  if (v === null || v === undefined || v === '') return null;
  if (field.type === 'bool') return Number(v) ? 'Yes' : 'No';
  if (field.type === 'number' || field.type === 'money') { const n = Number(v); return Number.isFinite(n) ? n : String(v); }
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.toISOString();
  if (Buffer.isBuffer(v)) return v.length === 1 ? (v[0] ? 'Yes' : 'No') : null;
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

@Injectable()
export class ReportsService {
  constructor(
    @InjectDataSource() private readonly crm: DataSource,
    @InjectDataSource('site') private readonly site: DataSource,
  ) {}

  private db(mod: ReportModule) {
    return mod.db === 'site' ? this.site : this.crm;
  }

  /** Every module with its columns and filters, and the choices each filter offers. */
  async catalog() {
    const staff: { id: number; name: string }[] = await this.crm.query('SELECT id, name FROM users WHERE is_active = 1 ORDER BY name');
    return Promise.all(REPORT_MODULES.map(async mod => ({
      key: mod.key, label: mod.label, description: mod.description, dateLabel: mod.dateLabel,
      fields: mod.fields.map(({ key, label, type, group, default: d }) => ({ key, label, type, group, default: !!d })),
      filters: await Promise.all(mod.filters.map(async x => ({
        key: x.key, label: x.label,
        options: x.options === 'staff'
          ? staff.map(s => ({ value: String(s.id), label: s.name }))
          : await this.distinct(mod, x.sql),
      }))),
    })));
  }

  private async distinct(mod: ReportModule, sql: string) {
    try {
      const rows: { v: string | null; n: number }[] = await this.db(mod).query(
        `SELECT ${sql} AS v, COUNT(*) AS n FROM ${mod.from} GROUP BY ${sql} ORDER BY n DESC LIMIT 300`,
      );
      const out = rows.filter(r => r.v !== null && String(r.v).trim() !== '').map(r => ({ value: String(r.v), label: String(r.v), count: Number(r.n) }));
      const blank = rows.filter(r => r.v === null || String(r.v).trim() === '').reduce((s, r) => s + Number(r.n), 0);
      return blank ? [...out, { value: '__blank__', label: 'Not set', count: blank }] : out;
    } catch {
      return [];
    }
  }

  /** Rows for the chosen columns. A preview shows 20, 50 or 100; an export stops at 50,000. */
  async run(req: ReportRequest, mode: 'preview' | 'export') {
    const mod = reportModule(String(req?.module ?? ''));
    if (!mod) throw new BadRequestException('Unknown report');
    const limit = mode === 'preview' ? (PREVIEW_SIZES.includes(Number(req.limit)) ? Number(req.limit) : PREVIEW_SIZES[0]) : EXPORT_ROWS;
    const q = buildQuery(mod, req, limit);
    const db = this.db(mod);
    const [rows, [count]] = await Promise.all([
      db.query(q.sql, q.params) as Promise<Record<string, unknown>[]>,
      db.query(q.countSql, q.params) as Promise<{ n: number }[]>,
    ]);
    const total = Number(count?.n ?? 0);
    return {
      module: mod.key, label: mod.label,
      columns: q.fields.map(x => ({ key: x.key, label: x.label, type: x.type })),
      rows: rows.map(r => q.fields.map((x, i) => cell(x, r[`c${i}`]))),
      total, truncated: total > limit,
    };
  }
}
