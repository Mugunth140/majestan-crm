import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { NotificationsService } from '../../notifications/notifications.service';
import type { InboundMessage, StatusUpdate } from './whatsapp-webhook';

// Numbers are matched on their last 10 digits, so +91 98765 43210, 098765 43210
// and 9876543210 are the same person.
const MATCH_DIGITS = 10;
const leadNumber = (column: string) =>
  `RIGHT(REGEXP_REPLACE(COALESCE(${column}, ''), '[^0-9]', ''), ${MATCH_DIGITS})`;

@Injectable()
export class WhatsappWebhookService {
  private readonly logger = new Logger(WhatsappWebhookService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly notifications: NotificationsService,
  ) {}

  async handle({
    messages,
    statuses,
  }: {
    messages: InboundMessage[];
    statuses: StatusUpdate[];
  }) {
    for (const message of messages) await this.receive(message);
    for (const status of statuses) await this.track(status);
  }

  /** The most recently updated lead holding this number, if any. */
  private async findLead(phone: string): Promise<{
    id: number;
    name: string;
    assigned_staff_id: number | null;
  } | null> {
    const key = phone.slice(-MATCH_DIGITS);
    if (key.length < MATCH_DIGITS) return null;
    const rows: {
      id: number;
      name: string;
      assigned_staff_id: number | null;
    }[] = await this.dataSource.query(
      `SELECT id, name, assigned_staff_id FROM leads
       WHERE ${leadNumber('whatsapp_number')} = ? OR ${leadNumber('mobile_number')} = ?
       ORDER BY updated_at DESC, id DESC LIMIT 1`,
      [key, key],
    );
    return rows[0] ?? null;
  }

  private async receive(message: InboundMessage) {
    const lead = await this.findLead(message.phone);
    const result: { affectedRows?: number } = await this.dataSource.query(
      `INSERT IGNORE INTO whatsapp_messages
         (wa_message_id, direction, phone, phone_number_id, contact_name, lead_id, message_type, body, media_id, status, sent_at)
       VALUES (?, 'in', ?, ?, ?, ?, ?, ?, ?, 'received', ?)`,
      [
        message.waMessageId,
        message.phone,
        message.phoneNumberId,
        message.contactName,
        lead?.id ?? null,
        message.type,
        message.body,
        message.mediaId,
        message.sentAt,
      ],
    );
    // Meta retries webhooks; a message already stored has already been logged and announced.
    if (!result?.affectedRows) return;
    if (!lead) {
      this.logger.log(
        `WhatsApp message from an unknown number (…${message.phone.slice(-4)})`,
      );
      return;
    }
    // The lead's Conversation shows contact_logs; sent_by_id stays empty so the
    // customer's message never counts toward a staff member's targets.
    await this.dataSource.query(
      `INSERT IGNORE INTO contact_logs (lead_id, contact_type, subject, message, sent_by_id, call_direction, source_call_id, created_at)
       VALUES (?, 'whatsapp', NULL, ?, NULL, 'incoming', ?, COALESCE(?, NOW()))`,
      [lead.id, message.body, `wa:${message.waMessageId}`, message.sentAt],
    );
    if (lead.assigned_staff_id) {
      const preview = (message.body ?? 'New message')
        .replace(/\s+/g, ' ')
        .slice(0, 120);
      await this.notifications
        .createNotification(
          lead.assigned_staff_id,
          `WhatsApp from ${lead.name}`,
          preview,
          'whatsapp_message',
          lead.id,
          'lead',
        )
        .catch((error) =>
          this.logger.warn(
            `WhatsApp notification failed: ${error instanceof Error ? error.message : error}`,
          ),
        );
    }
  }

  /** Delivery status of a message we sent. Statuses can arrive out of order, so one never moves backwards. */
  private async track(status: StatusUpdate) {
    const lead = await this.findLead(status.phone);
    await this.dataSource.query(
      `INSERT INTO whatsapp_messages (wa_message_id, direction, phone, phone_number_id, lead_id, message_type, status, error, sent_at)
       VALUES (?, 'out', ?, ?, ?, 'unknown', ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         error = IF(FIELD(VALUES(status), 'sent', 'delivered', 'read', 'failed') > FIELD(status, 'sent', 'delivered', 'read', 'failed'), VALUES(error), error),
         status = IF(FIELD(VALUES(status), 'sent', 'delivered', 'read', 'failed') > FIELD(status, 'sent', 'delivered', 'read', 'failed'), VALUES(status), status)`,
      [
        status.waMessageId,
        status.phone,
        status.phoneNumberId,
        lead?.id ?? null,
        status.status,
        status.error,
        status.at,
      ],
    );
  }
}
