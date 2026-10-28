/** Pure send-time rules, kept free of Nest/DB so they are easy to test. */
import { createHash } from 'crypto';

export const RETRY_DELAYS_MS = [60_000, 5 * 60_000, 30 * 60_000, 2 * 3600_000, 6 * 3600_000];
export const MAX_ATTEMPTS = RETRY_DELAYS_MS.length + 1;

/** In redirect mode every mail goes to the tester; the subject shows the real recipients. */
export function applyRedirect(
  mail: { to: string[]; cc: string[]; subject: string },
  redirectTo: string | null,
): { to: string[]; cc: string[]; subject: string } {
  if (!redirectTo) return mail;
  const real = [...mail.to, ...mail.cc].join(', ');
  return { to: [redirectTo], cc: [], subject: `[to: ${real}] ${mail.subject}` };
}

/**
 * A rejection the server will never accept (bad recipient, policy) is permanent.
 * Our own auth/connection problems are temporary: fixing config must not lose mail.
 */
export function isPermanentFailure(error: { responseCode?: number; code?: string }): boolean {
  if (error.code === 'EAUTH' || error.code === 'ECONNECTION' || error.code === 'ETIMEDOUT' || error.code === 'ESOCKET') return false;
  if (error.code === 'EENVELOPE') return true;
  return typeof error.responseCode === 'number' && error.responseCode >= 500 && error.responseCode < 600;
}

/** null = give up (mark failed). */
export function nextRetryAt(attempts: number, now: Date): Date | null {
  if (attempts >= MAX_ATTEMPTS) return null;
  const delay = RETRY_DELAYS_MS[Math.max(0, attempts - 1)] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
  return new Date(now.getTime() + delay);
}

/** Stable fingerprint of rendered content; the client sends it back to prove what it previewed. */
export function contentHash(mail: { subject: string; html: string; to: string[]; cc: string[] }): string {
  return createHash('sha256').update(JSON.stringify([mail.subject, mail.html, mail.to, mail.cc])).digest('hex').slice(0, 32);
}
