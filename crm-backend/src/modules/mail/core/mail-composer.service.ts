import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { MailSuppression } from '../../../database/entities/mail-suppression.entity';
import { MailTemplate } from '../../../database/entities/mail-template.entity';
import { User } from '../../../database/entities/user.entity';
import { MAIL_IDENTITIES, type MailIdentityKey } from '../identities';
import { COMPANY, renderLayout, type RenderedMail } from '../render/layout';
import { fillHtml, fillText, type MailVariables } from '../render/template';
import { cleanAddresses, type MailEventDefinition, type MailTemplateSource } from './mail-event';
import { contentHash } from './mail-policy';

export interface ComposedMail {
  definition: MailEventDefinition;
  entityId: number;
  to: string[];
  cc: string[];
  replyTo: string;
  rendered: RenderedMail;
  issues: string[];
  idempotencyKey: string;
  hash: string;
  /** The template actually used (default, admin override, or the composer's text). */
  template: MailTemplateSource;
}

export interface ComposeOptions {
  actorId?: number | null;
  note?: string | null;
  /** Text written or edited in the composer; replaces the stored template. */
  override?: MailTemplateSource | null;
  /** Extra recipients chosen in the composer (staff or other contacts). */
  cc?: string[];
  /** Attachment ids, part of the preview fingerprint so files can't change after preview. */
  attachmentIds?: number[];
}

interface Sender {
  name: string;
  email: string | null;
  phone: string | null;
}

/** Today in India as "28 October 2026". */
const todayInIndia = () =>
  new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());

/** Variables every email can use, whatever the record. */
export function commonVariables(identity: MailIdentityKey, sender: Sender | null): MailVariables {
  const team = MAIL_IDENTITIES[identity];
  return {
    'company.name': COMPANY.name,
    'company.phone': COMPANY.phone,
    'company.website': COMPANY.website,
    'company.address': COMPANY.address,
    'team.name': team.signature,
    'team.email': team.from,
    'sender.name': sender?.name ?? team.signature,
    'sender.phone': sender?.phone ?? COMPANY.phone,
    'sender.email': team.from,
    today: todayInIndia(),
  };
}

export const COMMON_VARIABLE_DOCS = [
  { key: 'sender.name', label: 'Your name (or the team name)', sample: 'Priya Raman' },
  { key: 'sender.phone', label: 'Your phone (or the office number)', sample: '+91 98765 43210' },
  { key: 'team.name', label: 'Team name', sample: 'Sales Team' },
  { key: 'team.email', label: 'Team email address', sample: 'sales@majestanrealty.com' },
  { key: 'company.name', label: 'Company name', sample: COMPANY.name },
  { key: 'company.phone', label: 'Office phone', sample: COMPANY.phone },
  { key: 'company.website', label: 'Website', sample: COMPANY.website },
  { key: 'company.address', label: 'Office address', sample: COMPANY.address },
  { key: 'today', label: "Today's date", sample: '28 October 2026' },
];

/** load → variables → template → check → render. Never sends or stores anything. */
@Injectable()
export class MailComposer {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(MailSuppression) private readonly suppressions: Repository<MailSuppression>,
    @InjectRepository(MailTemplate) private readonly templates: Repository<MailTemplate>,
  ) {}

  async compose(definition: MailEventDefinition, entityId: number, opts: ComposeOptions = {}): Promise<ComposedMail> {
    const actorId = opts.actorId ?? null;
    const data = await definition.load(entityId, { dataSource: this.dataSource, actorId });
    if (!data) throw new NotFoundException(`${definition.entityType} ${entityId} was not found`);

    const recipients = definition.recipients(data);
    const to = cleanAddresses(recipients.to);
    const cc = cleanAddresses([...(recipients.cc ?? []), ...(opts.cc ?? [])]).filter((address) => !to.includes(address));
    const issues: string[] = [];
    if (!to.length) issues.push('No valid email address on record');
    issues.push(...(definition.check?.(data) ?? []));
    if (to.length || cc.length) {
      const blocked = await this.suppressions.find({ where: { email: In([...to, ...cc]) } });
      for (const row of blocked) issues.push(`${row.email} is on the do-not-mail list`);
    }

    const sender = await this.sender(actorId);
    const vars: MailVariables = { ...commonVariables(definition.identity, sender), ...definition.entity.variables(data) };
    const template = opts.override ?? (await this.storedTemplate(definition.key)) ?? definition.template;

    const subject = fillText(template.subject, vars);
    const preheader = fillText(template.preheader ?? '', vars);
    const body = fillHtml(template.body, vars);
    const unknown = [...new Set([...subject.unknown, ...body.unknown, ...preheader.unknown])];
    if (unknown.length) issues.push(`Unknown placeholder${unknown.length > 1 ? 's' : ''}: ${unknown.map((u) => `{{${u}}}`).join(', ')}`);
    // Saved templates mark what staff must fill in, e.g. "[enter amount]".
    const blanks = [...new Set(`${subject.text} ${body.html}`.match(/\[(?:enter|add) [^\]<>]{1,60}\]/gi) ?? [])];
    if (blanks.length) issues.push(`Fill in: ${blanks.join(', ')}`);
    if (!subject.text) issues.push('Subject is empty');
    if (!body.html.replace(/<[^>]*>/g, '').trim()) issues.push('Message is empty');

    const team = MAIL_IDENTITIES[definition.identity];
    const rendered = renderLayout({
      subject: subject.text,
      bodyHtml: body.html,
      preheader: preheader.text,
      note: opts.note,
      signature: sender ? [sender.name, `${team.signature}, ${COMPANY.name}`, sender.phone ?? ''] : [team.signature, COMPANY.name],
    });
    return {
      definition,
      entityId,
      to,
      cc,
      replyTo: team.from,
      rendered,
      issues,
      idempotencyKey: definition.idempotencyKey(data, entityId),
      hash: contentHash({ subject: rendered.subject, html: rendered.html, to, cc, attachments: opts.attachmentIds ?? [] }),
      template,
    };
  }

  /** An admin's edited wording for a system email, if any. */
  private async storedTemplate(eventKey: string): Promise<MailTemplateSource | null> {
    const row = await this.templates.findOne({ where: { event_key: eventKey, is_active: true } });
    return row ? { subject: row.subject, body: row.body_html } : null;
  }

  /** Only name, email and phone: never ID or bank fields. */
  private async sender(actorId: number | null): Promise<Sender | null> {
    if (!actorId) return null;
    const user = await this.dataSource
      .getRepository(User)
      .findOne({ where: { id: actorId }, select: { id: true, name: true, email: true, phone: true } });
    return user ? { name: user.name, email: user.email ?? null, phone: user.phone ?? null } : null;
  }
}
