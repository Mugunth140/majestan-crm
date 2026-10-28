import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MailService } from '../mail.service';
import { type DomainEventPayload } from './mail-event';
import { MailRegistry } from './mail-registry.service';

/**
 * Subscribes every registered mail event to the domain events it lists in
 * `triggers`. Modules emit with emitAsync so drafts exist by the time the
 * save request returns; MailService.createFromTrigger never throws.
 */
@Injectable()
export class MailTriggers implements OnApplicationBootstrap {
  constructor(
    private readonly registry: MailRegistry,
    private readonly events: EventEmitter2,
    private readonly mail: MailService,
  ) {}

  onApplicationBootstrap() {
    const byEvent = new Map<string, { run: (payload: DomainEventPayload) => Promise<void> }[]>();
    for (const definition of this.registry.all()) {
      for (const trigger of definition.triggers ?? []) {
        const handlers = byEvent.get(trigger.on) ?? [];
        handlers.push({
          run: async (payload) => {
            if (!payload || typeof payload.entityId !== 'number') return;
            if (trigger.when && !trigger.when(payload)) return;
            await this.mail.createFromTrigger(definition, payload, trigger.on);
          },
        });
        byEvent.set(trigger.on, handlers);
      }
    }
    for (const [eventName, handlers] of byEvent) {
      this.events.on(eventName, async (payload: DomainEventPayload) => {
        for (const handler of handlers) await handler.run(payload);
      });
    }
  }
}
