import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { NotificationsService } from './notifications.service';
import {
  MILESTONE_STATUSES,
  NOTIFY_ASSIGNED,
  NOTIFY_LEAD_REPEAT,
  NOTIFY_QUEUE,
  NOTIFY_TARGETS,
} from './notify-events';
import type {
  AssignedEvent,
  LeadRepeatEvent,
  QueueEvent,
  RecordModule,
  TargetsEvent,
} from './notify-events';
import {
  audience,
  leadRef,
  leadRefs,
  plural,
  teamLeadsOf,
  teamLeadsOfDept,
  usersWithRoles,
} from './recipients';

/** How each module's records are named in a message. Leads go by their ID. */
const RECORDS: Record<
  Exclude<RecordModule, 'lead'>,
  { table: string; name: string; noun: string; nouns: string }
> = {
  inbound: {
    table: 'inbounds',
    name: "COALESCE(NULLIF(owner_name, ''), property_title)",
    noun: 'inbound property',
    nouns: 'inbound properties',
  },
  agent: { table: 'agents', name: 'name', noun: 'partner', nouns: 'partners' },
  hr: {
    table: 'hr_candidates',
    name: 'name',
    noun: 'candidate',
    nouns: 'candidates',
  },
};

const monthName = (month: string) =>
  new Date(`${month}-01T00:00:00Z`).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

function groupBy<T>(
  items: T[],
  key: (t: T) => number | null | undefined,
): Map<number, T[]> {
  const out = new Map<number, T[]>();
  for (const item of items) {
    const k = key(item);
    if (k == null) continue;
    const list = out.get(Number(k)) ?? [];
    list.push(item);
    out.set(Number(k), list);
  }
  return out;
}

/**
 * Turns what happens in the CRM into notifications for the people who need
 * to act on it: owners, their team leads, and admins. One message per person
 * per event, however many records it covers.
 */
@Injectable()
export class NotificationTriggersListener {
  private readonly logger = new Logger(NotificationTriggersListener.name);

  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly notifications: NotificationsService,
  ) {}

  private async send(
    userId: number,
    title: string,
    message: string,
    type: string,
    entityId?: number | null,
    entityType?: string,
  ) {
    await this.notifications.createNotification(
      userId,
      title,
      message,
      type,
      entityId ?? undefined,
      entityType,
    );
  }

  private async userNames(ids: number[]): Promise<Map<number, string>> {
    const wanted = [...new Set(ids.filter((id) => id != null))];
    if (!wanted.length) return new Map();
    const rows: { id: number; name: string }[] = await this.ds.query(
      'SELECT id, name FROM users WHERE id IN (?)',
      [wanted],
    );
    return new Map(rows.map((r) => [Number(r.id), r.name]));
  }

  /** "L04488" for leads, the record's name for everything else. */
  private async recordNames(
    module: RecordModule,
    ids: number[],
  ): Promise<Map<number, string>> {
    if (module === 'lead') return new Map(ids.map((id) => [id, leadRef(id)]));
    const { table, name } = RECORDS[module];
    const rows: { id: number; name: string | null }[] = ids.length
      ? await this.ds.query(
          `SELECT id, ${name} AS name FROM ${table} WHERE id IN (?)`,
          [ids],
        )
      : [];
    const names = new Map(
      rows.map((r) => [Number(r.id), r.name || `#${r.id}`]),
    );
    return new Map(ids.map((id) => [id, names.get(id) ?? `#${id}`]));
  }

  private describe(
    module: RecordModule,
    ids: number[],
    names: Map<number, string>,
  ): string {
    if (module === 'lead') return leadRefs(ids);
    const shown = ids.slice(0, 3).map((id) => names.get(id)!);
    const more = ids.length - shown.length;
    return more > 0 ? `${shown.join(', ')} and ${more} more` : shown.join(', ');
  }

  /** "L04488" for a lead, "Candidate Priya S" for the rest. */
  private label(module: RecordModule, name: string) {
    if (module === 'lead') return name;
    const noun = RECORDS[module].noun;
    return `${noun[0].toUpperCase()}${noun.slice(1)} ${name}`;
  }

  private nouns(module: RecordModule, n: number) {
    if (module === 'lead') return plural(n, 'lead');
    const r = RECORDS[module];
    return plural(n, r.noun, r.nouns);
  }

  // ── Assignments ─────────────────────────────────────────────────────────────

  @OnEvent(NOTIFY_ASSIGNED, { async: true })
  async onAssigned(e: AssignedEvent) {
    try {
      const changes = e.changes.filter((c) => c.from !== c.to);
      if (!changes.length) return;
      const names = await this.recordNames(
        e.module,
        changes.map((c) => c.id),
      );
      const people = await this.userNames(
        changes
          .flatMap((c) => [c.from, c.to])
          .filter((v): v is number => v != null),
      );

      if (!e.newOwnerTold) {
        for (const [to, list] of groupBy(changes, (c) => c.to)) {
          if (to === e.actorId) continue;
          const ids = list.map((c) => c.id);
          const one = ids.length === 1;
          const message = one
            ? `${this.label(e.module, names.get(ids[0])!)} was assigned to you.`
            : `${this.nouns(e.module, ids.length)} were assigned to you: ${this.describe(e.module, ids, names)}.`;
          await this.send(
            to,
            one ? 'Assigned to you' : `${ids.length} assigned to you`,
            message,
            'record_assigned',
            one ? ids[0] : null,
            e.module,
          );
        }
      }

      // Whoever lost the record should know it isn't theirs any more.
      for (const [from, list] of groupBy(changes, (c) => c.from)) {
        if (from === e.actorId) continue;
        const ids = list.map((c) => c.id);
        const owners = [
          ...new Set(
            list.map((c) =>
              c.to == null ? 'the queue' : (people.get(c.to) ?? 'someone else'),
            ),
          ),
        ];
        const where =
          owners.length === 1
            ? owners[0] === 'the queue'
              ? 'back to the queue'
              : `to ${owners[0]}`
            : 'to other people';
        const message =
          ids.length === 1
            ? `${this.label(e.module, names.get(ids[0])!)} was moved ${where}.`
            : `${this.nouns(e.module, ids.length)} were moved ${where}: ${this.describe(e.module, ids, names)}.`;
        await this.send(
          from,
          'Reassigned',
          message,
          'record_reassigned',
          ids.length === 1 ? ids[0] : null,
          e.module,
        );
      }
    } catch (error) {
      this.logger.error(
        `Assignment notifications failed: ${(error as Error).message}`,
      );
    }
  }

  // ── Repeat leads ────────────────────────────────────────────────────────────

  @OnEvent(NOTIFY_LEAD_REPEAT, { async: true })
  async onRepeat(e: LeadRepeatEvent) {
    try {
      const owned = e.leads.filter((l) => l.ownerId != null);
      if (!owned.length) return;
      const where =
        e.via === 'import'
          ? 'in an Excel import'
          : e.source
            ? `from ${e.source}`
            : 'again';
      const people = await this.userNames(owned.map((l) => l.ownerId!));

      for (const [owner, list] of groupBy(owned, (l) => l.ownerId)) {
        if (owner === e.actorId) continue;
        const ids = list.map((l) => l.id);
        const message =
          ids.length === 1
            ? `${leadRef(ids[0])} came in again ${where}. It's still yours.`
            : `${ids.length} of your leads came in again ${where}: ${leadRefs(ids)}.`;
        await this.send(
          owner,
          'Repeat lead',
          message,
          'lead_repeat',
          ids.length === 1 ? ids[0] : null,
          'lead',
        );
      }

      // Team leads hear about every repeat in their team, once.
      const tls = await teamLeadsOf(
        this.ds,
        owned.map((l) => l.ownerId!),
      );
      const byTl = new Map<number, typeof owned>();
      for (const lead of owned) {
        for (const tl of tls.get(lead.ownerId!) ?? [])
          byTl.set(tl, [...(byTl.get(tl) ?? []), lead]);
      }
      for (const [tl, list] of byTl) {
        if (tl === e.actorId) continue;
        const parts = list
          .slice(0, 5)
          .map(
            (l) => `${leadRef(l.id)} (${people.get(l.ownerId!) ?? 'owner'})`,
          );
        const more = list.length - parts.length;
        const message =
          list.length === 1
            ? `${parts[0]} came in again ${where}.`
            : `${list.length} of your team's leads came in again ${where}: ${parts.join(', ')}${more > 0 ? ` and ${more} more` : ''}.`;
        await this.send(
          tl,
          'Repeat lead',
          message,
          'lead_repeat_team',
          list.length === 1 ? list[0].id : null,
          'lead',
        );
      }
    } catch (error) {
      this.logger.error(
        `Repeat-lead notifications failed: ${(error as Error).message}`,
      );
    }
  }

  // ── Routing queue ───────────────────────────────────────────────────────────

  @OnEvent(NOTIFY_QUEUE, { async: true })
  async onQueue(e: QueueEvent) {
    try {
      let recipients = await teamLeadsOfDept(this.ds, 'telecalling');
      if (!recipients.length)
        recipients = await usersWithRoles(this.ds, ['Admin']);
      const leadIds = e.leadIds ?? [];
      const from = e.source ? ` from ${e.source}` : '';
      let message: string;
      if (e.enquiry)
        message = `New website enquiry ${e.enquiry.label}${e.enquiry.leadId ? ` (${leadRef(e.enquiry.leadId)})` : ''} is waiting in the routing queue.`;
      else if (leadIds.length === 1)
        message = `${leadRef(leadIds[0])}${from} is waiting in the routing queue.`;
      else if (leadIds.length)
        message = `${leadIds.length} new leads${from} are waiting in the routing queue: ${leadRefs(leadIds)}.`;
      else return;
      for (const id of audience(recipients, [e.actorId])) {
        await this.send(id, 'New in the routing queue', message, 'queue_new');
      }
    } catch (error) {
      this.logger.error(
        `Routing-queue notifications failed: ${(error as Error).message}`,
      );
    }
  }

  // ── Targets ─────────────────────────────────────────────────────────────────

  @OnEvent(NOTIFY_TARGETS, { async: true })
  async onTargets(e: TargetsEvent) {
    try {
      const month = monthName(e.month);
      for (const id of audience(e.userIds, [e.actorId])) {
        await this.send(
          id,
          e.changed ? 'Targets updated' : 'New targets',
          e.changed
            ? `Your targets for ${month} were changed. Open Tasks to see them.`
            : `Your targets for ${month} are set. Open Tasks to see them.`,
          'targets_set',
        );
      }
    } catch (error) {
      this.logger.error(
        `Target notifications failed: ${(error as Error).message}`,
      );
    }
  }

  // ── Milestones ──────────────────────────────────────────────────────────────

  @OnEvent('leads.lead.status_changed', { async: true })
  async onStatusChanged(e: {
    entityId: number;
    actorId: number | null;
    from: string | null;
    to: string;
  }) {
    try {
      if (!MILESTONE_STATUSES.includes(e.to) || e.from === e.to) return;
      const [lead] = await this.ds.query(
        'SELECT l.assigned_staff_id AS ownerId, u.name AS owner FROM leads l LEFT JOIN users u ON u.id = l.assigned_staff_id WHERE l.id = ?',
        [e.entityId],
      );
      const ownerId = lead?.ownerId != null ? Number(lead.ownerId) : null;
      const tls =
        ownerId != null
          ? ((await teamLeadsOf(this.ds, [ownerId])).get(ownerId) ?? [])
          : [];
      const bosses = await usersWithRoles(this.ds, ['Manager', 'Admin']);
      const message = `${leadRef(e.entityId)} reached ${e.to}${lead?.owner ? ` (${lead.owner})` : ''}.`;
      for (const id of audience([ownerId, ...tls, ...bosses], [e.actorId])) {
        await this.send(
          id,
          e.to,
          message,
          'lead_milestone',
          e.entityId,
          'lead',
        );
      }
    } catch (error) {
      this.logger.error(
        `Milestone notifications failed: ${(error as Error).message}`,
      );
    }
  }
}
