import { createHmac } from 'crypto';
import { parseWebhook, validSignature } from './whatsapp-webhook';
import { WhatsappWebhookService } from './whatsapp-webhook.service';

const change = (value: Record<string, unknown>) => ({
  object: 'whatsapp_business_account',
  entry: [
    {
      id: 'waba',
      changes: [
        {
          field: 'messages',
          value: {
            messaging_product: 'whatsapp',
            metadata: { phone_number_id: 'pn-1' },
            ...value,
          },
        },
      ],
    },
  ],
});

const inbound = change({
  contacts: [{ wa_id: '919876543210', profile: { name: 'Ravi Kumar' } }],
  messages: [
    {
      id: 'wamid.text',
      from: '919876543210',
      timestamp: '1794300000',
      type: 'text',
      text: { body: 'Is the 3BHK still available?' },
    },
    {
      id: 'wamid.doc',
      from: '919876543210',
      timestamp: '1794300060',
      type: 'document',
      document: { id: 'media-1', filename: 'plan.pdf' },
    },
    {
      id: 'wamid.photo',
      from: '919876543210',
      type: 'image',
      image: { id: 'media-2', caption: 'This one' },
    },
    { from: '919876543210', type: 'text', text: { body: 'no id, skipped' } },
  ],
});

describe('parseWebhook', () => {
  it('reads messages with the sender name, text and media', () => {
    const { messages, statuses } = parseWebhook(inbound);
    expect(statuses).toEqual([]);
    expect(messages).toEqual([
      expect.objectContaining({
        waMessageId: 'wamid.text',
        phone: '919876543210',
        phoneNumberId: 'pn-1',
        contactName: 'Ravi Kumar',
        type: 'text',
        body: 'Is the 3BHK still available?',
        sentAt: new Date(1794300000 * 1000),
      }),
      expect.objectContaining({
        waMessageId: 'wamid.doc',
        body: '[Document: plan.pdf]',
        mediaId: 'media-1',
      }),
      expect.objectContaining({
        waMessageId: 'wamid.photo',
        body: 'This one',
        mediaId: 'media-2',
        sentAt: null,
      }),
    ]);
  });

  it('reads delivery statuses and the failure reason', () => {
    const { statuses } = parseWebhook(
      change({
        statuses: [
          {
            id: 'wamid.out1',
            status: 'read',
            recipient_id: '919876543210',
            timestamp: '1794300100',
          },
          {
            id: 'wamid.out2',
            status: 'failed',
            recipient_id: '919876543210',
            errors: [
              {
                code: 131026,
                title: 'Message undeliverable',
                error_data: { details: 'Not on WhatsApp' },
              },
            ],
          },
          { id: 'wamid.out3', status: 'deleted', recipient_id: '919876543210' },
        ],
      }),
    );
    expect(statuses).toEqual([
      expect.objectContaining({
        waMessageId: 'wamid.out1',
        status: 'read',
        error: null,
      }),
      expect.objectContaining({
        waMessageId: 'wamid.out2',
        status: 'failed',
        error: 'Not on WhatsApp',
      }),
    ]);
  });

  it('ignores other objects and fields', () => {
    expect(parseWebhook({ object: 'page', entry: [] })).toEqual({
      messages: [],
      statuses: [],
    });
    expect(
      parseWebhook({
        ...inbound,
        entry: [{ changes: [{ field: 'account_update', value: {} }] }],
      }).messages,
    ).toEqual([]);
    expect(parseWebhook(null)).toEqual({ messages: [], statuses: [] });
  });
});

describe('validSignature', () => {
  const body = Buffer.from(JSON.stringify(inbound));
  const sign = (secret: string) =>
    'sha256=' + createHmac('sha256', secret).update(body).digest('hex');

  it('accepts Meta’s HMAC of the raw body', () => {
    expect(validSignature(body, sign('app-secret'), 'app-secret')).toBe(true);
  });
  it('rejects a wrong secret, a changed body, a missing header or no secret configured', () => {
    expect(validSignature(body, sign('other'), 'app-secret')).toBe(false);
    expect(
      validSignature(Buffer.from('{}'), sign('app-secret'), 'app-secret'),
    ).toBe(false);
    expect(validSignature(body, undefined, 'app-secret')).toBe(false);
    expect(validSignature(body, sign(''), '')).toBe(false);
  });
});

describe('WhatsappWebhookService', () => {
  const setup = (
    lead: { id: number; name: string; assigned_staff_id: number | null } | null,
    inserted = 1,
  ) => {
    const query = jest.fn((sql: string, _params?: unknown[]) => Promise.resolve(answer(sql)));
    const answer = (sql: string): unknown => {
      if (sql.includes('FROM leads')) return lead ? [lead] : [];
      if (sql.includes('INSERT IGNORE INTO whatsapp_messages'))
        return { affectedRows: inserted };
      return { affectedRows: 1 };
    };
    const notify = jest.fn().mockResolvedValue({});
    const service = new WhatsappWebhookService(
      { query } as never,
      { createNotification: notify } as never,
    );
    return { service, query, notify };
  };
  const message = parseWebhook(inbound).messages[0];

  it('logs a lead’s message in its conversation and tells the assigned staff member', async () => {
    const { service, query, notify } = setup({
      id: 42,
      name: 'Ravi Kumar',
      assigned_staff_id: 7,
    });
    await service.handle({ messages: [message], statuses: [] });
    expect(query.mock.calls[0][1]).toEqual(['9876543210', '9876543210']);
    const log = query.mock.calls.find(([sql]) =>
      sql.includes('INTO contact_logs'),
    )!;
    expect(log[1]).toEqual([
      42,
      'Is the 3BHK still available?',
      'wa:wamid.text',
      message.sentAt,
    ]);
    expect(log[0]).toContain("NULL, 'incoming'");
    expect(notify).toHaveBeenCalledWith(
      7,
      'WhatsApp from Ravi Kumar',
      'Is the 3BHK still available?',
      'whatsapp_message',
      42,
      'lead',
    );
  });

  it('does nothing more for a message Meta sent again', async () => {
    const { service, query, notify } = setup(
      { id: 42, name: 'Ravi Kumar', assigned_staff_id: 7 },
      0,
    );
    await service.handle({ messages: [message], statuses: [] });
    expect(query.mock.calls.some(([sql]) => sql.includes('contact_logs'))).toBe(
      false,
    );
    expect(notify).not.toHaveBeenCalled();
  });

  it('keeps messages from unknown numbers without logging them on a lead', async () => {
    const { service, query, notify } = setup(null);
    await service.handle({ messages: [message], statuses: [] });
    expect(
      query.mock.calls.find(([sql]) => sql.includes('whatsapp_messages'))![1],
    ).toContain(null);
    expect(query.mock.calls.some(([sql]) => sql.includes('contact_logs'))).toBe(
      false,
    );
    expect(notify).not.toHaveBeenCalled();
  });

  it('records delivery statuses without moving one backwards', async () => {
    const { service, query } = setup(null);
    await service.handle({
      messages: [],
      statuses: [
        {
          waMessageId: 'wamid.out',
          phone: '919876543210',
          phoneNumberId: 'pn-1',
          status: 'delivered',
          error: null,
          at: null,
        },
      ],
    });
    const [sql, params] = query.mock.calls.find(([s]) =>
      s.includes('ON DUPLICATE KEY UPDATE'),
    )!;
    expect(params).toEqual([
      'wamid.out',
      '919876543210',
      'pn-1',
      null,
      'delivered',
      null,
      null,
    ]);
    expect(sql).toMatch(/FIELD\(VALUES\(status\).*> FIELD\(status/);
  });
});
