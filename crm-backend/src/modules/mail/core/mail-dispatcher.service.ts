import { Inject, Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { MailOutbox } from '../../../database/entities/mail-outbox.entity';
import { MailSuppression } from '../../../database/entities/mail-suppression.entity';
import { MAIL_IDENTITIES, type MailIdentityKey } from '../identities';
import type { MailConfig } from './mail-config';
import { applyRedirect, isPermanentFailure, nextRetryAt } from './mail-policy';
import { MAIL_CONFIG, MailTransports } from './mail-transports.service';
import { MANUAL_PREFIX, MailRegistry } from './mail-registry.service';
import type { MailEventDefinition } from './mail-event';
import { MailAttachmentsService } from '../attachments/mail-attachments.service';

const BATCH_SIZE = 10;
const STUCK_AFTER_MS = 10 * 60_000;
const PURGE_EVERY_MS = 6 * 3600_000;
const DAY_MS = 24 * 3600_000;

/**
 * Background worker. Housekeeping (expire drafts, purge old bodies) always runs;
 * delivery only runs when MAIL_ENABLED=true. Rows are claimed with a conditional
 * UPDATE, so a second backend container can never send the same mail twice.
 */
@Injectable()
export class MailDispatcher implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(MailDispatcher.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private lastPurgeAt = 0;
  private readonly lastSendAt = new Map<string, number>();

  constructor(
    @InjectRepository(MailOutbox) private readonly outbox: Repository<MailOutbox>,
    @InjectRepository(MailSuppression) private readonly suppressions: Repository<MailSuppression>,
    @Inject(MAIL_CONFIG) private readonly config: MailConfig,
    private readonly transports: MailTransports,
    private readonly registry: MailRegistry,
    private readonly dataSource: DataSource,
    private readonly attachments: MailAttachmentsService,
  ) {}

  onApplicationBootstrap() {
    if (!this.config.enabled) {
      this.logger.warn('Mail sending is disabled (MAIL_ENABLED is not "true"); emails stay queued.');
    } else {
      const missing = (Object.keys(MAIL_IDENTITIES) as MailIdentityKey[]).filter((key) => !this.transports.hasCredentials(key));
      if (missing.length) this.logger.warn(`No app password configured for: ${missing.join(', ')}. Their emails stay queued.`);
      if (this.config.redirectTo) this.logger.warn(`Mail redirect is ON: every email goes to ${this.config.redirectTo}`);
    }
    this.timer = setInterval(() => void this.tick(), this.config.pollIntervalMs);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async tick(now = new Date()) {
    if (this.running) return;
    this.running = true;
    try {
      await this.expireDrafts(now);
      await this.recoverStuck(now);
      await this.purgeOldBodies(now);
      if (this.config.enabled) await this.processBatch(now);
    } catch (error) {
      this.logger.error(`Mail dispatcher tick failed: ${(error as Error).message}`);
    } finally {
      this.running = false;
    }
  }

  private async expireDrafts(now: Date) {
    await this.outbox
      .createQueryBuilder()
      .update(MailOutbox)
      .set({ status: 'cancelled', last_error: 'Draft expired without being sent' })
      .where("status = 'draft' AND expires_at IS NOT NULL AND expires_at < :now", { now })
      .execute();
    // Scheduled emails (e.g. reminders) that couldn't go out in time would arrive too late.
    await this.outbox
      .createQueryBuilder()
      .update(MailOutbox)
      .set({ status: 'cancelled', last_error: 'Not sent in time; no longer relevant' })
      .where("status = 'pending' AND expires_at IS NOT NULL AND expires_at < :now", { now })
      .execute();
  }

  /** A crash mid-send leaves a row in "sending"; put it back in the queue. */
  private async recoverStuck(now: Date) {
    await this.outbox
      .createQueryBuilder()
      .update(MailOutbox)
      .set({ status: 'pending' })
      .where("status = 'sending' AND updated_at < :cutoff", { cutoff: new Date(now.getTime() - STUCK_AFTER_MS) })
      .execute();
  }

  /** Keep who/what/when forever, but drop message bodies after the retention period. */
  private async purgeOldBodies(now: Date) {
    if (now.getTime() - this.lastPurgeAt < PURGE_EVERY_MS) return;
    this.lastPurgeAt = now.getTime();
    await this.outbox
      .createQueryBuilder()
      .update(MailOutbox)
      .set({ html: null, text: null })
      .where('created_at < :cutoff AND (html IS NOT NULL OR text IS NOT NULL)', {
        cutoff: new Date(now.getTime() - this.config.retentionDays * DAY_MS),
      })
      .execute();
    await this.attachments.purge(now, this.config.retentionDays);
  }

  private async processBatch(now: Date) {
    const due = await this.outbox
      .createQueryBuilder('m')
      .select('m.id', 'id')
      .where("m.status = 'pending'")
      .andWhere('(m.next_attempt_at IS NULL OR m.next_attempt_at <= :now)', { now })
      .orderBy('m.id', 'ASC')
      .limit(BATCH_SIZE)
      .getRawMany<{ id: number }>();
    for (const { id } of due) {
      const claimed = await this.outbox
        .createQueryBuilder()
        .update(MailOutbox)
        .set({ status: 'sending', attempts: () => 'attempts + 1' })
        .where("id = :id AND status = 'pending'", { id })
        .execute();
      if (!claimed.affected) continue;
      const row = await this.outbox.findOneBy({ id });
      if (row) await this.deliver(row, new Date());
    }
  }

  async deliver(row: MailOutbox, now: Date) {
    const identity = row.identity as MailIdentityKey;
    const to = row.to_json ?? [];
    const cc = row.cc_json ?? [];

    // The record may have been deleted after the email was queued: never write about it then.
    let definition: ReturnType<MailRegistry['resolve']> | null = null;
    try {
      definition = this.registry.resolve(row.event_key);
    } catch {
      definition = null; // an email type that was removed from the code: still deliver what was queued
    }
    if (definition && !(await definition.load(row.entity_id, { dataSource: this.dataSource, actorId: null }))) {
      await this.outbox.update(row.id, { status: 'cancelled', last_error: 'The record was deleted before sending' });
      return;
    }

    const blocked = await this.suppressions.find({ where: { email: In([...to, ...cc]) } });
    if (blocked.length) {
      await this.outbox.update(row.id, {
        status: 'suppressed',
        last_error: `On the do-not-mail list: ${blocked.map((b) => b.email).join(', ')}`,
      });
      return;
    }
    if (!(identity in MAIL_IDENTITIES) || !this.transports.hasCredentials(identity)) {
      return this.defer(row, now, 30 * 60_000, `No app password configured for ${row.identity}`);
    }
    const sentToday = await this.outbox
      .createQueryBuilder('m')
      .where("m.identity = :identity AND m.status = 'sent' AND m.sent_at >= :since", {
        identity,
        since: new Date(now.getTime() - DAY_MS),
      })
      .getCount();
    if (sentToday >= this.config.dailyCapPerIdentity) {
      return this.defer(row, now, 3600_000, `Daily limit of ${this.config.dailyCapPerIdentity} emails reached for ${identity}`);
    }

    await this.throttle(identity);
    const addressed = applyRedirect({ to, cc, subject: row.subject }, this.config.redirectTo);
    const headers: Record<string, string> = { 'X-Majestan-Mail-Id': String(row.id) };
    if (!row.confirmed_by) headers['Auto-Submitted'] = 'auto-generated';
    try {
      const messageId = await this.transports.send(identity, {
        ...addressed,
        replyTo: row.reply_to,
        html: row.html ?? '',
        text: row.text ?? '',
        headers,
        attachments: await this.attachments.filesFor(row.id),
      });
      const sentAt = new Date();
      await this.outbox.update(row.id, { status: 'sent', sent_at: sentAt, message_id: messageId, last_error: null, next_attempt_at: null });
      await this.logContact(row, definition, sentAt);
    } catch (error) {
      const err = error as { message?: string; responseCode?: number; code?: string };
      const retryAt = isPermanentFailure(err) ? null : nextRetryAt(row.attempts, now);
      const message = (err.message || 'Unknown SMTP error').slice(0, 1000);
      if (retryAt) {
        await this.outbox.update(row.id, { status: 'pending', next_attempt_at: retryAt, last_error: message });
      } else {
        await this.outbox.update(row.id, { status: 'failed', next_attempt_at: null, last_error: message });
        this.logger.error(`Mail #${row.id} (${row.event_key}) failed permanently: ${message}`);
      }
    }
  }

  /**
   * Adds the sent email to the record's contact activity. Keyed "mail:<id>" so it
   * is written once. No addresses: some roles must not see a record's contacts.
   * A failure here never affects the email, which has already gone.
   */
  private async logContact(row: MailOutbox, definition: MailEventDefinition | null, sentAt: Date) {
    try {
      const target = this.registry.entity(row.entity_type).contactLog;
      if (!target) return;
      const from = MAIL_IDENTITIES[row.identity as MailIdentityKey]?.from ?? row.identity;
      const label = row.event_key.startsWith(MANUAL_PREFIX) ? 'Email' : (definition?.label ?? 'Email');
      await this.dataSource.query(
        `INSERT INTO \`${target.table}\` (\`${target.column}\`, contact_type, subject, message, sent_by_id, source_call_id, created_at)
         VALUES (?, 'email', ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE id = id`,
        [row.entity_id, row.subject.slice(0, 255), `${label} · sent from ${from}`, row.confirmed_by ?? row.created_by ?? null, `mail:${row.id}`, sentAt],
      );
    } catch (error) {
      this.logger.warn(`Mail #${row.id} was sent but not added to contact activity: ${(error as Error).message}`);
    }
  }

  /** Put the row back without spending an attempt (the problem is on our side). */
  private async defer(row: MailOutbox, now: Date, delayMs: number, reason: string) {
    await this.outbox.update(row.id, {
      status: 'pending',
      attempts: Math.max(0, row.attempts - 1),
      next_attempt_at: new Date(now.getTime() + delayMs),
      last_error: reason,
    });
  }

  private async throttle(identity: string) {
    const wait = (this.lastSendAt.get(identity) ?? 0) + this.config.minSendIntervalMs - Date.now();
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    this.lastSendAt.set(identity, Date.now());
  }
}
