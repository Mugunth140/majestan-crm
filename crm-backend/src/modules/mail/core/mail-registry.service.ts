import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { MAIL_IDENTITIES } from '../identities';
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
   * The "email written by staff" type for a record: no triggers, no checks beyond
   * a valid recipient, a fresh idempotency key per send. Not listed in all().
   */
  manual(entityType: string): MailEventDefinition {
    const existing = this.manuals.get(entityType);
    if (existing) return existing;
    const entity = this.entity(entityType);
    const definition = defineMailEvent({
      key: `${MANUAL_PREFIX}${entityType}`,
      entity,
      label: 'Email',
      description: 'Written by staff in the composer.',
      mode: 'confirm',
      version: 1,
      idempotencyKey: () => `${MANUAL_PREFIX}${entityType}:${randomUUID()}`,
      template: { subject: '', body: '' },
    });
    this.manuals.set(entityType, definition);
    return definition;
  }

  /** Any stored event key, including composer emails. */
  resolve(key: string): MailEventDefinition {
    return key.startsWith(MANUAL_PREFIX) ? this.manual(key.slice(MANUAL_PREFIX.length)) : this.get(key);
  }
}
