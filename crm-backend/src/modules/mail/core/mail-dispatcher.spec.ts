import { MailDispatcher } from './mail-dispatcher.service';
import { readMailConfig } from './mail-config';

function setup(opts: { send?: jest.Mock; suppressed?: string[]; sentToday?: number; creds?: boolean; redirect?: string; deleted?: boolean } = {}) {
  const update = jest.fn().mockResolvedValue({ affected: 1 });
  const outbox: any = {
    update,
    createQueryBuilder: () => ({ where: () => ({ getCount: async () => opts.sentToday ?? 0 }) }),
  };
  const suppressions: any = { find: async () => (opts.suppressed ?? []).map((email) => ({ email })) };
  const config = { ...readMailConfig({ MAIL_ENABLED: 'true' }), minSendIntervalMs: 0, redirectTo: opts.redirect ?? null };
  const send = opts.send ?? jest.fn().mockResolvedValue('<id@majestanrealty.com>');
  const transports: any = { hasCredentials: () => opts.creds ?? true, send };
  const registry: any = { resolve: () => ({ key: 'hr.rejected', load: async () => (opts.deleted ? null : { id: 1 }) }) };
  const attachments: any = { filesFor: async () => [], purge: async () => {} };
  const dispatcher = new MailDispatcher(outbox, suppressions, config, transports, registry, {} as any, attachments);
  const row: any = {
    id: 7, identity: 'hr', event_key: 'hr.rejected', to_json: ['cand@x.com'], cc_json: null, reply_to: 'hr@majestanrealty.com',
    subject: 'Subj', html: '<p>h</p>', text: 't', attempts: 1, confirmed_by: 3,
  };
  return { dispatcher, update, send, row };
}

describe('MailDispatcher.deliver', () => {
  const now = new Date('2026-10-28T10:00:00Z');

  it('marks a delivered mail as sent with its message id', async () => {
    const { dispatcher, update, send, row } = setup();
    await dispatcher.deliver(row, now);
    expect(send).toHaveBeenCalledWith('hr', expect.objectContaining({ to: ['cand@x.com'], subject: 'Subj', headers: { 'X-Majestan-Mail-Id': '7' } }));
    expect(update).toHaveBeenCalledWith(7, expect.objectContaining({ status: 'sent', message_id: '<id@majestanrealty.com>' }));
  });

  it('applies redirect mode at send time', async () => {
    const { dispatcher, send, row } = setup({ redirect: 'qa@x.com' });
    await dispatcher.deliver(row, now);
    expect(send).toHaveBeenCalledWith('hr', expect.objectContaining({ to: ['qa@x.com'], subject: '[to: cand@x.com] Subj' }));
  });

  it('retries a temporary failure later', async () => {
    const { dispatcher, update, row } = setup({ send: jest.fn().mockRejectedValue({ message: 'timeout', code: 'ETIMEDOUT' }) });
    await dispatcher.deliver(row, now);
    expect(update).toHaveBeenCalledWith(7, expect.objectContaining({ status: 'pending', next_attempt_at: new Date(now.getTime() + 60_000) }));
  });

  it('fails permanently on a 5xx rejection', async () => {
    const { dispatcher, update, row } = setup({ send: jest.fn().mockRejectedValue({ message: '550 no such user', responseCode: 550 }) });
    await dispatcher.deliver(row, now);
    expect(update).toHaveBeenCalledWith(7, expect.objectContaining({ status: 'failed' }));
  });

  it('cancels instead of sending when the record was deleted after queueing', async () => {
    const { dispatcher, update, send, row } = setup({ deleted: true });
    await dispatcher.deliver(row, now);
    expect(send).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith(7, expect.objectContaining({ status: 'cancelled' }));
  });

  it('never sends to an address on the do-not-mail list', async () => {
    const { dispatcher, update, send, row } = setup({ suppressed: ['cand@x.com'] });
    await dispatcher.deliver(row, now);
    expect(send).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith(7, expect.objectContaining({ status: 'suppressed' }));
  });

  it('defers without spending an attempt when credentials are missing or the daily cap is hit', async () => {
    for (const opts of [{ creds: false }, { sentToday: 300 }]) {
      const { dispatcher, update, send, row } = setup(opts);
      await dispatcher.deliver(row, now);
      expect(send).not.toHaveBeenCalled();
      expect(update).toHaveBeenCalledWith(7, expect.objectContaining({ status: 'pending', attempts: 0 }));
    }
  });
});
