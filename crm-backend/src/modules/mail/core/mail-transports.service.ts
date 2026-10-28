import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { createTransport, Transporter } from 'nodemailer';
import { MAIL_IDENTITIES, type MailIdentityKey } from '../identities';
import type { MailConfig } from './mail-config';

export const MAIL_CONFIG = Symbol('MAIL_CONFIG');

export interface OutgoingMail {
  to: string[];
  cc: string[];
  replyTo: string | null;
  subject: string;
  html: string;
  text: string;
  headers: Record<string, string>;
}

/**
 * One pooled SMTP connection per department mailbox, authenticated with that
 * mailbox's app password. TLS is verified against the public certificate name
 * even though we connect over the internal Docker network.
 */
@Injectable()
export class MailTransports implements OnModuleDestroy {
  private readonly pools = new Map<MailIdentityKey, Transporter>();

  constructor(@Inject(MAIL_CONFIG) private readonly config: MailConfig) {}

  hasCredentials(identity: MailIdentityKey): boolean {
    return Boolean(this.config.credentials[identity]);
  }

  async send(identity: MailIdentityKey, mail: OutgoingMail): Promise<string> {
    const sender = MAIL_IDENTITIES[identity];
    const info = await this.pool(identity).sendMail({
      from: { name: sender.name, address: sender.from },
      to: mail.to,
      cc: mail.cc.length ? mail.cc : undefined,
      replyTo: mail.replyTo ?? undefined,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      headers: mail.headers,
    });
    return info.messageId;
  }

  private pool(identity: MailIdentityKey): Transporter {
    const existing = this.pools.get(identity);
    if (existing) return existing;
    const credentials = this.config.credentials[identity];
    if (!credentials) throw Object.assign(new Error(`No credentials configured for ${identity}`), { code: 'EAUTH' });
    const transporter = createTransport({
      host: this.config.host,
      port: this.config.port,
      secure: this.config.port === 465,
      requireTLS: this.config.port !== 465,
      auth: { user: credentials.user, pass: credentials.pass },
      tls: { servername: this.config.tlsServername, minVersion: 'TLSv1.2' },
      pool: true,
      maxConnections: 1,
      connectionTimeout: 15_000,
      socketTimeout: 30_000,
    });
    this.pools.set(identity, transporter);
    return transporter;
  }

  onModuleDestroy() {
    for (const pool of this.pools.values()) pool.close();
  }
}
