import { MailDispatcher } from './mail-dispatcher.service';
import { readMailConfig } from './mail-config';

function setup(opts: { send?: jest.Mock; suppressed?: string[]; sentToday?: number; creds?: boolean; redirect?: string; deleted?: boolean; query?: jest.Mock } = {}) {
  const update = jest.fn().mockResolvedValue({ affected: 1 });
  const outbox: any = {
    update,
    createQueryBuilder: () => ({ where: () => ({ getCount: async () => opts.sentToday ?? 0 }) }),
  };
  const suppressions: any = { find: async () => (opts.suppressed ?? []).map((email) => ({ email })) };
  const config = { ...readMailConfig({ MAIL_ENABLED: 'true' }), minSendIntervalMs: 0, redirectTo: opts.redirect ?? null };
  const send = opts.send ?? jest.fn().mockResolvedValue('<id@majestanrealty.com>');
  const transports: any = { hasCredentials: () => opts.creds ?? true, send };
  const registry: any = {
    resolve: () => ({ key: 'hr.rejected', label: 'Application unsuccessful', load: async () => (opts.deleted ? null : { id: 1 }) }),
    entity: () => ({ contactLog: { table: 'hr_contact_logs', column: 'hr_candidate_id' } }),
  };
  const query = opts.query ?? jest.fn().mockResolvedValue({});
  const attachments: any = { filesFor: async () => [], purge: async () => {} };
  const dispatcher = new MailDispatcher(outbox, suppressions, config, transports, registry, { query } as any, attachments);
  const row: any = {
    id: 7, identity: 'hr', event_key: 'hr.rejected', entity_type: 'hr_candidate', entity_id: 12, created_by: null, to_json: ['cand@x.com'], cc_json: null, reply_to: 'hr@majestanrealty.com',
    subject: 'Subj', html: '<p>h</p>', text: 't', attempts: 1, confirmed_by: 3,
  };
  return { dispatcher, update, send, row, query };
}

describe('MailDispatcher.deliver', () => {
  const now = new Date('2026-10-28T10:00:00Z');

  it('marks a delivered mail as sent with its message id', async () => {
    const { dispatcher, update, send, row } = setup();
    await dispatcher.deliver(row, now);
    expect(send).toHaveBeenCalledWith('hr', expect.objectContaining({ to: ['cand@x.com'], subject: 'Subj', headers: { 'X-Majestan-Mail-Id': '7' } }));
    expect(update).toHaveBeenCalledWith(7, expect.objectContaining({ status: 'sent', message_id: '<id@majestanrealty.com>' }));
  });

  it('adds the sent email to the record\'s contact activity, once, without addresses', async () => {
    const { dispatcher, query, row } = setup();
    await dispatcher.deliver(row, now);
    expect(query).toHaveBeenCalledTimes(1);
    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain('INSERT INTO `hr_contact_logs` (`hr_candidate_id`, contact_type, subject, message, sent_by_id, source_call_id, created_at)');
    expect(sql).toContain('ON DUPLICATE KEY UPDATE');
    expect(params.slice(0, 5)).toEqual([12, 'Subj', 'Application unsuccessful · sent from hr@majestanrealty.com', 3, 'mail:7']);
    expect(JSON.stringify(params)).not.toContain('cand@x.com');
  });

  it('labels composer emails "Email" and keeps automatic ones without a sender', async () => {
    const { dispatcher, query, row } = setup();
    await dispatcher.deliver({ ...row, event_key: 'manual.lead@finance', identity: 'finance', entity_type: 'lead', confirmed_by: null }, now);
    expect(query.mock.calls[0][1].slice(2, 4)).toEqual(['Email · sent from finance@majestanrealty.com', null]);
  });

  it('still marks the email sent when the contact log cannot be written', async () => {
    const { dispatcher, update, row } = setup({ query: jest.fn().mockRejectedValue(new Error('table missing')) });
    await dispatcher.deliver(row, now);
    expect(update).toHaveBeenCalledWith(7, expect.objectContaining({ status: 'sent' }));
  });

  it('logs nothing when sending fails', async () => {
    const { dispatcher, query, row } = setup({ send: jest.fn().mockRejectedValue({ message: 'timeout', code: 'ETIMEDOUT' }) });
    await dispatcher.deliver(row, now);
    expect(query).not.toHaveBeenCalled();
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
