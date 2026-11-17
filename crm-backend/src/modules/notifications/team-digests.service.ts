import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { NotificationsService } from './notifications.service';
import { indiaNow } from './follow-up-reminders.service';
import { WORK_END_MIN } from '../dashboard/range';
import { LOST_STATUSES } from './notify-events';
import { leadRefs, plural, teamLeadsOf } from './recipients';

type Lost = { leadId: number; personId: number; person: string };

/**
 * End-of-day summaries for team leads, after 18:30 IST, Monday to Saturday:
 * the leads their team closed as lost today. One a day each, deduplicated
 * through the notifications table. Also prunes old notifications daily.
 */
@Injectable()
export class TeamDigestsService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(TeamDigestsService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly dataSource: DataSource,
    private readonly notifications: NotificationsService,
  ) {}

  onApplicationBootstrap() {
    if (process.env.NODE_ENV === 'test') return;
    this.timer = setInterval(() => void this.run(), 5 * 60_000);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async run(now = new Date()) {
    if (this.running) return;
    this.running = true;
    try {
      await this.lostLeads(now);
      await this.prune(now);
    } catch (error) {
      this.logger.error(`Team digests failed: ${(error as Error).message}`);
    } finally {
      this.running = false;
    }
  }

  private lastPruned: string | null = null;

  /** Once a day, early morning IST, old notifications are cleared out. */
  async prune(now: Date) {
    const { date, time } = indiaNow(now);
    if (this.lastPruned === date || time < '06:00') return;
    this.lastPruned = date;
    const removed = await this.notifications.pruneOld();
    if (removed) this.logger.log(`Pruned ${removed} old notifications`);
  }

  async lostLeads(now: Date) {
    const { date, time } = indiaNow(now);
    const [h, m] = time.split(':').map(Number);
    const sunday = new Date(`${date}T00:00:00Z`).getUTCDay() === 0;
    if (sunday || h * 60 + m < WORK_END_MIN) return;

    // Each lead once, credited to its owner (or whoever closed it, if it has none).
    const rows: Lost[] = await this.dataSource.query(
      `SELECT e.lead_id AS leadId, COALESCE(l.assigned_staff_id, e.actor_id) AS personId, u.name AS person
         FROM lead_events e
         JOIN leads l ON l.id = e.lead_id
         JOIN users u ON u.id = COALESCE(l.assigned_staff_id, e.actor_id)
        WHERE e.type = 'status_changed' AND e.to_value IN (?)
          AND DATE(CONVERT_TZ(e.created_at, '+00:00', '+05:30')) = ?
          AND l.status IN (?)
        GROUP BY e.lead_id, personId, u.name`,
      [LOST_STATUSES, date, LOST_STATUSES],
    );
    if (!rows.length) return;

    const tls = await teamLeadsOf(
      this.dataSource,
      rows.map((r) => Number(r.personId)),
    );
    const byTl = new Map<number, Lost[]>();
    for (const row of rows) {
      for (const tl of tls.get(Number(row.personId)) ?? [])
        byTl.set(tl, [...(byTl.get(tl) ?? []), row]);
    }
    if (!byTl.size) return;

    const sent: { user_id: number }[] = await this.dataSource.query(
      `SELECT DISTINCT user_id FROM notifications
        WHERE type = 'lost_leads_digest' AND user_id IN (?) AND DATE(CONVERT_TZ(created_at, '+00:00', '+05:30')) = ?`,
      [[...byTl.keys()], date],
    );
    const done = new Set(sent.map((r) => Number(r.user_id)));

    for (const [tl, list] of byTl) {
      if (done.has(tl)) continue;
      const counts = new Map<string, number>();
      for (const r of list)
        counts.set(r.person, (counts.get(r.person) ?? 0) + 1);
      const who = [...counts]
        .sort((a, b) => b[1] - a[1])
        .map(([name, n]) => `${name} ${n}`)
        .join(', ');
      await this.notifications.createNotification(
        tl,
        'Leads lost today',
        `Your team closed ${plural(list.length, 'lead')} as ${LOST_STATUSES.join(', ').replace(/, ([^,]*)$/, ' or $1')} today (${who}): ${leadRefs(list.map((r) => r.leadId))}.`,
        'lost_leads_digest',
      );
    }
  }
}
