import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MailOutbox } from '../../database/entities/mail-outbox.entity';
import type { MailOutboxStatus } from '../../database/entities/mail-outbox.entity';
import { MailSuppression } from '../../database/entities/mail-suppression.entity';
import type { MailSuppressionReason } from '../../database/entities/mail-suppression.entity';
import { PermissionsService } from '../permissions/permissions.service';
import { MAIL_IDENTITIES } from './identities';
import type { MailConfig } from './core/mail-config';
import { type ComposedMail, MailComposer } from './core/mail-composer.service';
import { type DomainEventPayload, type MailEventDefinition } from './core/mail-event';
import { MailRegistry } from './core/mail-registry.service';
import { MAIL_CONFIG } from './core/mail-transports.service';

export const MAIL_ADMIN = 'mail.admin';
const DAY_MS = 24 * 3600_000;

export interface MailActor {
  id: number;
}

/** Public face of the mail core: everything the API and the triggers use. */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(
    private readonly registry: MailRegistry,
    private readonly composer: MailComposer,
    @InjectRepository(MailOutbox) private readonly outbox: Repository<MailOutbox>,
    @InjectRepository(MailSuppression) private readonly suppressions: Repository<MailSuppression>,
    private readonly permissions: PermissionsService,
    @Inject(MAIL_CONFIG) private readonly config: MailConfig,
  ) {}

  // ── Catalog and preview ────────────────────────────────────────────────

  async catalog(entityType: string, actor: MailActor) {
    const definitions = this.registry.forEntity(entityType);
    const allowed = new Map<string, boolean>();
    for (const module of new Set(definitions.map((d) => d.module))) allowed.set(module, await this.canSend(actor, module));
    return {
      enabled: this.config.enabled,
      redirectTo: this.config.redirectTo,
      events: definitions.map((d) => ({
        key: d.key,
        label: d.label,
        description: d.description,
        mode: d.mode,
        from: MAIL_IDENTITIES[d.identity].from,
        canSend: allowed.get(d.module) ?? false,
      })),
    };
  }

  async preview(eventKey: string, entityId: number, note: string | null, actor: MailActor) {
    const definition = this.registry.get(eventKey);
    await this.assertCanSend(actor, definition.module);
    return this.toPreview(await this.composer.compose(definition, entityId, { actorId: actor.id, note }), null);
  }

  async previewDraft(outboxId: number, note: string | null, actor: MailActor) {
    const row = await this.findRow(outboxId);
    if (row.status !== 'draft') throw new BadRequestException('Only drafts can be previewed for sending');
    const definition = this.registry.get(row.event_key);
    await this.assertCanSend(actor, definition.module);
    return this.toPreview(await this.composer.compose(definition, row.entity_id, { actorId: actor.id, note }), row.id);
  }

  // ── Sending ────────────────────────────────────────────────────────────

  /** Manual send from the UI. Confirms an open draft of the same email if there is one. */
  async send(eventKey: string, entityId: number, note: string | null, hash: string | null, actor: MailActor) {
    const definition = this.registry.get(eventKey);
    await this.assertCanSend(actor, definition.module);
    const composed = await this.composer.compose(definition, entityId, { actorId: actor.id, note });
    this.assertSendable(composed, hash);

    const draft = await this.outbox.findOne({
      where: { event_key: eventKey, entity_type: definition.entityType, entity_id: entityId, status: 'draft' },
      order: { id: 'DESC' },
    });
    if (draft) return this.summary(await this.queueRow(draft, composed, note, actor));

    const taken = await this.outbox.exists({ where: { idempotency_key: composed.idempotencyKey } });
    const idempotencyKey = taken ? `${composed.idempotencyKey}#resend-${Date.now()}` : composed.idempotencyKey;
    const row = await this.outbox.save(
      this.outbox.create({
        ...this.snapshot(composed, note),
        idempotency_key: idempotencyKey,
        status: 'pending',
        trigger_source: 'manual',
        created_by: actor.id,
        confirmed_by: actor.id,
        confirmed_at: new Date(),
      }),
    );
    return this.summary(row);
  }

  /** HR clicked Send on a draft. Re-renders and refuses if it differs from what they saw. */
  async confirm(outboxId: number, note: string | null, hash: string | null, actor: MailActor) {
    const row = await this.findRow(outboxId);
    if (row.status !== 'draft') throw new BadRequestException('This email is no longer a draft');
    const definition = this.registry.get(row.event_key);
    await this.assertCanSend(actor, definition.module);
    const composed = await this.composer.compose(definition, row.entity_id, { actorId: actor.id, note });
    this.assertSendable(composed, hash);
    return this.summary(await this.queueRow(row, composed, note, actor));
  }

  async cancel(outboxId: number, actor: MailActor) {
    const row = await this.findRow(outboxId);
    await this.assertCanSend(actor, row.module);
    if (!['draft', 'pending', 'failed'].includes(row.status)) {
      throw new BadRequestException(`A ${row.status} email cannot be cancelled`);
    }
    // Conditional update: the dispatcher may have claimed it a moment ago.
    const result = await this.outbox
      .createQueryBuilder()
      .update(MailOutbox)
      .set({ status: 'cancelled', last_error: 'Cancelled by user', next_attempt_at: null })
      .where('id = :id AND status IN (:...open)', { id: row.id, open: ['draft', 'pending', 'failed'] })
      .execute();
    if (!result.affected) throw new ConflictException('This email is being sent and can no longer be cancelled');
    return this.summary(await this.findRow(row.id));
  }

  async retry(outboxId: number, actor: MailActor) {
    const row = await this.findRow(outboxId);
    await this.assertCanSend(actor, row.module);
    if (row.status !== 'failed') throw new BadRequestException('Only failed emails can be retried');
    await this.outbox.update(row.id, { status: 'pending', attempts: 0, next_attempt_at: null, last_error: null });
    return this.summary(await this.findRow(row.id));
  }

  // ── Domain-event triggers ──────────────────────────────────────────────

  /**
   * Called for every matching domain event. Creates a draft (confirm mode) or a
   * queued email (auto mode). Never throws: a mail problem must not break the save
   * that caused it.
   */
  async createFromTrigger(definition: MailEventDefinition, payload: DomainEventPayload, source: string) {
    try {
      const composed = await this.composer.compose(definition, payload.entityId, { actorId: payload.actorId ?? null });
      if (!composed.to.length) return; // nobody to write to: nothing to suggest
      if (await this.outbox.exists({ where: { idempotency_key: composed.idempotencyKey } })) return;

      // An older draft of the same email (e.g. the previous interview time) is now stale.
      await this.outbox.update(
        { event_key: definition.key, entity_type: definition.entityType, entity_id: payload.entityId, status: 'draft' },
        { status: 'cancelled', last_error: 'Replaced by a newer version' },
      );
      const auto = definition.mode === 'auto';
      const blocked = auto && composed.issues.length > 0;
      await this.outbox.insert({
        ...this.snapshot(composed, null),
        idempotency_key: composed.idempotencyKey,
        status: auto ? (blocked ? 'failed' : 'pending') : 'draft',
        last_error: blocked ? composed.issues.join('; ').slice(0, 1000) : null,
        trigger_source: source,
        created_by: payload.actorId ?? null,
        expires_at: auto ? null : new Date(Date.now() + this.config.draftTtlDays * DAY_MS),
      });
    } catch (error) {
      if ((error as { code?: string }).code === 'ER_DUP_ENTRY') return; // raced with an identical trigger
      this.logger.error(`Could not create "${definition.key}" for #${payload.entityId}: ${(error as Error).message}`);
    }
  }

  // ── History and administration ─────────────────────────────────────────

  async history(entityType: string, entityId: number) {
    const rows = await this.outbox.find({
      where: { entity_type: entityType, entity_id: entityId },
      order: { id: 'DESC' },
      take: 100,
    });
    return rows.map((row) => this.summary(row));
  }

  async findOne(outboxId: number) {
    const row = await this.findRow(outboxId);
    return { ...this.summary(row), html: row.html, text: row.text };
  }

  async list(filters: { status?: MailOutboxStatus; module?: string; page?: number }, actor: MailActor) {
    await this.assertAdmin(actor);
    const page = Math.max(1, filters.page ?? 1);
    const [rows, total] = await this.outbox.findAndCount({
      where: { ...(filters.status ? { status: filters.status } : {}), ...(filters.module ? { module: filters.module } : {}) },
      order: { id: 'DESC' },
      take: 50,
      skip: (page - 1) * 50,
    });
    return { data: rows.map((row) => this.summary(row)), total, page };
  }

  async listSuppressions(actor: MailActor) {
    await this.assertAdmin(actor);
    return this.suppressions.find({ order: { id: 'DESC' } });
  }

  async addSuppression(email: string, reason: MailSuppressionReason, note: string | null, actor: MailActor) {
    await this.assertAdmin(actor);
    const address = email.trim().toLowerCase();
    await this.suppressions.upsert({ email: address, reason, note, source: 'crm', created_by: actor.id }, ['email']);
    return this.suppressions.findOneByOrFail({ email: address });
  }

  async removeSuppression(id: number, actor: MailActor) {
    await this.assertAdmin(actor);
    await this.suppressions.delete(id);
    return { success: true };
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  private assertSendable(composed: ComposedMail, hash: string | null) {
    if (composed.issues.length) {
      throw new BadRequestException({ message: 'This email cannot be sent yet', issues: composed.issues });
    }
    if (hash && hash !== composed.hash) {
      throw new ConflictException('The email changed since you previewed it. Please review it again.');
    }
  }

  private async queueRow(row: MailOutbox, composed: ComposedMail, note: string | null, actor: MailActor) {
    const result = await this.outbox
      .createQueryBuilder()
      .update(MailOutbox)
      .set({
        ...this.snapshot(composed, note),
        status: 'pending',
        confirmed_by: actor.id,
        confirmed_at: new Date(),
        expires_at: null,
        last_error: null,
      })
      .where("id = :id AND status = 'draft'", { id: row.id })
      .execute();
    if (!result.affected) throw new ConflictException('This draft was already sent or cancelled');
    return this.findRow(row.id);
  }

  private snapshot(composed: ComposedMail, note: string | null): Partial<MailOutbox> {
    const d = composed.definition;
    return {
      event_key: d.key,
      event_version: d.version,
      module: d.module,
      identity: d.identity,
      entity_type: d.entityType,
      entity_id: composed.entityId,
      to_json: composed.to,
      cc_json: composed.cc.length ? composed.cc : null,
      reply_to: composed.replyTo,
      subject: composed.rendered.subject.slice(0, 500),
      html: composed.rendered.html,
      text: composed.rendered.text,
      note: note?.trim() || null,
    };
  }

  private toPreview(composed: ComposedMail, outboxId: number | null) {
    const identity = MAIL_IDENTITIES[composed.definition.identity];
    return {
      outboxId,
      event: composed.definition.key,
      label: composed.definition.label,
      from: `${identity.name} <${identity.from}>`,
      to: composed.to,
      cc: composed.cc,
      subject: composed.rendered.subject,
      html: composed.rendered.html,
      text: composed.rendered.text,
      issues: composed.issues,
      hash: composed.hash,
      enabled: this.config.enabled,
      redirectTo: this.config.redirectTo,
    };
  }

  private summary(row: MailOutbox) {
    const definition = this.registry.all().find((d) => d.key === row.event_key);
    return {
      id: row.id,
      event: row.event_key,
      label: definition?.label ?? row.event_key,
      status: row.status,
      to: row.to_json,
      cc: row.cc_json ?? [],
      subject: row.subject,
      note: row.note,
      triggerSource: row.trigger_source,
      attempts: row.attempts,
      lastError: row.last_error,
      createdBy: row.created_by,
      confirmedBy: row.confirmed_by,
      createdAt: row.created_at,
      confirmedAt: row.confirmed_at,
      sentAt: row.sent_at,
      expiresAt: row.expires_at,
    };
  }

  private async findRow(id: number) {
    const row = await this.outbox.findOneBy({ id });
    if (!row) throw new NotFoundException('Email not found');
    return row;
  }

  private async canSend(actor: MailActor, module: string) {
    return (
      (await this.permissions.hasPermission(actor.id, `${module}.mail.send`)) ||
      (await this.permissions.hasPermission(actor.id, MAIL_ADMIN))
    );
  }

  private async assertCanSend(actor: MailActor, module: string) {
    if (!(await this.canSend(actor, module))) {
      throw new ForbiddenException(`You need the "${module}.mail.send" permission to send these emails`);
    }
  }

  private async assertAdmin(actor: MailActor) {
    if (!(await this.permissions.hasPermission(actor.id, MAIL_ADMIN))) {
      throw new ForbiddenException('Mail administration permission is required');
    }
  }
}
