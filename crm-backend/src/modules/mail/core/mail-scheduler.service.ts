import { Inject, Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { MailConfig } from './mail-config';
import type { MailEventDefinition } from './mail-event';
import { MailRegistry } from './mail-registry.service';
import { MAIL_CONFIG } from './mail-transports.service';
import { MailService } from '../mail.service';

/**
 * Runs scheduled automatic emails (e.g. site-visit reminders). Only while mail is
 * enabled: creating reminders that can't be sent would only make them stale.
 */
@Injectable()
export class MailScheduler implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(MailScheduler.name);
  private readonly timers: NodeJS.Timeout[] = [];
  private readonly running = new Set<string>();

  constructor(
    private readonly registry: MailRegistry,
    private readonly mail: MailService,
    private readonly dataSource: DataSource,
    @Inject(MAIL_CONFIG) private readonly config: MailConfig,
  ) {}

  onApplicationBootstrap() {
    if (!this.config.enabled) return;
    for (const definition of this.registry.all()) {
      if (!definition.schedule) continue;
      const every = Math.max(5, definition.schedule.everyMinutes) * 60_000;
      const first = setTimeout(() => void this.run(definition), 60_000);
      const timer = setInterval(() => void this.run(definition), every);
      first.unref?.();
      timer.unref?.();
      this.timers.push(first, timer);
    }
  }

  onModuleDestroy() {
    for (const timer of this.timers) clearTimeout(timer);
  }

  async run(definition: MailEventDefinition, now = new Date()) {
    const schedule = definition.schedule;
    if (!schedule || this.running.has(definition.key)) return;
    this.running.add(definition.key);
    try {
      const ids = await schedule.due({ dataSource: this.dataSource, now });
      const expiresAt = new Date(now.getTime() + schedule.expiresAfterHours * 3600_000);
      for (const entityId of ids) await this.mail.createFromTrigger(definition, { entityId }, 'schedule', { expiresAt });
    } catch (error) {
      this.logger.error(`Scheduled email "${definition.key}" failed: ${(error as Error).message}`);
    } finally {
      this.running.delete(definition.key);
    }
  }
}
