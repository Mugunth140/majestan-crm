import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { LeadEvent } from '../../database/entities/lead-event.entity';

export type LeadEventType =
  | 'created'
  | 'status_changed'
  | 'field_changed'
  | 'requirement_changed'
  | 'qualification_changed'
  | 'visit_scheduled'
  | 'document_added'
  | 'document_removed';

export interface LeadEventInput {
  leadId: number;
  actorId?: number | null;
  type: LeadEventType;
  field?: string | null;
  from?: unknown;
  to?: unknown;
  meta?: Record<string, unknown> | null;
}

export interface TimelineItem {
  id: string;
  kind: LeadEventType | 'routing';
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
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
};

/**
 * Writes and reads the lead history behind the Timeline tab and analytics.
 * Recording never fails the change it describes: errors are logged and dropped.
 */
@Injectable()
export class LeadEventsService {
  private readonly logger = new Logger(LeadEventsService.name);

  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  async record(input: LeadEventInput | LeadEventInput[], manager?: EntityManager): Promise<void> {
    const rows = (Array.isArray(input) ? input : [input]).map((e) => ({
      lead_id: e.leadId,
      actor_id: e.actorId ?? null,
      type: e.type,
      field: e.field ?? null,
      from_value: text(e.from),
      to_value: text(e.to),
      meta: e.meta ?? null,
    }));
    if (!rows.length) return;
    try {
      await (manager ?? this.ds.manager).getRepository(LeadEvent).insert(rows as Partial<LeadEvent>[] as never);
    } catch (err) {
      this.logger.warn(`Could not record lead event: ${(err as Error).message}`);
    }
  }

  /** One `type` event per field whose value differs between `before` and `after`. */
  async recordChanges(
    leadId: number,
    actorId: number | null,
    type: 'field_changed' | 'requirement_changed',
    before: Record<string, unknown>,
    after: Record<string, unknown>,
    fields: string[],
    meta?: Record<string, unknown>,
  ): Promise<void> {
    const changes = fields
      .filter((f) => text(before[f]) !== text(after[f]))
      .map((f) => ({ leadId, actorId, type, field: f, from: before[f], to: after[f], meta: meta ?? null }));
    await this.record(changes);
  }

  @OnEvent('leads.lead.created')
  async onCreated(e: { entityId: number; actorId: number | null }) {
    const [lead] = await this.ds.query('SELECT status, lead_source FROM leads WHERE id = ?', [e.entityId]);
    await this.record({ leadId: e.entityId, actorId: e.actorId, type: 'created', to: lead?.status, meta: { source: lead?.lead_source ?? null } });
  }

  @OnEvent('leads.lead.status_changed')
  async onStatusChanged(e: { entityId: number; actorId: number | null; from: string | null; to: string; reason?: string | null }) {
    await this.record({
      leadId: e.entityId, actorId: e.actorId, type: 'status_changed', field: 'status', from: e.from, to: e.to,
      meta: e.reason ? { reason: e.reason } : null,
    });
  }

  @OnEvent('leads.site_visit.scheduled')
  async onVisitScheduled(e: { entityId: number; actorId: number | null }) {
    const [inq] = await this.ds.query(
      'SELECT visit_date, visit_slot, project_list, visit_location FROM lead_inquiries WHERE lead_id = ? ORDER BY id DESC LIMIT 1',
      [e.entityId],
    );
    const date = inq?.visit_date instanceof Date ? inq.visit_date.toISOString().slice(0, 10) : text(inq?.visit_date);
    await this.record({
      leadId: e.entityId, actorId: e.actorId, type: 'visit_scheduled',
      to: [date, text(inq?.visit_slot)?.slice(0, 5)].filter(Boolean).join(' '),
      meta: { project: inq?.project_list ?? null, location: inq?.visit_location ?? null },
    });
  }

  /** The lead's history, newest first: recorded events plus assignment history. */
  async timeline(leadId: number): Promise<TimelineItem[]> {
    const [events, routing] = await Promise.all([
      this.ds.query(
        `SELECT e.id, e.type, e.field, e.from_value, e.to_value, e.meta, e.created_at, u.id AS actor_id, u.name AS actor_name
           FROM lead_events e LEFT JOIN users u ON u.id = e.actor_id
          WHERE e.lead_id = ? ORDER BY e.created_at DESC, e.id DESC`,
        [leadId],
      ),
      this.ds.query(
        `SELECT r.id, r.event_type, r.feedback, r.department, r.created_at,
                a.id AS actor_id, a.name AS actor_name, f.name AS from_name, t.name AS to_name
           FROM routing_histories r
           LEFT JOIN users a ON a.id = r.actioned_by_id
           LEFT JOIN users f ON f.id = r.from_user_id
           LEFT JOIN users t ON t.id = r.to_user_id
          WHERE r.lead_id = ?`,
        [leadId],
      ),
    ]);
    const actor = (r: any) => (r.actor_id ? { id: Number(r.actor_id), name: r.actor_name } : null);
    const iso = (d: unknown) => (d instanceof Date ? d.toISOString() : new Date(String(d)).toISOString());
    const parse = (m: unknown) => (typeof m === 'string' ? JSON.parse(m) : (m as Record<string, unknown> | null));

    const items: TimelineItem[] = [
      ...events.map((r: any) => ({
        id: `e${r.id}`, kind: r.type, at: iso(r.created_at), actor: actor(r),
        field: r.field, from: r.from_value, to: r.to_value, meta: parse(r.meta),
      })),
      ...routing.map((r: any) => ({
        id: `r${r.id}`, kind: 'routing' as const, at: iso(r.created_at), actor: actor(r),
        field: r.event_type, from: r.from_name, to: r.to_name,
        meta: { feedback: r.feedback ?? null, department: r.department ?? null },
      })),
    ];
    return items.sort((a, b) => b.at.localeCompare(a.at));
  }
}
