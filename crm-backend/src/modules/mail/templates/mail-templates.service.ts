import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { MailTemplate } from '../../../database/entities/mail-template.entity';
import { MAIL_IDENTITIES } from '../identities';
import { COMMON_VARIABLE_DOCS, commonVariables } from '../core/mail-composer.service';
import type { MailEntity, MailTemplateSource } from '../core/mail-event';
import { MailRegistry } from '../core/mail-registry.service';
import { html } from '../render/html';
import { renderLayout } from '../render/layout';
import { fillHtml, fillText, sanitizeEmailHtml, type MailVariables } from '../render/template';

export interface TemplateInput {
  name?: string;
  subject: string;
  body: string;
  isActive?: boolean;
  /** Saved templates: the mailbox it is written for (finance@ on leads, …). */
  sender?: string;
}

/**
 * Editable wording: admin overrides of system emails (keyed by event) and saved
 * templates staff pick in the composer. Bodies are cleaned on save; variables are
 * filled (and cleaned again) only when an email is composed.
 */
@Injectable()
export class MailTemplatesService {
  constructor(
    @InjectRepository(MailTemplate) private readonly templates: Repository<MailTemplate>,
    private readonly registry: MailRegistry,
  ) {}

  /** Everything the templates page and the composer need for one record type. */
  async catalog(entityType: string) {
    const entity = this.registry.entity(entityType);
    const overrides = await this.templates.find({ where: { entity_type: entityType, event_key: Not(IsNull()) } });
    const saved = await this.templates.find({ where: { entity_type: entityType, event_key: IsNull() }, order: { name: 'ASC' } });
    return {
      entityType,
      label: entity.label,
      module: entity.module,
      from: MAIL_IDENTITIES[entity.identity].from,
      senders: this.registry.senders(entityType).map(({ identity }) => ({ key: identity, from: MAIL_IDENTITIES[identity].from })),
      variables: [...entity.variableDocs, ...COMMON_VARIABLE_DOCS],
      systemEmails: this.registry.forEntity(entityType).map((event) => {
        const override = overrides.find((row) => row.event_key === event.key && row.is_active);
        return {
          key: event.key,
          label: event.label,
          description: event.description,
          mode: event.mode,
          customized: Boolean(override),
          subject: override?.subject ?? event.template.subject,
          body: override?.body_html ?? event.template.body,
          defaultSubject: event.template.subject,
          defaultBody: event.template.body,
          updatedAt: override?.updated_at ?? null,
        };
      }),
      savedTemplates: saved.map((row) => this.toSaved(row)),
    };
  }

  /** Record types that have emails, for the templates page's tabs. */
  entities() {
    return this.registry.allEntities().map((entity) => ({
      entityType: entity.entityType,
      label: entity.label,
      module: entity.module,
      from: MAIL_IDENTITIES[entity.identity].from,
    }));
  }

  async saveEventOverride(eventKey: string, input: TemplateInput, actorId: number) {
    const event = this.registry.get(eventKey);
    const clean = this.clean(input);
    const existing = await this.templates.findOne({ where: { event_key: eventKey } });
    const row = existing ?? this.templates.create({ event_key: eventKey, created_by: actorId });
    Object.assign(row, {
      module: event.module,
      entity_type: event.entityType,
      name: event.label,
      subject: clean.subject,
      body_html: clean.body,
      is_active: true,
      updated_by: actorId,
    });
    await this.templates.save(row);
    return (await this.catalog(event.entityType)).systemEmails.find((e) => e.key === eventKey);
  }

  async resetEventOverride(eventKey: string) {
    const event = this.registry.get(eventKey);
    await this.templates.delete({ event_key: eventKey });
    return (await this.catalog(event.entityType)).systemEmails.find((e) => e.key === eventKey);
  }

  async createSaved(entityType: string, input: TemplateInput, actorId: number) {
    const sender = this.sender(entityType, input.sender);
    if (!input.name?.trim()) throw new BadRequestException('Template name is required');
    const clean = this.clean(input);
    const row = await this.templates.save(
      this.templates.create({
        module: sender.module,
        entity_type: entityType,
        event_key: null,
        name: input.name.trim().slice(0, 150),
        subject: clean.subject,
        body_html: clean.body,
        is_active: input.isActive ?? true,
        created_by: actorId,
        updated_by: actorId,
      }),
    );
    return this.toSaved(row);
  }

  async updateSaved(id: number, input: TemplateInput, actorId: number) {
    const row = await this.findSaved(id);
    const clean = this.clean(input);
    Object.assign(row, {
      module: input.sender ? this.sender(row.entity_type, input.sender).module : row.module,
      name: input.name?.trim() ? input.name.trim().slice(0, 150) : row.name,
      subject: clean.subject,
      body_html: clean.body,
      is_active: input.isActive ?? row.is_active,
      updated_by: actorId,
    });
    return this.toSaved(await this.templates.save(row));
  }

  async deleteSaved(id: number) {
    await this.templates.delete((await this.findSaved(id)).id);
    return { success: true };
  }

  /** A saved template for the composer, by id. */
  async getSaved(id: number): Promise<MailTemplateSource & { entityType: string; name: string }> {
    const row = await this.findSaved(id);
    return { entityType: row.entity_type, name: row.name, subject: row.subject, body: row.body_html };
  }

  /** Renders a template with sample values, for the editor's live preview (no record needed). */
  previewWithSamples(entityType: string, input: TemplateInput) {
    const entity = this.registry.entity(entityType);
    const identity = this.sender(entityType, input.sender).identity;
    const vars = { ...this.sampleVariables(entity), ...commonVariables(identity, null) };
    for (const doc of COMMON_VARIABLE_DOCS) if (doc.key.startsWith('sender.')) vars[doc.key] = doc.sample;
    const clean = this.clean(input);
    const subject = fillText(clean.subject, vars);
    const body = fillHtml(clean.body, vars);
    const unknown = [...new Set([...subject.unknown, ...body.unknown])];
    const team = MAIL_IDENTITIES[identity];
    const rendered = renderLayout({ subject: subject.text, bodyHtml: body.html, signature: ['Priya Raman', `${team.signature}, Majestan Realty`, '+91 98765 43210'] });
    return {
      subject: rendered.subject,
      html: rendered.html,
      issues: unknown.length ? [`Unknown placeholder${unknown.length > 1 ? 's' : ''}: ${unknown.map((u) => `{{${u}}}`).join(', ')}`] : [],
    };
  }

  private sampleVariables(entity: MailEntity): MailVariables {
    const vars: MailVariables = { ...commonVariables(entity.identity, null) };
    for (const doc of entity.variableDocs) {
      vars[doc.key] = doc.block
        ? html`<div style="margin:16px 0;padding:14px 16px;border:1px dashed #b8c3dc;border-radius:10px;background:#f5f7fb;color:#6b7280;font-size:13px">${doc.label} (filled in from the record)</div>`
        : doc.sample;
    }
    for (const doc of COMMON_VARIABLE_DOCS) if (doc.key.startsWith('sender.')) vars[doc.key] = doc.sample;
    return vars;
  }

  private clean(input: TemplateInput): { subject: string; body: string } {
    const subject = (input.subject ?? '').replace(/[\r\n]+/g, ' ').trim().slice(0, 500);
    const body = sanitizeEmailHtml(input.body ?? '');
    if (!subject) throw new BadRequestException('Subject is required');
    if (!body.replace(/<[^>]*>/g, '').trim() && !/\{\{/.test(body)) throw new BadRequestException('Message is required');
    return { subject, body };
  }

  /** A mailbox allowed to write to this record type; the record type's own by default. */
  private sender(entityType: string, identity?: string) {
    const senders = this.registry.senders(entityType);
    const match = identity ? senders.find((s) => s.identity === identity) : senders[0];
    if (!match) throw new BadRequestException("That mailbox can't write to these records");
    return match;
  }

  private async findSaved(id: number) {
    const row = await this.templates.findOne({ where: { id, event_key: IsNull() } });
    if (!row) throw new NotFoundException('Template not found');
    return row;
  }

  private toSaved(row: MailTemplate) {
    const senders = this.registry.senders(row.entity_type);
    return {
      id: row.id,
      sender: (senders.find((s) => s.module === row.module) ?? senders[0]).identity,
      name: row.name,
      subject: row.subject,
      body: row.body_html,
      isActive: row.is_active,
      updatedAt: row.updated_at,
    };
  }
}
