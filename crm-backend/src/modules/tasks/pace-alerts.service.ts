import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TasksService } from './tasks.service';
import { NotificationsService } from '../notifications/notifications.service';
import { indiaNow } from '../notifications/follow-up-reminders.service';
import { WORK_END_MIN, WORK_START_MIN } from '../dashboard/range';
import { teamLeadsOf } from '../notifications/recipients';

/** When the alert goes out: 15:00 IST, two thirds of the way through the working day. */
export const PACE_ALERT_MIN = 15 * 60;

/** Below this share of where today's goal should be by now, a target is "well behind" (red on the Tasks page). */
export const RED_BELOW = 0.4;

export type Behind = { label: string; goal: number; achieved: number };

/** Today's targets that are in the red band at `minute` (IST minutes since midnight). */
export function behindToday(metrics: Behind[], minute: number): Behind[] {
  const elapsed = Math.min(
    1,
    Math.max(0, (minute - WORK_START_MIN) / (WORK_END_MIN - WORK_START_MIN)),
  );
  if (!elapsed) return [];
  return metrics.filter(
    (m) =>
      m.goal > 0 &&
      m.achieved < m.goal &&
      m.achieved / (m.goal * elapsed) < RED_BELOW,
  );
}

const fmt = (m: Behind) =>
  `${m.label} ${Math.round(m.achieved)} of ${Math.round(m.goal)}`;

/**
 * Once a working day at 3 PM: anyone well behind on today's targets is told
 * which ones, and their team leads get one list of who is behind.
 */
@Injectable()
export class PaceAlertsService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(PaceAlertsService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly dataSource: DataSource,
    private readonly tasks: TasksService,
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
      await this.alert(now);
    } catch (error) {
      this.logger.error(`Pace alerts failed: ${(error as Error).message}`);
    } finally {
      this.running = false;
    }
  }

  async alert(now: Date) {
    const { date, time } = indiaNow(now);
    const [h, m] = time.split(':').map(Number);
    const minute = h * 60 + m;
    const sunday = new Date(`${date}T00:00:00Z`).getUTCDay() === 0;
    // Only in the hour after 3 PM, so a restart late in the day doesn't send a stale alert.
    if (sunday || minute < PACE_ALERT_MIN || minute >= PACE_ALERT_MIN + 60)
      return;

    const [{ sent }] = await this.dataSource.query(
      `SELECT COUNT(*) AS sent FROM notifications WHERE type IN ('pace_alert', 'pace_team') AND DATE(CONVERT_TZ(created_at, '+00:00', '+05:30')) = ?`,
      [date],
    );
    if (Number(sent)) return;

    const behind = (await this.tasks.todayStandings())
      .map((p) => ({ ...p, behind: behindToday(p.metrics, minute) }))
      .filter((p) => p.behind.length);
    if (!behind.length) return;

    for (const p of behind) {
      await this.notifications.createNotification(
        p.userId,
        "Behind on today's targets",
        `By now you'd usually be further along: ${p.behind.map(fmt).join(', ')}.`,
        'pace_alert',
      );
    }
    const tls = await teamLeadsOf(
      this.dataSource,
      behind.map((p) => p.userId),
    );
    const byTl = new Map<number, typeof behind>();
    for (const p of behind)
      for (const tl of tls.get(p.userId) ?? [])
        byTl.set(tl, [...(byTl.get(tl) ?? []), p]);
    for (const [tl, people] of byTl) {
      await this.notifications.createNotification(
        tl,
        "Team behind on today's targets",
        `${people.map((p) => `${p.name} (${p.behind.map(fmt).join(', ')})`).join('; ')}.`,
        'pace_team',
      );
    }
  }
}
