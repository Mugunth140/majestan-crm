import { Injectable, NotFoundException } from '@nestjs/common';
import { MAIL_IDENTITIES } from '../identities';
import { type MailEventDefinition } from './mail-event';

/** Every MailEvent registered by a module through MailModule.forFeature(). */
@Injectable()
export class MailRegistry {
  private readonly events = new Map<string, MailEventDefinition>();

  register(definitions: MailEventDefinition[]) {
    for (const definition of definitions) {
      const existing = this.events.get(definition.key);
      if (existing && existing !== definition) throw new Error(`Mail event "${definition.key}" is registered twice`);
      if (!(definition.identity in MAIL_IDENTITIES)) {
        throw new Error(`Mail event "${definition.key}" uses unknown identity "${definition.identity}"`);
      }
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
}
