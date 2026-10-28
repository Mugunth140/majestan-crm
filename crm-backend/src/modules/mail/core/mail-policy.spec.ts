import { applyRedirect, contentHash, isPermanentFailure, MAX_ATTEMPTS, nextRetryAt } from './mail-policy';
import { readMailConfig } from './mail-config';

describe('mail policy', () => {
  it('redirects every recipient to the tester and keeps the real ones in the subject', () => {
    expect(applyRedirect({ to: ['a@x.com'], cc: ['b@x.com'], subject: 'Hi' }, 'qa@x.com')).toEqual({
      to: ['qa@x.com'], cc: [], subject: '[to: a@x.com, b@x.com] Hi',
    });
    const mail = { to: ['a@x.com'], cc: [], subject: 'Hi' };
    expect(applyRedirect(mail, null)).toBe(mail);
  });

  it('treats our own auth/connection problems as temporary and 5xx rejections as permanent', () => {
    expect(isPermanentFailure({ code: 'EAUTH', responseCode: 535 })).toBe(false);
    expect(isPermanentFailure({ code: 'ECONNECTION' })).toBe(false);
    expect(isPermanentFailure({ responseCode: 550 })).toBe(true);
    expect(isPermanentFailure({ code: 'EENVELOPE' })).toBe(true);
    expect(isPermanentFailure({ responseCode: 451 })).toBe(false);
  });

  it('backs off 1m, 5m, 30m, 2h, 6h and then gives up', () => {
    const now = new Date('2026-10-28T00:00:00Z');
    expect(nextRetryAt(1, now)!.getTime() - now.getTime()).toBe(60_000);
    expect(nextRetryAt(5, now)!.getTime() - now.getTime()).toBe(6 * 3600_000);
    expect(nextRetryAt(MAX_ATTEMPTS, now)).toBeNull();
  });

  it('hashes content deterministically', () => {
    const mail = { subject: 's', html: '<p>h</p>', to: ['a@x.com'], cc: [] };
    expect(contentHash(mail)).toMatch(/^[a-f0-9]{32}$/);
    expect(contentHash(mail)).toBe(contentHash({ ...mail }));
    expect(contentHash(mail)).not.toBe(contentHash({ ...mail, subject: 't' }));
  });

  it('keeps mail off unless explicitly enabled and reads app passwords per identity', () => {
    expect(readMailConfig({}).enabled).toBe(false);
    const config = readMailConfig({ MAIL_ENABLED: 'true', MAIL_IDENTITY_HR_PASS: 'secret', MAIL_REDIRECT_TO: ' qa@x.com ' });
    expect(config.enabled).toBe(true);
    expect(config.redirectTo).toBe('qa@x.com');
    expect(config.credentials.hr).toEqual({ user: 'hr@majestanrealty.com', pass: 'secret' });
    expect(config.credentials.sales).toBeUndefined();
    expect(config.port).toBe(465);
  });
});
