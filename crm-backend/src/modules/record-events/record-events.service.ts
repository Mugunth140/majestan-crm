import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

/** The modules whose history lives in record_events (leads use lead_events). */
export type RecordEntity = 'inbound';

export interface RecordEventInput {
  entity: RecordEntity;
  entityId: number;
  actorId?: number | null;
  type: string;
  field?: string | null;
  from?: unknown;
  to?: unknown;
  meta?: Record<string, unknown> | null;
}

/** One entry of a record's Activity, in the same shape as the lead timeline. */
export interface ActivityItem {
  id: string;
  kind: string;
  at: string;
  actor: { id: number; name: string } | null;
  field: string | null;
  from: string | null;
  to: string | null;
  meta: Record<string, unknown> | null;
}

const text = (v: unknown): string | null => {
  if (v === undefined || v === null || v === '') return null;
  if (Array.isArray(v)) return v.length ? v.join(', ') : null;
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
};

/** Numbers come back from MySQL decimals as "15000.00": compare them as numbers. */
const same = (a: unknown, b: unknown) => {
  const x = text(a);
  const y = text(b);
  if (x === y) return true;
  return x !== null && y !== null && x.trim() !== '' && y.trim() !== '' && !isNaN(Number(x)) && !isNaN(Number(y)) && Number(x) === Number(y);
};

/**
 * Writes and reads the Activity history of non-lead records.
 * Recording never fails the change it describes: errors are logged and dropped.
 */
@Injectable()
export class RecordEventsService {
  private readonly logger = new Logger(RecordEventsService.name);

  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  async record(input: RecordEventInput | RecordEventInput[]): Promise<void> {
    const rows = Array.isArray(input) ? input : [input];
    if (!rows.length) return;
    try {
      await this.ds.query(
        `INSERT INTO record_events (entity, entity_id, actor_id, type, field, from_value, to_value, meta) VALUES ${rows.map(() => '(?, ?, ?, ?, ?, ?, ?, ?)').join(', ')}`,
        rows.flatMap((e) => [
          e.entity, e.entityId, e.actorId ?? null, e.type, e.field ?? null, text(e.from), text(e.to), e.meta ? JSON.stringify(e.meta) : null,
        ]),
      );
    } catch (err) {
      this.logger.warn(`Could not record ${rows[0].entity} event: ${(err as Error).message}`);
    }
  }

  /**
   * One `field_changed` event per field whose value differs between `before` and `after`.
   * Fields in `hidden` are recorded without their values (contact details).
   */
  async recordChanges(
    entity: RecordEntity, entityId: number, actorId: number | null,
    before: Record<string, unknown>, after: Record<string, unknown>, fields: string[], hidden: string[] = [],
  ): Promise<void> {
    const changes = fields
      .filter((f) => f in after && !same(before[f], after[f]))
      .map((f) => hidden.includes(f)
        ? { entity, entityId, actorId, type: 'field_changed', field: f, meta: { hidden: true } }
        : { entity, entityId, actorId, type: 'field_changed', field: f, from: before[f], to: after[f] });
    await this.record(changes);
  }

  /** The record's history, newest first. */
  async activity(entity: RecordEntity, entityId: number): Promise<ActivityItem[]> {
    const rows = await this.ds.query(
      `SELECT e.id, e.type, e.field, e.from_value, e.to_value, e.meta, e.created_at, u.id AS actor_id, u.name AS actor_name
         FROM record_events e LEFT JOIN users u ON u.id = e.actor_id
        WHERE e.entity = ? AND e.entity_id = ? ORDER BY e.created_at DESC, e.id DESC`,
      [entity, entityId],
    );
    const iso = (d: unknown) => (d instanceof Date ? d.toISOString() : new Date(String(d)).toISOString());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- raw rows
    return rows.map((r: any) => ({
      id: `e${r.id}`, kind: r.type, at: iso(r.created_at),
      actor: r.actor_id ? { id: Number(r.actor_id), name: r.actor_name } : null,
      field: r.field, from: r.from_value, to: r.to_value,
      meta: typeof r.meta === 'string' ? JSON.parse(r.meta) : r.meta,
    }));
  }
}
