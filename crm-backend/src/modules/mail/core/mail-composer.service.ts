import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { MailSuppression } from '../../../database/entities/mail-suppression.entity';
import { MAIL_IDENTITIES } from '../identities';
import { html, safeUrl } from '../render/html';
import { renderLayout, type RenderedMail } from '../render/layout';
import { cleanAddresses, type MailEventDefinition } from './mail-event';
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
}

/** load → check → render with the shared layout. Never sends or stores anything. */
@Injectable()
export class MailComposer {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(MailSuppression) private readonly suppressions: Repository<MailSuppression>,
  ) {}

  async compose(
    definition: MailEventDefinition,
    entityId: number,
    opts: { actorId?: number | null; note?: string | null } = {},
  ): Promise<ComposedMail> {
    const data = await definition.load(entityId, { dataSource: this.dataSource, actorId: opts.actorId ?? null });
    if (!data) throw new NotFoundException(`${definition.entityType} ${entityId} was not found`);

    const recipients = definition.recipients(data);
    const to = cleanAddresses(recipients.to);
    const cc = cleanAddresses(recipients.cc ?? []).filter((address) => !to.includes(address));
    const issues: string[] = [];
    if (!to.length) issues.push('No valid email address on record');
    issues.push(...(definition.check?.(data) ?? []));
    if (to.length || cc.length) {
      const blocked = await this.suppressions.find({ where: { email: In([...to, ...cc]) } });
      for (const row of blocked) issues.push(`${row.email} is on the do-not-mail list`);
    }

    const identity = MAIL_IDENTITIES[definition.identity];
    const rendered = definition.render(data, {
      layout: (input) => renderLayout(input, { note: opts.note, signature: identity.signature }),
      html,
      safeUrl,
    });
    return {
      definition,
      entityId,
      to,
      cc,
      replyTo: identity.from,
      rendered,
      issues,
      idempotencyKey: definition.idempotencyKey(data, entityId),
      hash: contentHash({ subject: rendered.subject, html: rendered.html, to, cc }),
    };
  }
}
