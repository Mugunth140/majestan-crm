import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { NotificationsService } from './notifications.service';
import { FIRST_CONTACT_ESCALATE_MIN, FIRST_CONTACT_SLA_MIN, waitingSql, workMinutesBetween } from '../leads/first-contact';
import { indiaNow } from './follow-up-reminders.service';
import { WORK_END_MIN } from '../dashboard/range';

type Waiting = { id: number; name: string | null; ownerId: number; owner: string | null; deptId: number | null; assignedAt: Date; nudged: number };

/** "1 h 20 min" of working time. */
export function waitedText(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h ? (m ? `${h} h ${m} min` : `${h} h`) : `${m} min`;
}

/**
 * Chases leads nobody has contacted yet. Every minute: after an hour of
 * working time the owner is reminded, after two hours the owner's team lead
 * is told. At the end of each working day managers and admins get one
 * summary of every lead still waiting. Each lead is chased once per owner
 * (leads.first_contact_nudged, reset by the database on reassignment).
 */
@Injectable()
export class FirstContactRemindersService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(FirstContactRemindersService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly dataSource: DataSource,
    private readonly notifications: NotificationsService,
  ) {}

  onApplicationBootstrap() {
    if (process.env.NODE_ENV === 'test') return;
    this.timer = setInterval(() => void this.run(), 60_000);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async run(now = new Date()) {
    if (this.running) return;
    this.running = true;
    try {
      await this.chase(now);
      await this.summary(now);
    } catch (error) {
      this.logger.error(`First-contact reminders failed: ${(error as Error).message}`);
    } finally {
      this.running = false;
    }
  }

  private async chase(now: Date) {
    const rows: Waiting[] = await this.dataSource.query(
      `SELECT l.id, l.name, l.assigned_staff_id AS ownerId, u.name AS owner, u.department_id AS deptId,
              l.assigned_at AS assignedAt, l.first_contact_nudged AS nudged
         FROM leads l JOIN users u ON u.id = l.assigned_staff_id
        WHERE ${waitingSql('l')} AND l.first_contact_nudged < 2`,
    );
    for (const row of rows) {
      const waited = workMinutesBetween(new Date(row.assignedAt), now);
      const nudged = Number(row.nudged);
      const step = waited >= FIRST_CONTACT_ESCALATE_MIN ? 2 : waited >= FIRST_CONTACT_SLA_MIN ? 1 : 0;
      if (step <= nudged) continue;
      // Mark first: a missed reminder is better than one repeated every minute.
      const marked = await this.dataSource.query(
        'UPDATE leads SET first_contact_nudged = ?, updated_at = updated_at WHERE id = ? AND first_contact_nudged = ? AND first_contacted_at IS NULL',
        [step, row.id, nudged],
      );
      if (!Number(marked?.affectedRows ?? marked?.[1] ?? 0)) continue;
      const name = row.name || `Lead #${row.id}`;
      if (nudged < 1) {
        await this.notifications.createNotification(
          Number(row.ownerId), 'Lead waiting for your first call',
          `${name} was assigned to you ${waitedText(waited)} of working time ago and hasn't been contacted yet.`,
          'first_contact_reminder', Number(row.id), 'lead',
        );
      }
      if (step === 2 && row.deptId) {
        const leads: { id: number }[] = await this.dataSource.query(
          `SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id
            WHERE u.department_id = ? AND r.name = 'Team Lead' AND u.is_active = 1 AND u.id <> ?`,
          [row.deptId, row.ownerId],
        );
        for (const tl of leads) {
          await this.notifications.createNotification(
            Number(tl.id), 'Lead not contacted',
            `${name} has waited ${waitedText(waited)} of working time for ${row.owner || 'its owner'}'s first contact.`,
            'first_contact_escalation', Number(row.id), 'lead',
          );
        }
      }
    }
  }

  /** Once a working day, after 18:30 IST: managers and admins hear how many leads still wait. */
  private async summary(now: Date) {
    const { date, time } = indiaNow(now);
    const [h, m] = time.split(':').map(Number);
    const sunday = new Date(`${date}T00:00:00Z`).getUTCDay() === 0;
    if (sunday || h * 60 + m < WORK_END_MIN) return;

    const [{ count }] = await this.dataSource.query(`SELECT COUNT(*) AS count FROM leads l WHERE ${waitingSql('l')}`);
    const waiting = Number(count);
    if (!waiting) return;
    const people: { id: number }[] = await this.dataSource.query(
      `SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id
        WHERE r.name IN ('Manager', 'Admin') AND u.is_active = 1
          AND NOT EXISTS (SELECT 1 FROM notifications n WHERE n.user_id = u.id AND n.type = 'first_contact_digest'
                           AND DATE(CONVERT_TZ(n.created_at, '+00:00', '+05:30')) = ?)`,
      [date],
    );
    for (const p of people) {
      await this.notifications.createNotification(
        Number(p.id), 'Leads waiting for first contact',
        `${waiting} ${waiting === 1 ? 'lead is' : 'leads are'} still waiting for a first call from their owner.`,
        'first_contact_digest',
      );
    }
  }
}
