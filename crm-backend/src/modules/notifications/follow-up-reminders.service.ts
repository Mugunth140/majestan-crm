import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { NotificationsService } from './notifications.service';
import { NON_QUEUEABLE_LEAD_STATUSES } from '../leads/lead-statuses';
import { FIRST_CONTACT_SLA_MIN, workMinutesBetween } from '../leads/first-contact';
import { leadRef, teamLeadsOf } from './recipients';

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
  /** Calls, messages and emails logged on the record: any after the due time count as following up. */
  contacts: { table: string; foreignKey: string };
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
    contacts: { table: 'contact_logs', foreignKey: 'lead_id' },
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
    contacts: { table: 'inbound_contact_logs', foreignKey: 'inbound_id' },
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
    contacts: { table: 'agent_contact_logs', foreignKey: 'agent_id' },
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
    contacts: { table: 'hr_contact_logs', foreignKey: 'hr_candidate_id' },
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
      for (const source of REMINDER_SOURCES) await this.escalate(source, now);
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
  /**
   * A follow-up still not done an hour of working time after it was due goes to
   * the owner's team leads. "Done" means a newer follow-up, or a call, message
   * or email logged on the record since the due time. Only today's follow-ups.
   */
  private async escalate(source: ReminderSource, now: Date) {
    const { date } = indiaNow(now);
    const due = `LEFT(COALESCE(f.next_follow_up_time, '${DEFAULT_DUE_TIME}'), 5)`;
    const rows: { followUpId: number; recordId: number; name: string; userId: number | null; owner: string | null; due: string }[] =
      await this.dataSource.query(
        `SELECT f.id AS followUpId, r.id AS recordId, ${source.name} AS name, ${source.recipient} AS userId, u.name AS owner, ${due} AS due
         FROM (
           SELECT *, ROW_NUMBER() OVER (PARTITION BY ${source.foreignKey} ORDER BY created_at DESC, id DESC) AS rn
           FROM ${source.table}
           WHERE ${source.foreignKey} IN (SELECT ${source.foreignKey} FROM ${source.table} WHERE next_follow_up_date = ?)
         ) f
         JOIN ${source.recordTable} r ON r.id = f.${source.foreignKey}
         LEFT JOIN users u ON u.id = ${source.recipient}
         WHERE f.rn = 1 AND f.next_follow_up_date = ?
           AND f.reminded_for = CONCAT(?, ' ', ${due})
           AND (f.escalated_for IS NULL OR f.escalated_for <> f.reminded_for)
           AND NOT EXISTS (
             SELECT 1 FROM ${source.contacts.table} c
              WHERE c.${source.contacts.foreignKey} = r.id AND c.sent_by_id IS NOT NULL
                AND c.created_at >= CONVERT_TZ(CONCAT(?, ' ', ${due}), '+05:30', '+00:00')
           )
           AND ${source.eligible}`,
        [date, date, date, date, ...source.params],
      );
    const late = rows.filter((row) => workMinutesBetween(new Date(`${date}T${row.due}:00+05:30`), now) >= FIRST_CONTACT_SLA_MIN);
    if (!late.length) return;
    const tls = await teamLeadsOf(this.dataSource, late.map((row) => Number(row.userId)).filter(Boolean));
    for (const row of late) {
      // Mark first, as with reminders.
      await this.dataSource.query(`UPDATE ${source.table} SET escalated_for = reminded_for WHERE id = ?`, [row.followUpId]);
      if (!row.userId) continue;
      const what = source.entityType === 'lead'
        ? leadRef(row.recordId)
        : `${MODULE_LABELS[source.entityType]} ${row.name || `#${row.recordId}`}`;
      const message = `${row.owner || 'Its owner'} hasn't followed up on ${what}, due at ${formatDueTime(row.due)}.`;
      for (const tl of tls.get(Number(row.userId)) ?? []) {
        await this.notifications.createNotification(tl, 'Follow-up missed', message, 'followup_missed', Number(row.recordId), source.entityType);
      }
    }
  }
}
