jest.mock('@nestjs/axios', () => ({ HttpService: class HttpService {} }));
jest.mock('./whatsapp-automations', () => {
  const actual = jest.requireActual<typeof import('./whatsapp-automations')>(
    './whatsapp-automations',
  );
  return { ...actual, loadLeadMailData: jest.fn() };
});
import {
  loadLeadMailData,
  automationValues,
  WHATSAPP_AUTOMATIONS,
} from './whatsapp-automations';
import { WhatsappAutomationService } from './whatsapp-automation.service';
import { simplifyTemplate } from './whatsapp-templates';

const tomorrow = new Date(Date.now() + 36 * 3600_000)
  .toISOString()
  .slice(0, 10);
const lead = {
  id: 9,
  name: 'Ravi Kumar',
  email: null,
  status: 'Site Visit Scheduled',
  advisor: { name: 'Anu', phone: '+91 90000 11111' },
  project: {
    name: 'Majestan Greens',
    url: 'https://www.majestanrealty.com/projects/greens',
    brochureUrl: null,
    address: 'Saravanampatti',
    mapsUrl: null,
  },
  projectText: null,
  propertyUrl: null,
  visit: { date: tomorrow, time: '10:30', location: 'Site office' },
};

const numbered = (name: string, text: string, count: number) =>
  simplifyTemplate({
    name,
    language: 'en',
    components: [
      {
        type: 'BODY',
        text,
        example: {
          body_text: [Array.from({ length: count }, (_, i) => `x${i}`)],
        },
      },
    ],
  })!;
const confirmed = numbered(
  'site_visit_confirmed',
  'Hi {{1}}, your visit to {{2}} is on {{3}} at {{4}}. Reply here.',
  4,
);
const rescheduled = numbered(
  'site_visit_rescheduled',
  'Hi {{1}}, your visit to {{2}} moved to {{3}} at {{4}}. Reply here.',
  4,
);

function setup({
  approved = [confirmed],
  earlierSent = false,
  deliver = jest.fn().mockResolvedValue('wamid.auto'),
} = {}) {
  const query = jest.fn((...[sql]: [string, unknown[]?]) => {
    if (sql.startsWith('SELECT mobile_number'))
      return Promise.resolve([
        { mobile_number: '9876543210', whatsapp_number: null },
      ]);
    if (sql.includes("status = 'sent' AND dedupe_key LIKE"))
      return Promise.resolve(earlierSent ? [{ id: 1 }] : []);
    return Promise.resolve({ affectedRows: 1 });
  });
  const whatsapp = {
    isConfigured: () => true,
    approved: jest.fn((name: string) =>
      Promise.resolve(approved.find((t) => t.name === name) ?? null),
    ),
    deliver,
  };
  const record = jest.fn().mockResolvedValue(undefined);
  const service = new WhatsappAutomationService(
    { query } as never,
    { on: jest.fn() } as never,
    whatsapp as never,
    { record } as never,
  );
  return { service, query, whatsapp, record };
}
const row = {
  id: 5,
  automation: 'site_visit_confirmed',
  lead_id: 9,
  attempts: 1,
};
const finished = (query: jest.Mock) =>
  query.mock.calls
    .filter(([sql]) =>
      String(sql).startsWith('UPDATE whatsapp_outbox SET status = ?'),
    )
    .map(([, p]) => p as unknown[]);

beforeEach(() => jest.mocked(loadLeadMailData).mockResolvedValue(lead));

describe('automation values', () => {
  it('fills names, the visit and the advisor without line breaks', () => {
    const v = automationValues({
      ...lead,
      visit: { ...lead.visit, location: 'Gate 2\nnear temple' },
    });
    expect(v).toMatchObject({
      first_name: 'Ravi',
      project: 'Majestan Greens',
      visit_time: '10:30 AM (IST)',
      meeting_point: 'Gate 2 near temple',
      advisor: 'Anu',
      advisor_phone: '+91 90000 11111',
    });
  });
  it('covers every event the sales emails cover', () => {
    expect(WHATSAPP_AUTOMATIONS.map((a) => a.template)).toEqual([
      'enquiry_received',
      'site_visit_confirmed',
      'site_visit_reminder',
      'visit_thank_you',
      'booking_confirmed',
    ]);
  });
});

describe('WhatsappAutomationService', () => {
  it('sends the approved template with the lead’s details and logs it as automatic', async () => {
    const { service, query, whatsapp, record } = setup();
    await service.process(row);
    const [to, sent] = whatsapp.deliver.mock.calls[0] as [
      string,
      {
        template: {
          name: string;
          components: { parameters: { text: string }[] }[];
        };
      },
    ];
    expect(to).toBe('919876543210');
    expect(sent.template.name).toBe('site_visit_confirmed');
    expect(sent.template.components[0].parameters.map((p) => p.text)).toEqual([
      'Ravi',
      'Majestan Greens',
      expect.stringContaining(
        String(new Date(`${tomorrow}T00:00:00Z`).getUTCDate()),
      ),
      '10:30 AM (IST)',
    ]);
    expect(finished(query).at(-1)).toEqual([
      'sent',
      null,
      'site_visit_confirmed',
      'wamid.auto',
      5,
    ]);
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        sentBy: null,
        subject: 'Automatic: Site visit confirmation',
        leadId: 9,
      }),
    );
  });

  it('fills a template made with named variables', async () => {
    const named = simplifyTemplate({
      name: 'site_visit_confirmed',
      language: 'en',
      parameter_format: 'NAMED',
      components: [
        {
          type: 'BODY',
          text: 'Hi *{{name}}*, Property: *{{property_name}}*. Date: *{{visit_date}}*. Time: *{{visit_time}}*. Reply here.',
          example: {
            body_text_named_params: [
              { param_name: 'name', example: 'Ravi' },
              { param_name: 'property_name', example: 'Greens' },
              { param_name: 'visit_date', example: '12 Nov' },
              { param_name: 'visit_time', example: '10:30 AM' },
            ],
          },
        },
      ],
    })!;
    const { service, whatsapp } = setup({ approved: [named] });
    await service.process(row);
    const [, sent] = whatsapp.deliver.mock.calls[0] as [
      string,
      {
        template: {
          components: {
            parameters: { text: string; parameter_name: string }[];
          }[];
        };
      },
    ];
    expect(
      sent.template.components[0].parameters.map((p) => [
        p.parameter_name,
        p.text,
      ]),
    ).toEqual([
      ['name', 'Ravi Kumar'],
      ['property_name', 'Majestan Greens'],
      ['visit_date', expect.any(String)],
      ['visit_time', '10:30 AM (IST)'],
    ]);
  });

  it('uses the rescheduled template when an earlier confirmation went out', async () => {
    const { service, whatsapp } = setup({
      approved: [confirmed, rescheduled],
      earlierSent: true,
    });
    await service.process(row);
    const [, sent] = whatsapp.deliver.mock.calls[0] as [
      string,
      { template: { name: string } },
    ];
    expect(sent.template.name).toBe('site_visit_rescheduled');
  });

  it('skips with a reason until the template is approved', async () => {
    const { service, query, whatsapp } = setup({ approved: [] });
    await service.process(row);
    expect(whatsapp.deliver).not.toHaveBeenCalled();
    expect(finished(query).at(-1)).toEqual([
      'skipped',
      'No approved template named "site_visit_confirmed" in WhatsApp Manager',
      null,
      null,
      5,
    ]);
  });

  it('skips when the visit has no time', async () => {
    jest
      .mocked(loadLeadMailData)
      .mockResolvedValue({ ...lead, visit: { ...lead.visit, time: null } });
    const { service, query } = setup();
    await service.process(row);
    expect(finished(query).at(-1)?.[1]).toBe('No visit time');
  });

  it('retries a failed send later and frees its key', async () => {
    const { service, query } = setup({
      deliver: jest.fn().mockRejectedValue(new Error('Meta is down')),
    });
    await service.process(row);
    expect(
      query.mock.calls.some(
        ([sql]) =>
          sql === 'UPDATE whatsapp_outbox SET dedupe_key = NULL WHERE id = ?',
      ),
    ).toBe(true);
    const retry = query.mock.calls.find(([sql]) =>
      String(sql).includes(
        "SET status = 'pending', send_after = NOW() + INTERVAL 5 MINUTE",
      ),
    )!;
    expect(retry[1]).toEqual(['Meta is down', 'site_visit_confirmed', 5]);
  });

  it('holds a new event back instead of queueing a second message', async () => {
    const { service, query } = setup();
    await service.enqueue(WHATSAPP_AUTOMATIONS[1], 9);
    expect(query.mock.calls).toHaveLength(1);
    expect(query.mock.calls[0][0]).toContain("status = 'pending'");
  });
});
