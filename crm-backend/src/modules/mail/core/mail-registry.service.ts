import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { COMPOSER_SENDERS, MAIL_IDENTITIES, type MailIdentityKey } from '../identities';
import { defineMailEvent, type MailEntity, type MailEventDefinition } from './mail-event';

/** Event key prefix for emails written by staff in the composer. */
export const MANUAL_PREFIX = 'manual.';

/** Every mail event (and its record type) registered by a module through MailModule.forFeature(). */
@Injectable()
export class MailRegistry {
  private readonly events = new Map<string, MailEventDefinition>();
  private readonly entities = new Map<string, MailEntity>();
  private readonly manuals = new Map<string, MailEventDefinition>();

  register(definitions: MailEventDefinition[]) {
    for (const definition of definitions) {
      const existing = this.events.get(definition.key);
      if (existing && existing !== definition) throw new Error(`Mail event "${definition.key}" is registered twice`);
      if (!(definition.identity in MAIL_IDENTITIES)) {
        throw new Error(`Mail event "${definition.key}" uses unknown identity "${definition.identity}"`);
      }
      const entity = this.entities.get(definition.entityType);
      if (entity && entity !== definition.entity) {
        throw new Error(`Record type "${definition.entityType}" is defined by two different mail entities`);
      }
      this.entities.set(definition.entityType, definition.entity);
      this.events.set(definition.key, definition);
    }
  }

  get(key: string): MailEventDefinition {
    const definition = this.events.get(key);
    if (!definition) throw new NotFoundException(`Unknown email type "${key}"`);
    return definition;
  }

  all(): MailEventDefinition[] {
    return [...this.events.values()];
  }

  forEntity(entityType: string): MailEventDefinition[] {
    return this.all().filter((definition) => definition.entityType === entityType);
  }

  entity(entityType: string): MailEntity {
    const entity = this.entities.get(entityType);
    if (!entity) throw new NotFoundException(`No emails are set up for "${entityType}" records`);
    return entity;
  }

  allEntities(): MailEntity[] {
    return [...this.entities.values()];
  }

  /**
   * Mailboxes that can write to a record type: its own first, then any
   * COMPOSER_SENDERS (e.g. finance@ on leads). `module` decides the permission.
   */
  senders(entityType: string): { identity: MailIdentityKey; module: string }[] {
    const entity = this.entity(entityType);
    const extra = COMPOSER_SENDERS.filter((s) => s.entityTypes.includes(entityType) && s.identity !== entity.identity);
    return [{ identity: entity.identity, module: entity.module }, ...extra.map(({ identity, module }) => ({ identity, module }))];
  }

  /**
   * The "email written by staff" type for a record: no triggers, no checks beyond
   * a valid recipient, a fresh idempotency key per send. Not listed in all().
   * Another mailbox's version is keyed "manual.<entityType>@<identity>".
   */
  manual(entityType: string, identity?: string): MailEventDefinition {
    const entity = this.entity(entityType);
    const sender = this.senders(entityType).find((s) => s.identity === (identity || entity.identity));
    if (!sender) throw new BadRequestException(`That mailbox can't write to ${entity.label.toLowerCase()} records`);
    const key = sender.identity === entity.identity ? `${MANUAL_PREFIX}${entityType}` : `${MANUAL_PREFIX}${entityType}@${sender.identity}`;
    const existing = this.manuals.get(key);
    if (existing) return existing;
    const definition: MailEventDefinition = {
      ...defineMailEvent({
        key,
        entity,
        label: sender.identity === entity.identity ? 'Email' : `Email from ${MAIL_IDENTITIES[sender.identity].from}`,
        description: 'Written by staff in the composer.',
        mode: 'confirm',
        version: 1,
        idempotencyKey: () => `${key}:${randomUUID()}`,
        template: { subject: '', body: '' },
      }),
      identity: sender.identity,
      module: sender.module,
    };
    this.manuals.set(key, definition);
    return definition;
  }

  /** Any stored event key, including composer emails. */
  resolve(key: string): MailEventDefinition {
    if (!key.startsWith(MANUAL_PREFIX)) return this.get(key);
    const [entityType, identity] = key.slice(MANUAL_PREFIX.length).split('@');
    return this.manual(entityType, identity);
  }
}
