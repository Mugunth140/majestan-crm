import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataSource } from 'typeorm';
import { WhatsappService } from './whatsapp.service';
import { WhatsappSendService, whatsappNumber } from './whatsapp-send.service';
import {
  automationValues,
  loadLeadMailData,
  WHATSAPP_AUTOMATIONS,
  type WhatsappAutomation,
} from './whatsapp-automations';
import {
  missingField,
  renderTemplate,
  templateComponents,
  valuesFor,
} from './whatsapp-templates';

/** Wait this long after the event, so a visit moved twice in a row sends one message. */
export const HOLD_SECONDS = 120;
const TICK_MS = 30_000;
const MAX_ATTEMPTS = 3;

interface OutboxRow {
  id: number;
  automation: string;
  lead_id: number;
  attempts: number;
}

const message = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

/**
 * Sends the automatic WhatsApp messages in WHATSAPP_AUTOMATIONS: events queue a
 * row in whatsapp_outbox, and every 30 seconds due rows go out with the lead's
 * latest details. Anything that can't go out is kept with the reason.
 */
@Injectable()
export class WhatsappAutomationService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(WhatsappAutomationService.name);
  private timers: ReturnType<typeof setInterval>[] = [];
  private running = false;

  constructor(
    private readonly dataSource: DataSource,
    private readonly events: EventEmitter2,
    private readonly whatsapp: WhatsappService,
    private readonly sender: WhatsappSendService,
  ) {}

  onApplicationBootstrap() {
    if (!this.whatsapp.isConfigured() || process.env.NODE_ENV === 'test')
      return;
    for (const automation of WHATSAPP_AUTOMATIONS) {
      for (const trigger of automation.triggers ?? []) {
        this.events.on(trigger.on, (payload: Record<string, unknown>) => {
          const leadId = Number(payload?.entityId);
          if (!Number.isInteger(leadId) || leadId <= 0) return;
          if (trigger.when && !trigger.when(payload ?? {})) return;
          void this.enqueue(automation, leadId).catch((error) =>
            this.logger.warn(
              `Could not queue WhatsApp ${automation.key} for lead ${leadId}: ${message(error)}`,
            ),
          );
        });
      }
      if (automation.schedule) {
        const every = automation.schedule.everyMinutes * 60_000;
        this.timers.push(
          setInterval(() => void this.runSchedule(automation), every),
        );
      }
    }
    this.timers.push(setInterval(() => void this.tick(), TICK_MS));
  }

  onApplicationShutdown() {
    this.timers.forEach(clearInterval);
    this.timers = [];
  }

  /** Queues a message, or pushes back the one already waiting for this lead. */
  async enqueue(
    automation: WhatsappAutomation,
    leadId: number,
    holdSeconds = HOLD_SECONDS,
  ) {
    const bumped: { affectedRows?: number } = await this.dataSource.query(
      `UPDATE whatsapp_outbox SET send_after = NOW() + INTERVAL ? SECOND
        WHERE automation = ? AND lead_id = ? AND status = 'pending'`,
      [holdSeconds, automation.key, leadId],
    );
    if (bumped?.affectedRows) return;
    await this.dataSource.query(
      `INSERT INTO whatsapp_outbox (automation, lead_id, status, send_after) VALUES (?, ?, 'pending', NOW() + INTERVAL ? SECOND)`,
      [automation.key, leadId, holdSeconds],
    );
  }

  /** Scheduled messages (the reminder) are queued once a day per lead. */
  async runSchedule(automation: WhatsappAutomation, now = new Date()) {
    try {
      const ids = await automation.schedule!.due({
        dataSource: this.dataSource,
        now,
      });
      for (const leadId of ids) {
        const recent: unknown[] = await this.dataSource.query(
          `SELECT id FROM whatsapp_outbox WHERE automation = ? AND lead_id = ? AND created_at >= NOW() - INTERVAL 20 HOUR
             AND status IN ('pending', 'sending', 'sent') LIMIT 1`,
          [automation.key, leadId],
        );
        if (!recent.length) await this.enqueue(automation, leadId, 0);
      }
    } catch (error) {
      this.logger.warn(
        `WhatsApp ${automation.key} schedule failed: ${message(error)}`,
      );
    }
  }

  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      const rows: OutboxRow[] = await this.dataSource.query(
        `SELECT id, automation, lead_id, attempts FROM whatsapp_outbox
          WHERE status = 'pending' AND send_after <= NOW() ORDER BY send_after, id LIMIT 20`,
      );
      for (const row of rows) {
        const claimed: { affectedRows?: number } = await this.dataSource.query(
          `UPDATE whatsapp_outbox SET status = 'sending', attempts = attempts + 1 WHERE id = ? AND status = 'pending'`,
          [row.id],
        );
        if (claimed?.affectedRows)
          await this.process({ ...row, attempts: row.attempts + 1 });
      }
    } catch (error) {
      this.logger.warn(`WhatsApp outbox run failed: ${message(error)}`);
    } finally {
      this.running = false;
    }
  }

  private async finish(
    id: number,
    status: 'sent' | 'skipped' | 'failed',
    fields: { reason?: string; template?: string; wamid?: string } = {},
  ): Promise<void> {
    await this.dataSource.query(
      `UPDATE whatsapp_outbox SET status = ?, reason = ?, template_name = COALESCE(?, template_name), wa_message_id = COALESCE(?, wa_message_id) WHERE id = ?`,
      [
        status,
        fields.reason ?? null,
        fields.template ?? null,
        fields.wamid ?? null,
        id,
      ],
    );
  }

  /** Sends one queued message, or records why it didn't go. */
  async process(row: OutboxRow) {
    const automation = WHATSAPP_AUTOMATIONS.find(
      (a) => a.key === row.automation,
    );
    if (!automation)
      return this.finish(row.id, 'skipped', {
        reason: 'This automation no longer exists',
      });
    const data = await loadLeadMailData(row.lead_id, {
      dataSource: this.dataSource,
      actorId: null,
    });
    if (!data)
      return this.finish(row.id, 'skipped', {
        reason: 'The lead no longer exists',
      });
    const issues = automation.check?.(data) ?? [];
    if (issues.length)
      return this.finish(row.id, 'skipped', { reason: issues.join('; ') });

    const leadRows: {
      mobile_number: string | null;
      whatsapp_number: string | null;
    }[] = await this.dataSource.query(
      'SELECT mobile_number, whatsapp_number FROM leads WHERE id = ?',
      [row.lead_id],
    );
    const to = leadRows[0] ? whatsappNumber(leadRows[0]) : null;
    if (!to)
      return this.finish(row.id, 'skipped', {
        reason: 'The lead has no WhatsApp or mobile number',
      });

    // A moved visit gets the "rescheduled" template when one is approved.
    let name = automation.template;
    const key = automation.dedupeKey(data);
    if (automation.changedTemplate && automation.groupKey) {
      const earlier: unknown[] = await this.dataSource.query(
        `SELECT id FROM whatsapp_outbox WHERE automation = ? AND lead_id = ? AND status = 'sent' AND dedupe_key LIKE ? AND dedupe_key <> ? LIMIT 1`,
        [
          automation.key,
          row.lead_id,
          `${automation.groupKey(data).replace(/[%_\\]/g, '\\$&')}%`,
          key,
        ],
      );
      if (
        earlier.length &&
        (await this.whatsapp
          .approved(automation.changedTemplate)
          .catch(() => null))
      )
        name = automation.changedTemplate;
    }

    let template;
    try {
      template = await this.whatsapp.approved(name);
    } catch (error) {
      return this.retryOrFail(
        row,
        `Could not load templates: ${message(error)}`,
      );
    }
    if (!template)
      return this.finish(row.id, 'skipped', {
        reason: `No approved template named "${name}" in WhatsApp Manager`,
      });
    if (!template.supported)
      return this.finish(row.id, 'skipped', {
        reason: `Template "${name}" has a media header or code button, which automations can't fill`,
      });
    const values = valuesFor(
      template,
      automationValues(data),
      automation.order,
    );
    const missing = missingField(template, values);
    if (missing)
      return this.finish(row.id, 'skipped', {
        reason: `Template "${name}" uses {{${missing.key}}}, which this automation doesn't fill`,
        template: name,
      });

    // Claim the message before sending, so it can never go out twice.
    try {
      await this.dataSource.query(
        'UPDATE whatsapp_outbox SET dedupe_key = ? WHERE id = ?',
        [key, row.id],
      );
    } catch {
      return this.finish(row.id, 'skipped', {
        reason: 'Already sent',
        template: name,
      });
    }

    let wamid: string;
    try {
      wamid = await this.whatsapp.deliver(to, {
        type: 'template',
        template: {
          name: template.name,
          language: { code: template.language },
          components: templateComponents(template, values),
        },
      });
    } catch (error) {
      await this.dataSource.query(
        'UPDATE whatsapp_outbox SET dedupe_key = NULL WHERE id = ?',
        [row.id],
      );
      return this.retryOrFail(row, message(error), name);
    }
    await this.finish(row.id, 'sent', { template: name, wamid });
    await this.sender.record({
      wamid,
      to,
      leadId: row.lead_id,
      type: 'template',
      text: renderTemplate(template, values),
      subject: `Automatic: ${automation.label}`,
      sentBy: null,
    });
  }

  /** Meta or the network failed: try again in five minutes, up to three times. */
  private async retryOrFail(row: OutboxRow, reason: string, template?: string) {
    if (row.attempts < MAX_ATTEMPTS) {
      await this.dataSource.query(
        `UPDATE whatsapp_outbox SET status = 'pending', send_after = NOW() + INTERVAL 5 MINUTE, reason = ?, template_name = COALESCE(?, template_name) WHERE id = ?`,
        [reason, template ?? null, row.id],
      );
      return;
    }
    this.logger.warn(
      `WhatsApp ${row.automation} for lead ${row.lead_id} failed: ${reason}`,
    );
    await this.finish(row.id, 'failed', { reason, template });
  }
}
