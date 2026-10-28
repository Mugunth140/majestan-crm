import { MAIL_IDENTITIES, type MailIdentityKey } from '../identities';

export interface MailConfig {
  enabled: boolean;
  redirectTo: string | null;
  host: string;
  port: number;
  tlsServername: string;
  dailyCapPerIdentity: number;
  minSendIntervalMs: number;
  pollIntervalMs: number;
  draftTtlDays: number;
  retentionDays: number;
  credentials: Partial<Record<MailIdentityKey, { user: string; pass: string }>>;
}

const num = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

/**
 * Reads mail settings from the environment. Mail is OFF unless MAIL_ENABLED=true.
 * MAIL_IDENTITY_<KEY>_PASS is a Stalwart app password; the login defaults to the address.
 */
export function readMailConfig(env: NodeJS.ProcessEnv = process.env): MailConfig {
  const credentials: MailConfig['credentials'] = {};
  for (const [key, identity] of Object.entries(MAIL_IDENTITIES) as [MailIdentityKey, (typeof MAIL_IDENTITIES)[MailIdentityKey]][]) {
    const pass = env[`MAIL_IDENTITY_${identity.env}_PASS`];
    if (pass) credentials[key] = { user: env[`MAIL_IDENTITY_${identity.env}_USER`] || identity.from, pass };
  }
  return {
    enabled: env.MAIL_ENABLED === 'true',
    redirectTo: env.MAIL_REDIRECT_TO?.trim() || null,
    host: env.MAIL_SMTP_HOST || 'stalwart-mail',
    port: num(env.MAIL_SMTP_PORT, 465),
    tlsServername: env.MAIL_TLS_SERVERNAME || 'mail.majestanrealty.com',
    dailyCapPerIdentity: num(env.MAIL_DAILY_CAP_PER_IDENTITY, 300),
    minSendIntervalMs: Math.round(1000 / num(env.MAIL_RATE_PER_SECOND, 1)),
    pollIntervalMs: num(env.MAIL_POLL_INTERVAL_MS, 15_000),
    draftTtlDays: num(env.MAIL_DRAFT_TTL_DAYS, 7),
    retentionDays: num(env.MAIL_RETENTION_DAYS, 180),
    credentials,
  };
}
