import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { NotificationsService } from './notifications.service';
import { NON_QUEUEABLE_LEAD_STATUSES } from '../leads/lead-statuses';

/** A follow-up with no time set is due at the start of the working day. */
export const DEFAULT_DUE_TIME = '09:00';

/** Records with follow-ups, read the same way as each module's Action Required view. */
interface ReminderSource {
  /** Notification entity_type, which the app turns into a link. */
  entityType: 'lead' | 'inbound' | 'agent' | 'hr';
  table: string;
  recordTable: string;
  foreignKey: string;
  name: string;
  /** Who is reminded: the assigned staff member, else whoever logged the follow-up. */
  recipient: string;
  /** Records that no longer need following up. */
  eligible: string;
  params: unknown[];
}

export const REMINDER_SOURCES: ReminderSource[] = [
  {
    entityType: 'lead',
    table: 'lead_follow_ups',
    recordTable: 'leads',
    foreignKey: 'lead_id',
    name: 'r.name',
    recipient: 'COALESCE(r.assigned_staff_id, f.created_by_id)',
    eligible: `r.status NOT IN (${NON_QUEUEABLE_LEAD_STATUSES.map(() => '?').join(', ')}) AND r.is_unqualified = 0`,
    params: [...NON_QUEUEABLE_LEAD_STATUSES],
  },
  {
    entityType: 'inbound',
    table: 'inbound_follow_ups',
    recordTable: 'inbounds',
    foreignKey: 'inbound_id',
    name: "COALESCE(NULLIF(r.owner_name, ''), r.property_title)",
    recipient: 'COALESCE(r.assigned_staff_id, f.created_by_id)',
    eligible: "r.is_queued = 0 AND r.status NOT IN ('Closed', 'Rejected')",
    params: [],
  },
  {
    entityType: 'agent',
    table: 'agent_follow_ups',
    recordTable: 'agents',
    foreignKey: 'agent_id',
    name: 'r.name',
    recipient: 'COALESCE(r.assigned_staff_id, f.created_by_id)',
    eligible: '1 = 1',
    params: [],
  },
  {
    entityType: 'hr',
    table: 'hr_follow_ups',
    recordTable: 'hr_candidates',
    foreignKey: 'hr_candidate_id',
    name: 'r.name',
    recipient: 'r.assignedStaffId',
    eligible: "r.status NOT IN ('Joined', 'Rejected')",
    params: [],
  },
];

const MODULE_LABELS: Record<ReminderSource['entityType'], string> = {
  lead: 'Lead',
  inbound: 'Inbound',
  agent: 'Agent',
  hr: 'Candidate',
};

/** India wall-clock date and time, which is how follow-ups are entered. */
export function indiaNow(now: Date) {
  const date = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const time = now.toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour12: false, hour: '2-digit', minute: '2-digit' });
  return { date, time };
}

/** "2:30 PM" from "14:30:00". */
export function formatDueTime(time: string) {
  const [h, m] = time.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

/**
 * Tells staff when a follow-up comes due. Every minute it looks for records
 * whose latest follow-up is scheduled for today at or before now, and sends
 * one notification per due slot to whoever owns the record.
 */
@Injectable()
export class FollowUpRemindersService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(FollowUpRemindersService.name);
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
      for (const source of REMINDER_SOURCES) await this.remind(source, now);
    } catch (error) {
      this.logger.error(`Follow-up reminders failed: ${(error as Error).message}`);
    } finally {
      this.running = false;
    }
  }

  private async remind(source: ReminderSource, now: Date) {
    const { date, time } = indiaNow(now);
    const due = `LEFT(COALESCE(f.next_follow_up_time, '${DEFAULT_DUE_TIME}'), 5)`;
    const rows: { followUpId: number; recordId: number; name: string; userId: number | null; due: string }[] =
      await this.dataSource.query(
        `SELECT f.id AS followUpId, r.id AS recordId, ${source.name} AS name, ${source.recipient} AS userId, ${due} AS due
         FROM (
           SELECT *, ROW_NUMBER() OVER (PARTITION BY ${source.foreignKey} ORDER BY created_at DESC, id DESC) AS rn
           FROM ${source.table}
           WHERE ${source.foreignKey} IN (SELECT ${source.foreignKey} FROM ${source.table} WHERE next_follow_up_date = ?)
         ) f
         JOIN ${source.recordTable} r ON r.id = f.${source.foreignKey}
         WHERE f.rn = 1 AND f.next_follow_up_date = ? AND ${due} <= ?
           AND (f.reminded_for IS NULL OR f.reminded_for <> CONCAT(?, ' ', ${due}))
           AND ${source.eligible}`,
        [date, date, time, date, ...source.params],
      );
    for (const row of rows) {
      // Mark first: a missed reminder is better than one repeated every minute.
      await this.dataSource.query(`UPDATE ${source.table} SET reminded_for = ? WHERE id = ?`, [`${date} ${row.due}`, row.followUpId]);
      if (!row.userId) continue;
      await this.notifications.createNotification(
        Number(row.userId),
        'Follow-up due',
        `${row.name || `${MODULE_LABELS[source.entityType]} #${row.recordId}`} · ${MODULE_LABELS[source.entityType]} · ${formatDueTime(row.due)}`,
        'followup_reminder',
        Number(row.recordId),
        source.entityType,
      );
    }
  }
}
