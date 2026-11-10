import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { leadScopeSql } from '../../leads/lead-scope';
import { WhatsappService } from './whatsapp.service';
import {
  missingField,
  renderTemplate,
  templateComponents,
} from './whatsapp-templates';

export interface WhatsappUser {
  id: number;
  role: string;
  department?: string;
  department_id?: number;
}

export interface SendWhatsapp {
  text?: string;
  template_name?: string;
  template_language?: string;
  values?: Record<string, unknown>;
}

interface LeadRow {
  id: number;
  name: string;
  mobile_number: string | null;
  whatsapp_number: string | null;
}

const SEES_ALL = new Set(['Admin', 'Super Admin', 'Manager']);
// WhatsApp lets a business reply freely for 24 hours after the customer's last message;
// outside it, only an approved template may be sent.
const WINDOW_HOURS = 24;

/** The number in international form: Indian numbers are often saved without +91. */
export function whatsappNumber(
  lead: Pick<LeadRow, 'mobile_number' | 'whatsapp_number'>,
): string | null {
  const raw = (lead.whatsapp_number || lead.mobile_number || '')
    .replace(/\D/g, '')
    .replace(/^0+/, '');
  if (raw.length === 10) return `91${raw}`;
  return raw.length >= 11 && raw.length <= 15 ? raw : null;
}

@Injectable()
export class WhatsappSendService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly whatsapp: WhatsappService,
  ) {}

  private async lead(user: WhatsappUser, leadId: number): Promise<LeadRow> {
    const scope = SEES_ALL.has(user.role) ? '' : leadScopeSql(user);
    const rows: LeadRow[] = await this.dataSource.query(
      `SELECT l.id, l.name, l.mobile_number, l.whatsapp_number FROM leads l WHERE l.id = ? ${scope} LIMIT 1`,
      [leadId],
    );
    if (!rows[0]) throw new NotFoundException('Lead not found');
    return rows[0];
  }

  /** Whether free text can be sent now, and until when. */
  async window(user: WhatsappUser, leadId: number) {
    const lead = await this.lead(user, leadId);
    const to = whatsappNumber(lead);
    if (!to)
      return {
        configured: this.whatsapp.isConfigured(),
        number: null,
        open: false,
        closes_at: null,
      };
    const rows: { last: string | Date | null; left: number | null }[] =
      await this.dataSource.query(
        `SELECT MAX(created_at) AS last,
              TIMESTAMPDIFF(SECOND, NOW(), MAX(created_at) + INTERVAL ${WINDOW_HOURS} HOUR) AS \`left\`
       FROM whatsapp_messages WHERE direction = 'in' AND (lead_id = ? OR RIGHT(phone, 10) = ?)`,
        [lead.id, to.slice(-10)],
      );
    const left = Number(rows[0]?.left ?? 0);
    return {
      configured: this.whatsapp.isConfigured(),
      number: to,
      open: left > 0,
      closes_at:
        left > 0 ? new Date(Date.now() + left * 1000).toISOString() : null,
    };
  }

  async send(user: WhatsappUser, leadId: number, body: SendWhatsapp) {
    const lead = await this.lead(user, leadId);
    const to = whatsappNumber(lead);
    if (!to)
      throw new BadRequestException(
        'This lead has no WhatsApp or mobile number',
      );

    let message: Record<string, unknown>;
    let text: string;
    let subject: string | null = null;
    let type: 'text' | 'template';
    if (body.template_name) {
      const templates = await this.whatsapp.templates();
      const template = templates.find(
        (t) =>
          t.name === body.template_name &&
          (!body.template_language || t.language === body.template_language),
      );
      if (!template)
        throw new BadRequestException(
          'That template is not approved on WhatsApp',
        );
      if (!template.supported)
        throw new BadRequestException(
          'Templates with a picture, video, document or code button can’t be sent from the CRM yet',
        );
      const values: Record<string, string> = {};
      for (const [key, value] of Object.entries(body.values ?? {}))
        if (typeof value === 'string') values[key] = value.slice(0, 1000);
      const missing = missingField(template, values);
      if (missing)
        throw new BadRequestException(
          `Fill in {{${missing.key}}} in the ${missing.part}`,
        );
      message = {
        type: 'template',
        template: {
          name: template.name,
          language: { code: template.language },
          components: templateComponents(template, values),
        },
      };
      text = renderTemplate(template, values);
      subject = `Template: ${template.name}`;
      type = 'template';
    } else {
      text = String(body.text ?? '').trim();
      if (!text)
        throw new BadRequestException('Write a message or pick a template');
      if (!(await this.window(user, leadId)).open)
        throw new BadRequestException(
          `${lead.name} hasn’t messaged in the last ${WINDOW_HOURS} hours, so WhatsApp only allows an approved template`,
        );
      message = { type: 'text', text: { preview_url: false, body: text } };
      type = 'text';
    }

    const wamid = await this.whatsapp.deliver(to, message);
    // A status webhook can arrive before this insert; it leaves a placeholder row to fill in.
    await this.dataSource.query(
      `INSERT INTO whatsapp_messages (wa_message_id, direction, phone, lead_id, message_type, body, status, sent_at)
       VALUES (?, 'out', ?, ?, ?, ?, 'sent', NOW())
       ON DUPLICATE KEY UPDATE lead_id = VALUES(lead_id), message_type = VALUES(message_type), body = VALUES(body), sent_at = VALUES(sent_at)`,
      [wamid, to, lead.id, type, text],
    );
    await this.dataSource.query(
      `INSERT IGNORE INTO contact_logs (lead_id, contact_type, subject, message, sent_by_id, call_direction, source_call_id)
       VALUES (?, 'whatsapp', ?, ?, ?, 'outgoing', ?)`,
      [lead.id, subject, text, user.id, `wa:${wamid}`],
    );
    return { id: wamid, to, text };
  }
}
